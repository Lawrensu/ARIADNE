// Leader election between windows (D-032). Pure functions.
//
// Exactly one window drives the clock, the scenario and the walk (the leader). A window claims
// leadership when its user acts on the shared walk. The most recent claim wins; equal timestamps are
// broken by window id (the greater id wins). Alone, or when the claimant has gone quiet, the rules
// below still give every window the same answer.



// A window is considered gone when nothing was heard from it for this long (heartbeat is 1 s).
export const PEER_TIMEOUT_MS = 3000;


export interface LeaderClaim {
    windowId: string;
    // Real time (shared time base of all windows) at which the user acted.
    claimedAtMs: number;
}



// Positive when a wins, negative when b wins, 0 only for the same claim.
export function compareClaims(a: LeaderClaim, b: LeaderClaim): number {
    if (a.claimedAtMs !== b.claimedAtMs) {
        return a.claimedAtMs - b.claimedAtMs;
    }
    if (a.windowId === b.windowId) {
        return 0;
    }
    if (a.windowId > b.windowId) {
        return 1;
    }
    return -1;
}


// The newer of two claims (either may be missing).
export function newerClaim(current: LeaderClaim | null, incoming: LeaderClaim | null): LeaderClaim | null {
    if (incoming === null) {
        return current;
    }
    if (current === null) {
        return incoming;
    }
    if (compareClaims(incoming, current) > 0) {
        return incoming;
    }
    return current;
}


// A claim time that beats the current claim even when the clocks read the same.
export function nextClaimTimeMs(nowMs: number, current: LeaderClaim | null): number {
    if (current === null) {
        return nowMs;
    }
    return Math.max(nowMs, current.claimedAtMs + 1);
}


// Ids of the other windows heard from within the timeout.
export function liveWindowIds(lastHeardMsByWindow: Map<string, number>, nowMs: number): string[] {
    const live: string[] = [];
    for (const [windowId, lastHeardMs] of lastHeardMsByWindow) {
        if (nowMs - lastHeardMs <= PEER_TIMEOUT_MS) {
            live.push(windowId);
        }
    }
    return live;
}


// Is this window the leader?
//   1. Alone: yes.
//   2. The newest claim belongs to this window or to a live window: that window leads.
//   3. No claim, or the claimant is gone: the greatest window id among the live windows leads.
export function isLeaderWindow(selfId: string, newestClaim: LeaderClaim | null, livePeerIds: string[]): boolean {
    if (livePeerIds.length === 0) {
        return true;
    }
    if (newestClaim !== null) {
        if (newestClaim.windowId === selfId) {
            return true;
        }
        if (livePeerIds.includes(newestClaim.windowId)) {
            return false;
        }
    }
    for (const peerId of livePeerIds) {
        if (peerId > selfId) {
            return false;
        }
    }
    return true;
}
