// Cameras and controls for the two views, both looking at the same scene.
//   Planning Table: orthographic, straight down, north up and east right, pan and zoom only.
//   Labyrinth view: perspective with orbit controls around the patch centre.
//
// Stage 3 (Letta): panning is screen-space, so a drag moves the map left, right, up and down at any
// zoom (MapControls otherwise pans the vertical axis into the ground for a top-down camera). Both
// cameras also answer the "Reset view" button through the viewResetSlice request counter.
//
// Redesign (D-031): both cameras also answer the control legend's zoom buttons and "Center on me"
// through the cameraSlice request counters. Each camera only reacts to requests made after it was
// mounted, so switching 2D/3D never replays an old reset, zoom or centre request.
//
// Follow mode (navigation style, like a car navigation app): during a walk both cameras glide after
// the astronaut every frame. Dragging, wheel zooming or rotating the map (the controls' "start"
// event) or Reset view pauses it; it resumes after FOLLOW_RESUME_DELAY_SECONDS without a touch, or at
// once on "Center on me". Zoom buttons do not pause it, so zooming happens around the astronaut.
// 2D following translates the camera and the controls target by the same step and, when following
// starts or resumes (or on "Center on me"), glides the zoom in to a navigation zoom (about 250 m across).
// 3D following is a chase camera behind the figure (navigationCamera.ts); zoom buttons scale its distance.
// FirstPersonCamera is the visor's eye-level camera (no controls, no follow logic).

import { MapControls, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import type { LocalPosition } from "../data/contracts";
import { useAriadneStore } from "../state/store";
import type { ResetViewId } from "../state/viewResetSlice";
import { sampleTerrainSceneY } from "../terrain/terrainFrame";
import { useTerrain } from "../terrain/TerrainContext";
import { FOLLOW_RESUME_DELAY_SECONDS, followBlendFraction, isFollowActive, shouldResumeFollowing } from "./followCamera";
import {
    CHASE_SCALE_MAX,
    CHASE_SCALE_MIN,
    CHASE_HEADING_TIME_CONSTANT_SECONDS,
    FIRST_PERSON_EYE_HEIGHT_M,
    FIRST_PERSON_FOV_DEG,
    FIRST_PERSON_HEADING_TIME_CONSTANT_SECONDS,
    FIRST_PERSON_NEAR_M,
    NAVIGATION_VIEW_ACROSS_M,
    computeChaseRig,
    computeFirstPersonPose,
    dampAngleDeg,
    glideZoom,
    keepAboveTerrain,
    navigationZoom,
} from "./navigationCamera";
import { labyrinthStartPosition, orthographicZoomToFit, patchFraming } from "./sceneMath";



const PLANNING_TABLE_CAMERA_HEIGHT_M = 4000;
const MAX_POLAR_ANGLE_RAD = 1.35;
// One zoom button tap scales the view by this factor (in: closer, out: farther).
const ZOOM_STEP_FACTOR = 1.5;
// Planning Table zoom limits, relative to the zoom that fits the whole patch.
const PLANNING_TABLE_MIN_ZOOM_OF_FIT = 0.6;
const PLANNING_TABLE_MAX_ZOOM_OF_FIT = 25;
// Labyrinth view orbit distance limits, metres.
const LABYRINTH_MIN_DISTANCE_M = 40;
const LABYRINTH_MAX_DISTANCE_OF_PATCH_WIDTH = 2.5;
// 2D follow zoom glide: time constant of the exponential zoom-in when following starts or resumes.
const NAVIGATION_ZOOM_TIME_CONSTANT_SECONDS = 0.4;
// 3D chase camera far plane and the vertical field of view of the map cameras.
const MAP_PERSPECTIVE_FAR_M = 15000;



// The small part of the Drei controls the reset needs. Drei exposes `target` and `update()`.
interface CameraControlsHandle {
    target: THREE.Vector3;
    update: () => void;
}



// Calls `handler` each time `requestId` changes after mount. The id seen at mount is remembered, so a
// camera that mounts later (2D/3D switch) does not replay a request that was meant for the old one.
function useRequestCounter(requestId: number, handler: () => void) {
    const handledIdRef = useRef(requestId);
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        if (requestId === handledIdRef.current) {
            return;
        }
        handledIdRef.current = requestId;
        handlerRef.current();
    }, [requestId]);
}


// Runs `onReset` when the control legend asks for a reset of this view. A request counter, not a
// boolean, so tapping Reset twice in a row resets twice. A reset also pauses following, otherwise the
// camera would glide straight back to the astronaut and the reset would seem to do nothing.
function useViewReset(viewId: ResetViewId, onReset: () => void) {
    const requestId = useAriadneStore((state) => state.viewResetRequestId);
    const lastResetView = useAriadneStore((state) => state.lastResetView);
    useRequestCounter(requestId, () => {
        if (lastResetView === viewId) {
            useAriadneStore.getState().pauseFollowingAstronaut(realNowSeconds());
            onReset();
        }
    });
}


// Zoom button taps: `onZoomStep(+1)` to zoom in, `onZoomStep(-1)` to zoom out.
function useZoomStepRequests(onZoomStep: (direction: number) => void) {
    const requestId = useAriadneStore((state) => state.zoomStepRequestId);
    const direction = useAriadneStore((state) => state.zoomStepDirection);
    useRequestCounter(requestId, () => onZoomStep(direction));
}


// "Center on me": the simulated astronaut position, or the rover (staging point) before a walk.
function useCenterOnAstronautRequests(onCenter: (position: LocalPosition) => void) {
    const requestId = useAriadneStore((state) => state.centerOnAstronautRequestId);
    useRequestCounter(requestId, () => {
        const state = useAriadneStore.getState();
        let position: LocalPosition | null = state.astronautPosition;
        if (position === null && state.processedData !== null) {
            position = state.processedData.meta.staging_point;
        }
        if (position !== null) {
            onCenter(position);
        }
    });
}



// Real time in seconds, for the follow resume delay (the simulation clock can run at 300x or pause).
function realNowSeconds(): number {
    return performance.now() / 1000;
}


interface FollowControlsHandlers {
    onStart: () => void;
    onEnd: () => void;
}


// Follows the astronaut during a walk (see the header comment). `followTargetY` gives the height the
// controls target should sit at over a position: 0 for the flat 2D map, the terrain in 3D.
// Returns the handlers to pass to the controls' onStart and onEnd.
// World-space ground offset (x, z) that moves the astronaut `offsetPx` screen pixels to the right of the
// screen centre. 2D: an orthographic camera shows 1 / zoom metres per pixel. 3D: metres per pixel at
// the orbit target distance from the vertical field of view. The offset runs along the camera's
// screen-right direction flattened onto the ground.
function followScreenOffsetWorld(
    camera: THREE.Camera,
    controls: CameraControlsHandle,
    viewportHeightPx: number,
    offsetPx: number,
): { x: number; z: number } {
    if (offsetPx === 0 || viewportHeightPx <= 0) {
        return { x: 0, z: 0 };
    }
    let metresPerPixel: number;
    if (camera instanceof THREE.OrthographicCamera) {
        metresPerPixel = 1 / camera.zoom;
    } else if (camera instanceof THREE.PerspectiveCamera) {
        const distance = camera.position.distanceTo(controls.target);
        metresPerPixel = (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / viewportHeightPx;
    } else {
        return { x: 0, z: 0 };
    }
    const screenRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    screenRight.y = 0;
    if (screenRight.lengthSq() === 0) {
        return { x: 0, z: 0 };
    }
    screenRight.normalize();
    const offsetMetres = offsetPx * metresPerPixel;
    // The camera aims left of the astronaut by this much, so the astronaut appears offsetPx to the right.
    return { x: screenRight.x * offsetMetres, z: screenRight.z * offsetMetres };
}


// What a camera that does not just translate with the astronaut (the 3D chase camera) is given each
// followed frame. `offsetWorld` is the ground offset for a docked sheet (see followScreenOffsetWorld).
interface FollowFrame {
    camera: THREE.Camera;
    controls: CameraControlsHandle;
    position: LocalPosition;
    deltaSeconds: number;
    offsetWorld: { x: number; z: number };
}


type FollowApplier = (frame: FollowFrame) => void;


function useFollowAstronaut(
    camera: THREE.Camera | null,
    controls: CameraControlsHandle | null,
    followTargetY: (position: LocalPosition) => number,
    applyFollow: FollowApplier | null = null,
): FollowControlsHandlers {
    const applyFollowRef = useRef(applyFollow);
    applyFollowRef.current = applyFollow;
    // True between the controls' "start" and "end": following never resumes in the middle of a drag.
    const isDragInProgressRef = useRef(false);
    const followTargetYRef = useRef(followTargetY);
    followTargetYRef.current = followTargetY;
    const viewportHeightPx = useThree((state) => state.size.height);
    const viewportHeightPxRef = useRef(viewportHeightPx);
    viewportHeightPxRef.current = viewportHeightPx;

    // A new walk turns following on, even if the user paused it before or during an earlier walk.
    // The value seen at mount is remembered, so a 2D/3D switch does not count as a new walk.
    const walkStartedAtSimSeconds = useAriadneStore((state) => state.walkStartedAtSimSeconds);
    const seenWalkStartRef = useRef(walkStartedAtSimSeconds);
    useEffect(() => {
        if (walkStartedAtSimSeconds === seenWalkStartRef.current) {
            return;
        }
        seenWalkStartRef.current = walkStartedAtSimSeconds;
        if (walkStartedAtSimSeconds !== null) {
            useAriadneStore.getState().resumeFollowingAstronaut();
        }
    }, [walkStartedAtSimSeconds]);

    // Stable callbacks: Drei re-attaches its listeners whenever these change.
    const onStart = useCallback(() => {
        isDragInProgressRef.current = true;
        useAriadneStore.getState().pauseFollowingAstronaut(realNowSeconds());
    }, []);
    // The resume delay counts from the end of the drag, not its start.
    const onEnd = useCallback(() => {
        isDragInProgressRef.current = false;
        useAriadneStore.getState().pauseFollowingAstronaut(realNowSeconds());
    }, []);

    useFrame((_, deltaSeconds) => {
        if (camera === null || controls === null) {
            return;
        }
        const state = useAriadneStore.getState();

        let isPausedByUser = state.followPausedByUser;
        if (isPausedByUser) {
            const canResume = shouldResumeFollowing(
                realNowSeconds(),
                state.lastMapInteractionAtRealSeconds,
                isDragInProgressRef.current,
                FOLLOW_RESUME_DELAY_SECONDS,
            );
            if (canResume) {
                state.resumeFollowingAstronaut();
                isPausedByUser = false;
            }
        }
        // A drag always wins over following, even if "Center on me" cleared the pause mid-drag.
        let isHeldByUser = isPausedByUser;
        if (isDragInProgressRef.current) {
            isHeldByUser = true;
        }

        const position = state.astronautPosition;
        const isWalkUnderWay = state.walkStartedAtSimSeconds !== null;
        const isFollowing = isFollowActive(isWalkUnderWay, position !== null, isHeldByUser);
        state.setIsFollowingAstronaut(isFollowing);
        if (!isFollowing || position === null) {
            return;
        }

        // Exponential glide towards the astronaut (snap when far). Camera and target move by the same
        // step, so the view keeps its zoom, angle and distance. Drei's own controls.update() runs
        // earlier in the frame (priority -1) and picks up the new target on the next frame.
        const target = controls.target;
        // With a sheet docked over the left of the map, aim the camera a little left of the astronaut so
        // they sit in the middle of the part of the map that is still visible.
        const offsetWorld = followScreenOffsetWorld(camera, controls, viewportHeightPxRef.current, state.followScreenOffsetXPx);
        if (applyFollowRef.current !== null) {
            applyFollowRef.current({ camera, controls, position, deltaSeconds, offsetWorld });
            return;
        }
        const gapX = position.x_m - offsetWorld.x - target.x;
        const gapY = followTargetYRef.current(position) - target.y;
        const gapZ = position.z_m - offsetWorld.z - target.z;
        const fraction = followBlendFraction(Math.hypot(gapX, gapZ), deltaSeconds);
        const stepX = gapX * fraction;
        const stepY = gapY * fraction;
        const stepZ = gapZ * fraction;
        target.set(target.x + stepX, target.y + stepY, target.z + stepZ);
        camera.position.set(camera.position.x + stepX, camera.position.y + stepY, camera.position.z + stepZ);
    });

    return { onStart, onEnd };
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

    // The flat map keeps its controls target on the ground plane (y 0); only x and z follow.
    const followHandlers = useFollowAstronaut(camera, controls, () => 0);

    const minZoom = fitZoom * PLANNING_TABLE_MIN_ZOOM_OF_FIT;
    const maxZoom = fitZoom * PLANNING_TABLE_MAX_ZOOM_OF_FIT;

    function clampZoom(zoom: number): number {
        return Math.min(Math.max(zoom, minZoom), maxZoom);
    }

    // Navigation zoom: about NAVIGATION_VIEW_ACROSS_M of terrain across the shorter screen side.
    const navigationZoomValue = clampZoom(navigationZoom(viewportSize.width, viewportSize.height, NAVIGATION_VIEW_ACROSS_M));

    // A zoom the camera glides to. Set when following starts or resumes and on "Center on me"; cleared
    // when it is reached and whenever the user touches the map or taps a zoom button, so the glide
    // never fights the user.
    const zoomGlideTargetRef = useRef<number | null>(null);
    const wasFollowingRef = useRef(false);

    useFrame((_, deltaSeconds) => {
        if (camera === null) {
            return;
        }
        const isFollowing = useAriadneStore.getState().isFollowingAstronaut;
        if (isFollowing && !wasFollowingRef.current) {
            zoomGlideTargetRef.current = navigationZoomValue;
        }
        wasFollowingRef.current = isFollowing;

        const glideTarget = zoomGlideTargetRef.current;
        if (glideTarget === null) {
            return;
        }
        const nextZoom = glideZoom(camera.zoom, glideTarget, deltaSeconds, NAVIGATION_ZOOM_TIME_CONSTANT_SECONDS);
        camera.zoom = nextZoom;
        camera.updateProjectionMatrix();
        if (nextZoom === glideTarget) {
            zoomGlideTargetRef.current = null;
        }
    });

    const onControlsStart = useCallback(() => {
        zoomGlideTargetRef.current = null;
        followHandlers.onStart();
    }, [followHandlers.onStart]);

    useZoomStepRequests((direction) => {
        if (camera === null) {
            return;
        }
        zoomGlideTargetRef.current = null;
        if (direction > 0) {
            camera.zoom = clampZoom(camera.zoom * ZOOM_STEP_FACTOR);
        } else {
            camera.zoom = clampZoom(camera.zoom / ZOOM_STEP_FACTOR);
        }
        camera.updateProjectionMatrix();
        if (controls !== null) {
            controls.update();
        }
    });

    // Pans so the astronaut (or the rover before a walk) is in the middle, straight down, north up,
    // and glides in to the navigation zoom.
    useCenterOnAstronautRequests((position) => {
        if (camera === null) {
            return;
        }
        camera.position.set(position.x_m, PLANNING_TABLE_CAMERA_HEIGHT_M, position.z_m);
        camera.updateProjectionMatrix();
        camera.lookAt(position.x_m, 0, position.z_m);
        if (controls !== null) {
            controls.target.set(position.x_m, 0, position.z_m);
            controls.update();
        }
        zoomGlideTargetRef.current = navigationZoomValue;
    });

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
                    minZoom={minZoom}
                    maxZoom={maxZoom}
                    onStart={onControlsStart}
                    onEnd={followHandlers.onEnd}
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

    // Chase camera state. The smoothed heading is what the camera sits behind; it follows the real
    // heading with a damped angle, and keeps its last value while the astronaut stands still.
    const smoothedHeadingDegRef = useRef<number | null>(null);
    // Zoom buttons scale the chase distance and height while following.
    const chaseScaleRef = useRef(1);
    // The next chase frame places the camera behind the figure at once (mount, "Center on me").
    const snapChaseRef = useRef(true);

    function sampleTerrainY(x_m: number, z_m: number): number {
        return sampleTerrainSceneY(frame, x_m, z_m);
    }

    function smoothHeading(targetHeadingDeg: number, deltaSeconds: number, snap: boolean): number {
        const previous = smoothedHeadingDegRef.current;
        let next = targetHeadingDeg;
        if (previous !== null && !snap) {
            next = dampAngleDeg(previous, targetHeadingDeg, deltaSeconds, CHASE_HEADING_TIME_CONSTANT_SECONDS);
        }
        smoothedHeadingDegRef.current = next;
        return next;
    }

    // While following (a walk under way, not paused by the user) the camera chases the astronaut from
    // behind, like car navigation in 3D. Camera and orbit target glide to the chase pose.
    function applyChase(followFrame: FollowFrame) {
        const state = useAriadneStore.getState();
        const snap = snapChaseRef.current;
        snapChaseRef.current = false;

        const headingDeg = smoothHeading(state.astronautHeadingDeg, followFrame.deltaSeconds, snap);
        const rig = computeChaseRig({
            position: followFrame.position,
            headingDeg,
            scale: chaseScaleRef.current,
            sampleTerrainY,
        });
        // With a sheet docked over the left of the map, aim left of the figure so it sits in the
        // visible part of the map.
        const wantedPosition = new THREE.Vector3(
            rig.cameraPosition.x - followFrame.offsetWorld.x,
            rig.cameraPosition.y,
            rig.cameraPosition.z - followFrame.offsetWorld.z,
        );
        const wantedTarget = new THREE.Vector3(
            rig.lookAtPosition.x - followFrame.offsetWorld.x,
            rig.lookAtPosition.y,
            rig.lookAtPosition.z - followFrame.offsetWorld.z,
        );

        let fraction = 1;
        if (!snap) {
            fraction = followBlendFraction(followFrame.camera.position.distanceTo(wantedPosition), followFrame.deltaSeconds);
        }
        followFrame.camera.position.lerp(wantedPosition, fraction);
        followFrame.controls.target.lerp(wantedTarget, fraction);

        // Gliding over a ridge must never push the camera into the ground.
        const safePosition = keepAboveTerrain(
            { x: followFrame.camera.position.x, y: followFrame.camera.position.y, z: followFrame.camera.position.z },
            sampleTerrainY,
        );
        followFrame.camera.position.set(safePosition.x, safePosition.y, safePosition.z);
        followFrame.camera.lookAt(followFrame.controls.target);
    }

    const followHandlers = useFollowAstronaut(
        camera,
        controls,
        (position) => sampleTerrainSceneY(frame, position.x_m, position.z_m),
        applyChase,
    );

    const minDistance = LABYRINTH_MIN_DISTANCE_M;
    const maxDistance = framing.width_m * LABYRINTH_MAX_DISTANCE_OF_PATCH_WIDTH;

    // Zoom in 3D moves the camera along its line of sight towards (or away from) the orbit target.
    // While following, the chase distance and height scale instead, so the chase keeps the zoom.
    useZoomStepRequests((direction) => {
        if (camera === null || controls === null) {
            return;
        }
        if (useAriadneStore.getState().isFollowingAstronaut) {
            let nextScale = chaseScaleRef.current * ZOOM_STEP_FACTOR;
            if (direction > 0) {
                nextScale = chaseScaleRef.current / ZOOM_STEP_FACTOR;
            }
            chaseScaleRef.current = Math.min(Math.max(nextScale, CHASE_SCALE_MIN), CHASE_SCALE_MAX);
            return;
        }
        const offset = camera.position.clone().sub(controls.target);
        let distance = offset.length();
        if (direction > 0) {
            distance = distance / ZOOM_STEP_FACTOR;
        } else {
            distance = distance * ZOOM_STEP_FACTOR;
        }
        distance = Math.min(Math.max(distance, minDistance), maxDistance);
        offset.setLength(distance);
        camera.position.copy(controls.target).add(offset);
        controls.update();
    });

    // Goes behind the astronaut (or the rover before a walk) at once. The request also resumes
    // following, so during a walk the chase carries on from there.
    useCenterOnAstronautRequests((position) => {
        if (camera === null || controls === null) {
            return;
        }
        const headingDeg = smoothHeading(useAriadneStore.getState().astronautHeadingDeg, 0, true);
        const rig = computeChaseRig({ position, headingDeg, scale: chaseScaleRef.current, sampleTerrainY });
        const safePosition = keepAboveTerrain(rig.cameraPosition, sampleTerrainY);
        camera.position.set(safePosition.x, safePosition.y, safePosition.z);
        controls.target.set(rig.lookAtPosition.x, rig.lookAtPosition.y, rig.lookAtPosition.z);
        camera.lookAt(controls.target);
        controls.update();
        snapChaseRef.current = true;
    });

    return (
        <>
            <PerspectiveCamera
                ref={setCamera}
                makeDefault
                fov={40}
                near={5}
                far={MAP_PERSPECTIVE_FAR_M}
                position={[start.x, start.y, start.z]}
            />
            {camera !== null && (
                <OrbitControls
                    makeDefault
                    camera={camera}
                    target={[framing.centre_x_m, targetY, framing.centre_z_m]}
                    maxPolarAngle={MAX_POLAR_ANGLE_RAD}
                    minDistance={minDistance}
                    maxDistance={maxDistance}
                    enableDamping
                    onStart={followHandlers.onStart}
                    onEnd={followHandlers.onEnd}
                />
            )}
        </>
    );
}



// First-person camera for the helmet visor (D-032): eye height above the terrain at the astronaut's
// position (the staging point before a walk), looking along the smoothed heading, pitched slightly
// down so the ground ahead is visible. No controls: the visor is not a map.
// The terrain mesh has a vertex every few metres, so between vertices it can sit above the bilinear
// height under the astronaut. The eye uses the highest ground within one mesh step, so it never ends
// up inside a slope (which shows a black screen).
const FIRST_PERSON_GROUND_SAMPLE_RADIUS_M = 4;


function highestNearbyTerrainY(frame: Parameters<typeof sampleTerrainSceneY>[0], x_m: number, z_m: number): number {
    const radius = FIRST_PERSON_GROUND_SAMPLE_RADIUS_M;
    const offsets = [
        [0, 0],
        [radius, 0],
        [-radius, 0],
        [0, radius],
        [0, -radius],
    ];
    let highest = Number.NEGATIVE_INFINITY;
    for (const [dx, dz] of offsets) {
        const y = sampleTerrainSceneY(frame, x_m + dx, z_m + dz);
        if (Number.isFinite(y) && y > highest) {
            highest = y;
        }
    }
    if (!Number.isFinite(highest)) {
        return sampleTerrainSceneY(frame, x_m, z_m);
    }
    return highest;
}


export function FirstPersonCamera() {
    const { frame } = useTerrain();
    const processedData = useAriadneStore((state) => state.processedData);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const smoothedHeadingDegRef = useRef<number | null>(null);

    let startPosition: LocalPosition = { x_m: 0, z_m: 0 };
    if (processedData !== null) {
        startPosition = processedData.meta.staging_point;
    }
    const startEyeY = sampleTerrainSceneY(frame, startPosition.x_m, startPosition.z_m) + FIRST_PERSON_EYE_HEIGHT_M;

    useFrame((_, deltaSeconds) => {
        const camera = cameraRef.current;
        if (camera === null) {
            return;
        }
        const state = useAriadneStore.getState();
        let position: LocalPosition | null = state.astronautPosition;
        if (position === null && state.processedData !== null) {
            position = state.processedData.meta.staging_point;
        }
        if (position === null) {
            return;
        }

        const previousHeading = smoothedHeadingDegRef.current;
        let headingDeg = state.astronautHeadingDeg;
        if (previousHeading !== null) {
            headingDeg = dampAngleDeg(
                previousHeading,
                state.astronautHeadingDeg,
                deltaSeconds,
                FIRST_PERSON_HEADING_TIME_CONSTANT_SECONDS,
            );
        }
        smoothedHeadingDegRef.current = headingDeg;

        const pose = computeFirstPersonPose({
            position,
            headingDeg,
            sampleTerrainY: (x_m, z_m) => highestNearbyTerrainY(frame, x_m, z_m),
        });
        camera.position.set(pose.eyePosition.x, pose.eyePosition.y, pose.eyePosition.z);
        camera.lookAt(pose.lookAtPosition.x, pose.lookAtPosition.y, pose.lookAtPosition.z);
    });

    return (
        <PerspectiveCamera
            ref={cameraRef}
            makeDefault
            fov={FIRST_PERSON_FOV_DEG}
            near={FIRST_PERSON_NEAR_M}
            far={MAP_PERSPECTIVE_FAR_M}
            position={[startPosition.x_m, startEyeY, startPosition.z_m]}
        />
    );
}
