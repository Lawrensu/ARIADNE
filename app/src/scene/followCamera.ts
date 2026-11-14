// Follow camera maths (navigation-style "follow the astronaut"). Pure, no Three.js, no store.
//
// While a walk is under way the camera glides after the astronaut, like a car navigation app.
// Touching the map pauses following; after a few quiet seconds it glides back on its own.
// CameraRig.tsx applies these numbers to both cameras every frame.



// Real seconds without a map interaction before following resumes on its own.
export const FOLLOW_RESUME_DELAY_SECONDS = 5;
// Exponential smoothing time constant: after this long the camera has covered about 63 % of the
// gap to the astronaut. Short enough to keep up at 300x, long enough to glide instead of jump.
export const FOLLOW_SMOOTHING_TIME_CONSTANT_SECONDS = 0.25;
// Gaps wider than this are jumped at once (a walk starting far from the view, a 2D/3D switch),
// because a long glide across the patch reads as the map sliding away on its own.
export const FOLLOW_SNAP_DISTANCE_M = 500;



// Share of the remaining gap to close this frame, from the frame time and the time constant.
// 1 - exp(-dt / tau) is frame-rate independent: two 8 ms frames close the same gap as one 16 ms frame.
export function followSmoothingFactor(deltaSeconds: number, timeConstantSeconds: number): number {
    if (deltaSeconds <= 0) {
        return 0;
    }
    if (timeConstantSeconds <= 0) {
        return 1;
    }
    return 1 - Math.exp(-deltaSeconds / timeConstantSeconds);
}


// Share of the gap to close this frame for a gap of `gapDistanceM`: snaps (1) when the gap is
// wider than FOLLOW_SNAP_DISTANCE_M, otherwise the smoothing factor.
export function followBlendFraction(gapDistanceM: number, deltaSeconds: number): number {
    if (gapDistanceM > FOLLOW_SNAP_DISTANCE_M) {
        return 1;
    }
    return followSmoothingFactor(deltaSeconds, FOLLOW_SMOOTHING_TIME_CONSTANT_SECONDS);
}


// Whether following should resume after the user paused it by touching the map.
// Never while a drag is still in progress (between the controls' "start" and "end"), and never
// before `resumeDelaySeconds` have passed since the last interaction.
export function shouldResumeFollowing(
    nowSeconds: number,
    lastInteractionSeconds: number | null,
    isDragInProgress: boolean,
    resumeDelaySeconds: number,
): boolean {
    if (isDragInProgress) {
        return false;
    }
    if (lastInteractionSeconds === null) {
        return true;
    }
    const quietSeconds = nowSeconds - lastInteractionSeconds;
    if (quietSeconds >= resumeDelaySeconds) {
        return true;
    }
    return false;
}


// Whether the camera follows this frame: only during a walk with a known astronaut position, and
// only when the user has not paused it.
export function isFollowActive(isWalkUnderWay: boolean, hasAstronautPosition: boolean, isPausedByUser: boolean): boolean {
    if (!isWalkUnderWay) {
        return false;
    }
    if (!hasAstronautPosition) {
        return false;
    }
    if (isPausedByUser) {
        return false;
    }
    return true;
}
