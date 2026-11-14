// Keeps dashed map lines at a fixed dash length in SCREEN pixels at any zoom (D-031 map look).
// Line dashes are measured in world metres, so without this a dash pattern would shrink to noise when
// zoomed out and grow huge when zoomed in. Attach the returned ref to a <group> that holds the lines;
// every frame, each dashed line material in the group gets dashScale = pixels per metre, so
// dashSize and gapSize on those lines are read as pixels.

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";

import { pixelsPerMetreAtTarget } from "./sceneMath";



interface DashableMaterial {
    isLineMaterial?: boolean;
    dashed?: boolean;
    dashScale?: number;
}


interface ControlsWithTarget {
    target?: THREE.Vector3;
}



export function useScreenSpaceDashes() {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        const group = groupRef.current;
        if (group === null) {
            return;
        }
        const controls = state.controls as unknown as ControlsWithTarget | null;
        let target: THREE.Vector3 | null = null;
        if (controls !== null && controls.target !== undefined) {
            target = controls.target;
        }
        const camera = state.camera as THREE.Camera & {
            isOrthographicCamera?: boolean;
            isPerspectiveCamera?: boolean;
            zoom?: number;
            fov?: number;
        };
        const pixelsPerMetre = pixelsPerMetreAtTarget(
            {
                is_orthographic: camera.isOrthographicCamera === true,
                zoom: camera.zoom ?? 1,
                fov_deg: camera.fov ?? 50,
                camera_position: camera.position,
                target_position: target,
            },
            state.size.height,
        );
        group.traverse((object) => {
            const material = (object as THREE.Object3D & { material?: DashableMaterial }).material;
            if (material === undefined || material.isLineMaterial !== true || material.dashed !== true) {
                return;
            }
            material.dashScale = pixelsPerMetre;
        });
    });

    return groupRef;
}
