// Navigation camera maths (Google Maps / Waze style). Pure: no Three.js, no store.
//
// Three cameras use these numbers (CameraRig.tsx applies them every frame):
//   2D follow zoom:  zoom in to a street-level view, about 250 m of terrain across the shorter side.
//   3D chase view:   a camera behind the astronaut, above the terrain, looking ahead along the heading.
//   First person:    the visor camera at eye height, looking along the heading a little downward.
//
// Local grid only: x east, z south, metres. Heading 0 = north = -z, 90 = east = +x, clockwise.



// 2D follow: terrain visible across the shorter screen side.
export const NAVIGATION_VIEW_ACROSS_M = 250;

// 3D chase view.
export const CHASE_DISTANCE_BEHIND_M = 30;
export const CHASE_HEIGHT_ABOVE_TERRAIN_M = 14;
export const CHASE_LOOK_AHEAD_M = 20;
// Height of the look-at point above the terrain at that point (roughly the astronaut's chest).
export const CHASE_LOOK_HEIGHT_ABOVE_TERRAIN_M = 1.2;
// The chase camera never sinks closer to the terrain than this, even while it glides over a ridge.
export const CHASE_MIN_CLEARANCE_M = 4;
// Heading smoothing time constant: a corner of the path turns the view over about a second.
export const CHASE_HEADING_TIME_CONSTANT_SECONDS = 0.5;
// Zoom buttons scale the chase distance and height by this factor per step, within these limits.
export const CHASE_SCALE_MIN = 0.4;
export const CHASE_SCALE_MAX = 4;

// First-person (visor) camera.
export const FIRST_PERSON_EYE_HEIGHT_M = 1.7;
export const FIRST_PERSON_PITCH_DOWN_DEG = 8;
export const FIRST_PERSON_FOV_DEG = 70;
export const FIRST_PERSON_NEAR_M = 0.1;
export const FIRST_PERSON_HEADING_TIME_CONSTANT_SECONDS = 0.3;



export interface GroundPosition {
    x_m: number;
    z_m: number;
}


export interface ScenePoint {
    x: number;
    y: number;
    z: number;
}


// Terrain height lookup: scene y of the terrain surface at a local grid position.
export type TerrainHeightSampler = (x_m: number, z_m: number) => number;



// Unit vector on the ground that points the way the heading faces: heading 0 = -z, 90 = +x.
export function headingToGroundDirection(headingDeg: number): { x: number; z: number } {
    const headingRad = (headingDeg * Math.PI) / 180;
    return { x: Math.sin(headingRad), z: -Math.cos(headingRad) };
}


// Wraps an angle difference into -180 to +180 degrees (the short way round).
export function shortestAngleDeltaDeg(fromDeg: number, toDeg: number): number {
    let delta = (toDeg - fromDeg) % 360;
    if (delta > 180) {
        delta = delta - 360;
    }
    if (delta < -180) {
        delta = delta + 360;
    }
    return delta;
}


// Heading in 0 to 360 degrees.
export function normalizeHeadingDeg(headingDeg: number): number {
    const wrapped = headingDeg % 360;
    if (wrapped < 0) {
        return wrapped + 360;
    }
    return wrapped;
}


// Moves `currentDeg` towards `targetDeg` the short way round with exponential smoothing.
// Frame-rate independent (1 - exp(-dt / tau)). A heading jump of 170 degrees at a path corner turns
// smoothly instead of snapping; a jump across the 359 to 1 wrap turns 2 degrees, not 358.
export function dampAngleDeg(currentDeg: number, targetDeg: number, deltaSeconds: number, timeConstantSeconds: number): number {
    if (deltaSeconds <= 0) {
        return currentDeg;
    }
    let fraction = 1;
    if (timeConstantSeconds > 0) {
        fraction = 1 - Math.exp(-deltaSeconds / timeConstantSeconds);
    }
    const delta = shortestAngleDeltaDeg(currentDeg, targetDeg);
    return normalizeHeadingDeg(currentDeg + delta * fraction);
}


// 2D zoom (pixels per metre) that shows `acrossMetres` of terrain across the shorter viewport side.
export function navigationZoom(viewportWidthPx: number, viewportHeightPx: number, acrossMetres: number): number {
    const shorterSidePx = Math.min(viewportWidthPx, viewportHeightPx);
    if (shorterSidePx <= 0 || acrossMetres <= 0) {
        return 1;
    }
    return shorterSidePx / acrossMetres;
}


// Next value of a value gliding towards a target, in log space for zoom (so zooming in and out feel
// the same). Frame-rate independent. Returns the target itself once within 0.5 percent.
export function glideZoom(currentZoom: number, targetZoom: number, deltaSeconds: number, timeConstantSeconds: number): number {
    if (currentZoom <= 0 || targetZoom <= 0) {
        return targetZoom;
    }
    const ratio = targetZoom / currentZoom;
    if (Math.abs(ratio - 1) < 0.005) {
        return targetZoom;
    }
    let fraction = 1;
    if (timeConstantSeconds > 0 && deltaSeconds > 0) {
        fraction = 1 - Math.exp(-deltaSeconds / timeConstantSeconds);
    } else if (deltaSeconds <= 0) {
        fraction = 0;
    }
    return currentZoom * Math.pow(ratio, fraction);
}


export interface ChaseInput {
    position: GroundPosition;
    headingDeg: number;
    // Scales the distance behind and the height above terrain (zoom buttons). 1 = default.
    scale: number;
    sampleTerrainY: TerrainHeightSampler;
}


export interface ChaseRig {
    cameraPosition: ScenePoint;
    lookAtPosition: ScenePoint;
}


// Chase camera: CHASE_DISTANCE_BEHIND_M behind the astronaut along the reverse of the heading,
// CHASE_HEIGHT_ABOVE_TERRAIN_M above the terrain at the camera position (never below the astronaut's
// own terrain plus a small clearance, so a hollow behind does not bury the view), looking at a point
// CHASE_LOOK_AHEAD_M ahead of the astronaut.
export function computeChaseRig(input: ChaseInput): ChaseRig {
    const direction = headingToGroundDirection(input.headingDeg);
    const scale = Math.min(Math.max(input.scale, CHASE_SCALE_MIN), CHASE_SCALE_MAX);
    const behindM = CHASE_DISTANCE_BEHIND_M * scale;
    const heightM = CHASE_HEIGHT_ABOVE_TERRAIN_M * scale;

    const cameraX = input.position.x_m - direction.x * behindM;
    const cameraZ = input.position.z_m - direction.z * behindM;
    const terrainAtCameraY = input.sampleTerrainY(cameraX, cameraZ);
    const terrainAtAstronautY = input.sampleTerrainY(input.position.x_m, input.position.z_m);
    const cameraY = Math.max(terrainAtCameraY + heightM, terrainAtAstronautY + CHASE_MIN_CLEARANCE_M);

    const lookX = input.position.x_m + direction.x * CHASE_LOOK_AHEAD_M;
    const lookZ = input.position.z_m + direction.z * CHASE_LOOK_AHEAD_M;
    const lookY = input.sampleTerrainY(lookX, lookZ) + CHASE_LOOK_HEIGHT_ABOVE_TERRAIN_M;

    return {
        cameraPosition: { x: cameraX, y: cameraY, z: cameraZ },
        lookAtPosition: { x: lookX, y: lookY, z: lookZ },
    };
}


// Keeps a (smoothed) camera height at least CHASE_MIN_CLEARANCE_M above the terrain under it.
export function keepAboveTerrain(cameraPosition: ScenePoint, sampleTerrainY: TerrainHeightSampler): ScenePoint {
    const minimumY = sampleTerrainY(cameraPosition.x, cameraPosition.z) + CHASE_MIN_CLEARANCE_M;
    if (cameraPosition.y >= minimumY) {
        return cameraPosition;
    }
    return { x: cameraPosition.x, y: minimumY, z: cameraPosition.z };
}


export interface FirstPersonInput {
    position: GroundPosition;
    headingDeg: number;
    sampleTerrainY: TerrainHeightSampler;
}


export interface FirstPersonPose {
    eyePosition: ScenePoint;
    lookAtPosition: ScenePoint;
}


// Eye at FIRST_PERSON_EYE_HEIGHT_M above the terrain, looking along the heading pitched down by
// FIRST_PERSON_PITCH_DOWN_DEG so the ground ahead is visible. The look-at point is 10 m along the view ray.
export function computeFirstPersonPose(input: FirstPersonInput): FirstPersonPose {
    const direction = headingToGroundDirection(input.headingDeg);
    const pitchRad = (FIRST_PERSON_PITCH_DOWN_DEG * Math.PI) / 180;
    const lookRangeM = 10;
    const eyeY = input.sampleTerrainY(input.position.x_m, input.position.z_m) + FIRST_PERSON_EYE_HEIGHT_M;
    return {
        eyePosition: { x: input.position.x_m, y: eyeY, z: input.position.z_m },
        lookAtPosition: {
            x: input.position.x_m + direction.x * Math.cos(pitchRad) * lookRangeM,
            y: eyeY - Math.sin(pitchRad) * lookRangeM,
            z: input.position.z_m + direction.z * Math.cos(pitchRad) * lookRangeM,
        },
    };
}
