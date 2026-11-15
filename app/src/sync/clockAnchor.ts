// Clock anchor for the session sync (D-032). Pure functions.
//
// The leader sends { simElapsedSeconds, isSimPlaying, simSpeedMultiplier, sentAtRealMs }. A follower
// does not tick by itself: every frame it computes simElapsed + (now - sentAt) x speed from the last
// anchor, so its astronaut moves smoothly between anchors. Real time is performance.timeOrigin +
// performance.now(), which all windows of one browser share.



export interface ClockAnchor {
    simElapsedSeconds: number;
    isSimPlaying: boolean;
    simSpeedMultiplier: number;
    sentAtRealMs: number;
}

// The leader sends an anchor at least this often while the clock plays.
export const ANCHOR_INTERVAL_MS = 500;

// Smallest sim jump (seconds) that counts as a scrub or reset while the clock plays.
const MIN_JUMP_TOLERANCE_S = 2;
// While paused any real change counts as a jump.
const PAUSED_JUMP_TOLERANCE_S = 0.001;



// Shared real time: the same on every window of this browser.
export function sharedRealTimeMs(): number {
    return performance.timeOrigin + performance.now();
}


// Simulated seconds now, from the last anchor, clamped to [0, limitSeconds].
export function extrapolateElapsed(anchor: ClockAnchor, nowRealMs: number, limitSeconds: number): number {
    let elapsed = anchor.simElapsedSeconds;
    if (anchor.isSimPlaying) {
        const realSecondsSinceAnchor = Math.max(0, (nowRealMs - anchor.sentAtRealMs) / 1000);
        elapsed = anchor.simElapsedSeconds + realSecondsSinceAnchor * anchor.simSpeedMultiplier;
    }
    return Math.min(Math.max(elapsed, 0), limitSeconds);
}


// Did the local clock move by something other than normal ticking (a scrub or a reset)?
export function isClockJump(
    anchor: ClockAnchor | null,
    elapsedSeconds: number,
    isPlaying: boolean,
    speedMultiplier: number,
    nowRealMs: number,
    limitSeconds: number,
): boolean {
    if (anchor === null) {
        return true;
    }
    const expected = extrapolateElapsed(anchor, nowRealMs, limitSeconds);
    let tolerance = PAUSED_JUMP_TOLERANCE_S;
    if (isPlaying) {
        tolerance = Math.max(MIN_JUMP_TOLERANCE_S, 0.5 * speedMultiplier);
    }
    return Math.abs(elapsedSeconds - expected) > tolerance;
}
