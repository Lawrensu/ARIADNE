// The terrain surface: the shared geometry with the HiRISE photo drawn as a "phosphor hologram"
// (visual_direction.md 6.3, D-031). The photo luminance becomes a green ramp on near-black, walkable
// ground is lit, no-go ground (traversal_penalty = +Infinity) is dark with a fine diagonal hatch,
// and a faint 100 m grid gives scale. The maths is in terrain/phosphorTerrain.ts (tested), the
// shader in terrain/phosphorTerrainMaterial.ts. No new network asset: the same HiRISE texture and
// the traversal_penalty layer that is already loaded.

import { useLoader, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import type { LuminanceStretch } from "../terrain/phosphorTerrain";
import { luminanceHistogram, luminanceStretchFromHistogram } from "../terrain/phosphorTerrain";
import { createNoGoMaskTexture, createPhosphorTerrainMaterial } from "../terrain/phosphorTerrainMaterial";
import { useAriadneStore } from "../state/store";
import { useTerrain } from "../terrain/TerrainContext";
import { sunDirectionVector } from "./sceneMath";



// The contrast stretch is measured on a small copy of the photo: enough for a histogram, a few ms.
const HISTOGRAM_SAMPLE_WIDTH_PX = 512;
const FULL_RANGE_STRETCH: LuminanceStretch = { low: 0, high: 1 };
// A pointer that moved more than this between press and release was a drag, not a tap.
const TERRAIN_TAP_MAX_MOVE_PX = 5;

let hasLoggedBuildTime = false;



// Reads the photo once through a small canvas. Falls back to the full range when the image cannot
// be read (no 2D canvas, or a tainted canvas).
function measureLuminanceStretch(image: unknown): LuminanceStretch {
    if (typeof document === "undefined") {
        return FULL_RANGE_STRETCH;
    }
    const source = image as CanvasImageSource & { width: number; height: number };
    if (source === null || source === undefined || !(source.width > 0) || !(source.height > 0)) {
        return FULL_RANGE_STRETCH;
    }
    const sampleWidth = Math.min(HISTOGRAM_SAMPLE_WIDTH_PX, source.width);
    const sampleHeight = Math.max(1, Math.round((source.height / source.width) * sampleWidth));
    try {
        const canvas = document.createElement("canvas");
        canvas.width = sampleWidth;
        canvas.height = sampleHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context === null) {
            return FULL_RANGE_STRETCH;
        }
        context.drawImage(source, 0, 0, sampleWidth, sampleHeight);
        const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
        return luminanceStretchFromHistogram(luminanceHistogram(pixels));
    } catch (error) {
        console.warn("Terrain contrast stretch skipped, using the full range", error);
        return FULL_RANGE_STRETCH;
    }
}



export function TerrainMesh() {
    const { processedData, geometry } = useTerrain();
    const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
    const pixelRatio = useThree((state) => state.viewport.dpr);
    const texture = useLoader(THREE.TextureLoader, processedData.textureUrl);

    useLayoutEffect(() => {
        // The shader reads the raw sRGB bytes and writes sRGB colours, so no colour conversion here.
        texture.colorSpace = THREE.NoColorSpace;
        texture.anisotropy = maxAnisotropy;
        texture.needsUpdate = true;
    }, [texture, maxAnisotropy]);

    const sun = processedData.meta.sun;
    const grid = processedData.meta.grid;
    const traversalPenalty = processedData.float32Layers.traversal_penalty;

    const material = useMemo(() => {
        const startMs = performance.now();
        const noGoMaskTexture = createNoGoMaskTexture(grid, traversalPenalty);
        const luminanceStretch = measureLuminanceStretch(texture.image);
        const direction = sunDirectionVector(sun.sun_azimuth_deg, sun.sun_incidence_deg);
        const built = createPhosphorTerrainMaterial({
            hiriseTexture: texture,
            noGoMaskTexture,
            luminanceStretch,
            sunDirection: new THREE.Vector3(direction.x, direction.y, direction.z),
            pixelRatio: 1,
        });
        if (!hasLoggedBuildTime) {
            hasLoggedBuildTime = true;
            const elapsedMs = performance.now() - startMs;
            console.info(
                `Phosphor terrain built in ${elapsedMs.toFixed(1)} ms ` +
                    `(luminance stretch ${luminanceStretch.low.toFixed(3)} to ${luminanceStretch.high.toFixed(3)})`,
            );
        }
        return built;
    }, [texture, grid, traversalPenalty, sun.sun_azimuth_deg, sun.sun_incidence_deg]);

    useEffect(() => {
        material.uniforms.uPixelRatio.value = pixelRatio;
    }, [material, pixelRatio]);

    useEffect(() => {
        return () => {
            const noGoMaskTexture = material.uniforms.uNoGoMask.value as THREE.Texture;
            noGoMaskTexture.dispose();
            material.dispose();
        };
    }, [material]);

    // A tap on the terrain shows that point's data in the Here card (shell/HereCard.tsx). Drags that
    // pan or rotate the map end with a click too, so taps that moved more than a few pixels are ignored.
    function onTerrainTap(event: ThreeEvent<MouseEvent>) {
        if (event.delta > TERRAIN_TAP_MAX_MOVE_PX) {
            return;
        }
        event.stopPropagation();
        useAriadneStore.getState().setInspectedPosition({ x_m: event.point.x, z_m: event.point.z });
    }

    return <mesh geometry={geometry} material={material} onClick={onTerrainTap} />;
}
