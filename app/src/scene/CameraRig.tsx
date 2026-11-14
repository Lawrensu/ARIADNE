// Cameras and controls for the two views, both looking at the same scene.
//   Planning Table: orthographic, straight down, north up and east right, pan and zoom only.
//   Labyrinth view: perspective with orbit controls around the patch centre.
//
// Stage 3 (Letta): panning is screen-space, so a drag moves the map left, right, up and down at any
// zoom (MapControls otherwise pans the vertical axis into the ground for a top-down camera). Both
// cameras also answer the "Reset view" button through the viewResetSlice request counter.

import { MapControls, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { useAriadneStore } from "../state/store";
import type { ResetViewId } from "../state/viewResetSlice";
import { sampleTerrainSceneY } from "../terrain/terrainFrame";
import { useTerrain } from "../terrain/TerrainContext";
import { labyrinthStartPosition, orthographicZoomToFit, patchFraming } from "./sceneMath";



const PLANNING_TABLE_CAMERA_HEIGHT_M = 4000;
const MAX_POLAR_ANGLE_RAD = 1.35;



// The small part of the Drei controls the reset needs. Drei exposes `target` and `update()`.
interface CameraControlsHandle {
    target: THREE.Vector3;
    update: () => void;
}



// Runs `onReset` when the status strip asks for a reset of this view. A request counter, not a
// boolean, so tapping Reset twice in a row resets twice.
function useViewReset(viewId: ResetViewId, onReset: () => void) {
    const requestId = useAriadneStore((state) => state.viewResetRequestId);
    const lastResetView = useAriadneStore((state) => state.lastResetView);
    const onResetRef = useRef(onReset);
    onResetRef.current = onReset;

    useEffect(() => {
        if (requestId === 0) {
            return;
        }
        if (lastResetView !== viewId) {
            return;
        }
        onResetRef.current();
    }, [requestId, lastResetView, viewId]);
}



export function PlanningTableCamera() {
    const { frame } = useTerrain();
    const viewportSize = useThree((state) => state.size);
    const controls = useThree((state) => state.controls) as unknown as CameraControlsHandle | null;
    const [camera, setCamera] = useState<THREE.OrthographicCamera | null>(null);

    const framing = patchFraming(frame.grid);
    const fitZoom = orthographicZoomToFit(framing, viewportSize.width, viewportSize.height);

    function resetView() {
        if (camera === null) {
            return;
        }
        camera.position.set(framing.centre_x_m, PLANNING_TABLE_CAMERA_HEIGHT_M, framing.centre_z_m);
        camera.zoom = fitZoom;
        camera.updateProjectionMatrix();
        camera.lookAt(framing.centre_x_m, 0, framing.centre_z_m);
        if (controls !== null) {
            controls.target.set(framing.centre_x_m, 0, framing.centre_z_m);
            controls.update();
        }
    }

    useViewReset("planning_table", resetView);

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
                    screenSpacePanning
                    minZoom={fitZoom * 0.6}
                    maxZoom={fitZoom * 25}
                />
            )}
        </>
    );
}


export function LabyrinthCamera() {
    const { frame } = useTerrain();
    const controls = useThree((state) => state.controls) as unknown as CameraControlsHandle | null;
    const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);

    const framing = patchFraming(frame.grid);
    const targetY = sampleTerrainSceneY(frame, framing.centre_x_m, framing.centre_z_m);
    const start = labyrinthStartPosition(framing, targetY);

    function resetView() {
        if (camera === null) {
            return;
        }
        camera.position.set(start.x, start.y, start.z);
        camera.lookAt(framing.centre_x_m, targetY, framing.centre_z_m);
        if (controls !== null) {
            controls.target.set(framing.centre_x_m, targetY, framing.centre_z_m);
            controls.update();
        }
    }

    useViewReset("labyrinth_view", resetView);

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
