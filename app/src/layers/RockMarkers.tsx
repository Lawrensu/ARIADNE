// All rocks from rocks.json as one instanced mesh, one draw call (owner: Malissa, Stage 2).
// Render inside the scene's <TerrainProvider>, inside the R3F <Canvas>.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { Rock } from "../data/contracts";
import { useAriadneStore } from "../state/store";
import type { TerrainFrame } from "../terrain/terrainFrame";
import { sampleTerrainSceneY } from "../terrain/terrainFrame";
import { useTerrain } from "../terrain/TerrainContext";
import { ROCK_MARKER_COLOR, rgbToHexNumber } from "./layerPalette";



// Markers are drawn at least this big so a 1 m rock is still visible from a high camera.
// This exaggerates small rocks; the legend caveat says so.
export const MIN_ROCK_MARKER_DIAMETER_M = 2.5;
export const MIN_ROCK_MARKER_HEIGHT_M = 1.0;



// Position, scale and orientation for one rock marker (a unit cylinder, 1 m across and 1 m tall).
export function writeRockMatrix(frame: TerrainFrame, rock: Rock, target: THREE.Matrix4): void {
    const diameterM = Math.max(rock.diameter_m, MIN_ROCK_MARKER_DIAMETER_M);
    const heightM = Math.max(rock.height_m, MIN_ROCK_MARKER_HEIGHT_M);
    const surfaceY = sampleTerrainSceneY(frame, rock.x_m, rock.z_m);
    const position = new THREE.Vector3(rock.x_m, surfaceY + heightM / 2, rock.z_m);
    const scale = new THREE.Vector3(diameterM, heightM, diameterM);
    target.compose(position, new THREE.Quaternion(), scale);
}



export function RockMarkers() {
    const isVisible = useAriadneStore((state) => state.visibleOverlays.rocks);
    if (!isVisible) {
        return null;
    }
    return <RockMarkerMesh />;
}


// Mounted only while visible, so geometry and material are created and disposed with it.
function RockMarkerMesh() {
    const { processedData, frame } = useTerrain();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const rocks = processedData.rocks;

    const geometry = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 8), []);
    const material = useMemo(
        () => new THREE.MeshBasicMaterial({ color: rgbToHexNumber(ROCK_MARKER_COLOR), toneMapped: false }),
        [],
    );

    useLayoutEffect(() => {
        const mesh = meshRef.current;
        if (mesh === null) {
            return;
        }
        const matrix = new THREE.Matrix4();
        for (let i = 0; i < rocks.length; i++) {
            writeRockMatrix(frame, rocks[i], matrix);
            mesh.setMatrixAt(i, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
    }, [rocks, frame]);

    useLayoutEffect(() => {
        return () => {
            geometry.dispose();
            material.dispose();
        };
    }, [geometry, material]);

    if (rocks.length === 0) {
        return null;
    }
    return <instancedMesh ref={meshRef} args={[geometry, material, rocks.length]} renderOrder={10} />;
}
