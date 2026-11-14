// The terrain surface: the shared geometry with the HiRISE photo stretched over the grid extent.
// The photo already contains real shadows, so the lighting is mostly ambient (the photo stays
// readable) plus a gentle directional light from the HiRISE sun direction for a hint of relief.

import { useLoader, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { useTerrain } from "../terrain/TerrainContext";
import { sunDirectionVector } from "./sceneMath";



const SUN_LIGHT_DISTANCE_M = 4000;
const AMBIENT_LIGHT_INTENSITY = 2.2;
const SUN_LIGHT_INTENSITY = 0.9;



export function TerrainMesh() {
    const { processedData, geometry } = useTerrain();
    const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
    const texture = useLoader(THREE.TextureLoader, processedData.textureUrl);

    useLayoutEffect(() => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = maxAnisotropy;
        texture.needsUpdate = true;
    }, [texture, maxAnisotropy]);

    const sun = processedData.meta.sun;
    const sunPosition = useMemo<[number, number, number]>(() => {
        const direction = sunDirectionVector(sun.sun_azimuth_deg, sun.sun_incidence_deg);
        return [
            direction.x * SUN_LIGHT_DISTANCE_M,
            direction.y * SUN_LIGHT_DISTANCE_M,
            direction.z * SUN_LIGHT_DISTANCE_M,
        ];
    }, [sun.sun_azimuth_deg, sun.sun_incidence_deg]);

    return (
        <>
            <ambientLight intensity={AMBIENT_LIGHT_INTENSITY} />
            <directionalLight position={sunPosition} intensity={SUN_LIGHT_INTENSITY} />
            <mesh geometry={geometry}>
                <meshLambertMaterial map={texture} />
            </mesh>
        </>
    );
}
