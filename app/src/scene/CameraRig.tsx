// Cameras and controls for the two views, both looking at the same scene.
//   Planning Table: orthographic, straight down, north up and east right, pan and zoom only.
//   Labyrinth view: perspective with orbit controls around the patch centre.

import { MapControls, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useState } from "react";
import * as THREE from "three";

import { sampleTerrainSceneY } from "../terrain/terrainFrame";
import { useTerrain } from "../terrain/TerrainContext";
import { labyrinthStartPosition, orthographicZoomToFit, patchFraming } from "./sceneMath";



const PLANNING_TABLE_CAMERA_HEIGHT_M = 4000;
const MAX_POLAR_ANGLE_RAD = 1.35;


export function PlanningTableCamera() {
    const { frame } = useTerrain();
    const viewportSize = useThree((state) => state.size);
    const [camera, setCamera] = useState<THREE.OrthographicCamera | null>(null);

    const framing = patchFraming(frame.grid);
    const fitZoom = orthographicZoomToFit(framing, viewportSize.width, viewportSize.height);

    return (
        <>
            <OrthographicCamera
                ref={setCamera}
                makeDefault
                position={[framing.centre_x_m, PLANNING_TABLE_CAMERA_HEIGHT_M, framing.centre_z_m]}
                up={[0, 0, -1]}
                zoom={fitZoom}
                near={1}
                far={PLANNING_TABLE_CAMERA_HEIGHT_M * 2}
            />
            {camera !== null && (
                <MapControls
                    makeDefault
                    camera={camera}
                    target={[framing.centre_x_m, 0, framing.centre_z_m]}
                    enableRotate={false}
                    enableDamping={false}
                    minZoom={fitZoom * 0.6}
                    maxZoom={fitZoom * 25}
                />
            )}
        </>
    );
}


export function LabyrinthCamera() {
    const { frame } = useTerrain();
    const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);

    const framing = patchFraming(frame.grid);
    const targetY = sampleTerrainSceneY(frame, framing.centre_x_m, framing.centre_z_m);
    const start = labyrinthStartPosition(framing, targetY);

    return (
        <>
            <PerspectiveCamera
                ref={setCamera}
                makeDefault
                fov={40}
                near={5}
                far={15000}
                position={[start.x, start.y, start.z]}
            />
            {camera !== null && (
                <OrbitControls
                    makeDefault
                    camera={camera}
                    target={[framing.centre_x_m, targetY, framing.centre_z_m]}
                    maxPolarAngle={MAX_POLAR_ANGLE_RAD}
                    minDistance={40}
                    maxDistance={framing.width_m * 2.5}
                    enableDamping
                />
            )}
        </>
    );
}
