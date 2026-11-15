// Session sync controller (D-032): the logic behind useSessionSync(), free of React and of the real
// store and channel so it can be tested with fake ones. It watches the shared store fields, sends what
// this window's user changed, applies what other windows changed (never re-broadcasting it), keeps the
// leader election and the clock anchor.
//
// Time is driven from outside: call tick() often (every animation frame and every 250 ms).

import { ANCHOR_INTERVAL_MS, extrapolateElapsed, isClockJump } from "./clockAnchor";
import type { ClockAnchor } from "./clockAnchor";
import { isLeaderWindow, liveWindowIds, newerClaim, nextClaimTimeMs } from "./leaderElection";
import type { LeaderClaim } from "./leaderElection";
import { CLOCK_FIELDS, NON_CLAIMING_FIELDS, SHARED_STATE_FIELDS, parseSessionMessage } from "./sessionMessages";
import type { SessionMessage, SharedFieldValues } from "./sessionMessages";



export const HEARTBEAT_INTERVAL_MS = 1000;
// The walk trail is sent at most this often.
export const TRAIL_INTERVAL_MS = 1000;
// Local changes are ignored (not sent, no leadership claim) until the data has been loaded this long,
// so a window that is still starting up never takes over a running session.
export const ARM_DELAY_MS = 1000;



// The store as the controller sees it. The real one wraps the Zustand store (sessionSync.ts).
export interface StoreAdapter {
    getValue: (field: string) => unknown;
    setValues: (values: Record<string, unknown>) => void;
    subscribe: (listener: () => void) => () => void;
    // True once the Marswalk data has loaded.
    isDataReady: () => boolean;
    // Suit capability in simulated seconds: the clock never runs past it.
    getClockLimitSeconds: () => number;
}


// The channel as the controller sees it. The real one wraps a BroadcastChannel, which never delivers
// a window's own messages back to it.
export interface ChannelAdapter {
    post: (message: SessionMessage) => void;
    listen: (listener: (data: unknown) => void) => void;
    close: () => void;
}


export interface SessionControllerOptions {
    windowId: string;
    store: StoreAdapter;
    channel: ChannelAdapter;
    nowMs: () => number;
}


export interface SessionController {
    start: () => void;
    tick: () => void;
    stop: () => void;
}



const WATCHED_FIELDS: string[] = [...SHARED_STATE_FIELDS, ...CLOCK_FIELDS];
// Fields whose echo is checked: a local recomputation that gives the same value as the last remote
// value is not a user action (for example the plan panel recomputing the plan after a remote edit).
const ECHO_CHECKED_FIELDS: string[] = SHARED_STATE_FIELDS.filter((field) => !NON_CLAIMING_FIELDS.includes(field));



function serialise(value: unknown): string | null {
    try {
        return JSON.stringify(value) ?? null;
    } catch {
        return null;
    }
}



export function createSessionController(options: SessionControllerOptions): SessionController {
    const { windowId, store, channel, nowMs } = options;

    const lastHeardMsByWindow = new Map<string, number>();
    const lastRemoteJsonByField = new Map<string, string>();
    const pendingPatchFields = new Set<string>();
    let previousValues: Record<string, unknown> = {};
    let leaderClaim: LeaderClaim | null = null;
    let clockAnchor: ClockAnchor | null = null;
    let isApplyingRemote = false;
    let isPatchFlushScheduled = false;
    let isTrailDirty = false;
    let dataReadySinceMs: number | null = null;
    let lastHeartbeatMs = 0;
    let lastAnchorSentMs = 0;
    let lastTrailSentMs = 0;
    let lastTrailLengthSent = 0;
    let unsubscribe: (() => void) | null = null;
    let isRunning = false;



    function readWatchedValues(): Record<string, unknown> {
        const values: Record<string, unknown> = {};
        for (const field of WATCHED_FIELDS) {
            values[field] = store.getValue(field);
        }
        return values;
    }


    function hasPeers(): boolean {
        return liveWindowIds(lastHeardMsByWindow, nowMs()).length > 0;
    }


    function isLeader(): boolean {
        return store.getValue("isSessionLeader") === true;
    }


    function holdsClaim(): boolean {
        return leaderClaim !== null && leaderClaim.windowId === windowId;
    }


    function isArmed(): boolean {
        if (!store.isDataReady()) {
            dataReadySinceMs = null;
            return false;
        }
        if (dataReadySinceMs === null) {
            dataReadySinceMs = nowMs();
        }
        return nowMs() - dataReadySinceMs >= ARM_DELAY_MS;
    }


    // Writes values that came from another window. Store listeners (this controller's too) see the
    // flag and ignore the change, so applying never sends anything back.
    function applyRemoteValues(values: Record<string, unknown>): void {
        isApplyingRemote = true;
        try {
            store.setValues(values);
        } finally {
            previousValues = readWatchedValues();
            isApplyingRemote = false;
        }
    }



    function buildAnchor(): ClockAnchor {
        return {
            simElapsedSeconds: Number(store.getValue("simElapsedSeconds")),
            isSimPlaying: store.getValue("isSimPlaying") === true,
            simSpeedMultiplier: Number(store.getValue("simSpeedMultiplier")),
            sentAtRealMs: nowMs(),
        };
    }


    function sendClockAnchor(): void {
        clockAnchor = buildAnchor();
        lastAnchorSentMs = nowMs();
        if (hasPeers()) {
            channel.post({ kind: "clock_anchor", senderId: windowId, anchor: clockAnchor });
        }
    }


    function readSharedFields(fieldNames: string[]): SharedFieldValues {
        const fields: SharedFieldValues = {};
        for (const field of fieldNames) {
            fields[field] = store.getValue(field);
        }
        return fields;
    }


    function sendSnapshot(targetId: string): void {
        channel.post({
            kind: "state_snapshot",
            senderId: windowId,
            targetId,
            fields: readSharedFields(SHARED_STATE_FIELDS),
            anchor: buildAnchor(),
            leaderClaim,
        });
    }


    function flushPendingPatch(): void {
        isPatchFlushScheduled = false;
        if (pendingPatchFields.size === 0) {
            return;
        }
        const fieldNames = [...pendingPatchFields];
        pendingPatchFields.clear();
        if (hasPeers()) {
            channel.post({ kind: "state_patch", senderId: windowId, fields: readSharedFields(fieldNames) });
        }
    }


    function queuePatchField(field: string): void {
        pendingPatchFields.add(field);
        if (!isPatchFlushScheduled) {
            isPatchFlushScheduled = true;
            queueMicrotask(flushPendingPatch);
        }
    }



    // Updates isSessionLeader and the window count from what this window knows now.
    function refreshLeaderState(): void {
        const livePeerIds = liveWindowIds(lastHeardMsByWindow, nowMs());
        const shouldLead = isLeaderWindow(windowId, leaderClaim, livePeerIds);
        const wasLeader = isLeader();
        const values: Record<string, unknown> = {};
        if (shouldLead !== wasLeader) {
            values.isSessionLeader = shouldLead;
        }
        if (store.getValue("connectedWindowCount") !== livePeerIds.length) {
            values.connectedWindowCount = livePeerIds.length;
        }
        if (Object.keys(values).length > 0) {
            applyRemoteValues(values);
        }
        if (shouldLead && !wasLeader) {
            // Took over (the old leader went quiet or a newer claim lost): publish the clock we hold.
            sendClockAnchor();
        }
    }


    function claimLeadership(): void {
        leaderClaim = { windowId, claimedAtMs: nextClaimTimeMs(nowMs(), leaderClaim) };
        channel.post({ kind: "leader_claim", senderId: windowId, claim: leaderClaim });
        if (!isLeader()) {
            applyRemoteValues({ isSessionLeader: true });
        }
        sendClockAnchor();
    }



    // Reacts to a store change. Changes made while applying a remote message are not user actions.
    function onStoreChange(): void {
        const currentValues = readWatchedValues();
        const changedFields: string[] = [];
        for (const field of WATCHED_FIELDS) {
            if (currentValues[field] !== previousValues[field]) {
                changedFields.push(field);
            }
        }
        previousValues = currentValues;
        if (isApplyingRemote || changedFields.length === 0 || !isArmed()) {
            return;
        }

        // A recomputation that equals the last remote value is not a user action.
        const localFields: string[] = [];
        for (const field of changedFields) {
            if (ECHO_CHECKED_FIELDS.includes(field) && lastRemoteJsonByField.has(field)) {
                if (serialise(currentValues[field]) === lastRemoteJsonByField.get(field)) {
                    continue;
                }
                lastRemoteJsonByField.delete(field);
            }
            localFields.push(field);
        }

        const didPlayOrSpeedChange = localFields.includes("isSimPlaying") || localFields.includes("simSpeedMultiplier");
        let didClockJump = false;
        if (!didPlayOrSpeedChange && localFields.includes("simElapsedSeconds")) {
            didClockJump = isClockJump(
                clockAnchor,
                Number(currentValues.simElapsedSeconds),
                currentValues.isSimPlaying === true,
                Number(currentValues.simSpeedMultiplier),
                nowMs(),
                store.getClockLimitSeconds(),
            );
        }
        let didSharedStateChange = false;
        for (const field of localFields) {
            if (SHARED_STATE_FIELDS.includes(field) && !NON_CLAIMING_FIELDS.includes(field)) {
                didSharedStateChange = true;
            }
        }
        const isUserAction = didPlayOrSpeedChange || didClockJump || didSharedStateChange;

        let didClaim = false;
        // Also a lone window that is leader only by default claims, so a window joining later knows who leads.
        if (isUserAction && !holdsClaim()) {
            claimLeadership();
            didClaim = true;
        }
        if ((didPlayOrSpeedChange || didClockJump) && !didClaim) {
            sendClockAnchor();
        }

        for (const field of localFields) {
            if (!SHARED_STATE_FIELDS.includes(field)) {
                continue;
            }
            if (field === "walkTrail") {
                handleLocalTrailChange(currentValues.walkTrail);
            } else {
                queuePatchField(field);
            }
        }
    }


    // Only the leader sends the trail, and at most once a second; a shorter trail (a reset) goes at once.
    function handleLocalTrailChange(trail: unknown): void {
        if (!isLeader()) {
            return;
        }
        let length = 0;
        if (Array.isArray(trail)) {
            length = trail.length;
        }
        const didShrink = length < lastTrailLengthSent || length === 0;
        lastTrailLengthSent = length;
        if (didShrink) {
            queuePatchField("walkTrail");
            lastTrailSentMs = nowMs();
            isTrailDirty = false;
            return;
        }
        isTrailDirty = true;
    }



    function handleMessage(message: SessionMessage): void {
        const now = nowMs();
        const isNewPeer = !liveWindowIds(lastHeardMsByWindow, now).includes(message.senderId);
        if (message.kind === "goodbye") {
            lastHeardMsByWindow.delete(message.senderId);
            refreshLeaderState();
            return;
        }
        lastHeardMsByWindow.set(message.senderId, now);

        if (message.kind === "hello") {
            refreshLeaderState();
            if (isLeader()) {
                sendSnapshot(message.senderId);
            }
            return;
        }

        if (message.kind === "heartbeat") {
            leaderClaim = newerClaim(leaderClaim, message.leaderClaim);
        } else if (message.kind === "leader_claim") {
            leaderClaim = newerClaim(leaderClaim, message.claim);
        } else if (message.kind === "clock_anchor") {
            applyClockAnchorMessage(message.senderId, message.anchor);
        } else if (message.kind === "state_patch") {
            applyFieldValues(message.fields);
        } else if (message.kind === "state_snapshot") {
            if (message.targetId !== windowId) {
                return;
            }
            leaderClaim = newerClaim(leaderClaim, message.leaderClaim);
            applyFieldValues(message.fields);
            clockAnchor = message.anchor;
            applyClockAnchorValues(message.anchor);
        }

        refreshLeaderState();
        // A window we had lost touch with (or not yet met) gets the full state from the leader.
        if (isNewPeer && isLeader() && message.kind !== "state_snapshot") {
            sendSnapshot(message.senderId);
        }
    }


    function applyFieldValues(fields: SharedFieldValues): void {
        const accepted: Record<string, unknown> = {};
        for (const field of SHARED_STATE_FIELDS) {
            if (!(field in fields)) {
                continue;
            }
            accepted[field] = fields[field];
            if (ECHO_CHECKED_FIELDS.includes(field)) {
                const json = serialise(fields[field]);
                if (json !== null) {
                    lastRemoteJsonByField.set(field, json);
                }
            }
        }
        if ("sciencePlan" in accepted) {
            // The plan status is per window (not shared); keep it consistent with the plan we received.
            accepted.sciencePlanStatus = accepted.sciencePlan === null ? "idle" : "plan_ready";
            accepted.sciencePlanError = null;
        }
        if (Object.keys(accepted).length > 0) {
            applyRemoteValues(accepted);
        }
    }


    function applyClockAnchorValues(anchor: ClockAnchor): void {
        applyRemoteValues({
            isSimPlaying: anchor.isSimPlaying,
            simSpeedMultiplier: anchor.simSpeedMultiplier,
            simElapsedSeconds: extrapolateElapsed(anchor, nowMs(), store.getClockLimitSeconds()),
        });
    }


    // Only a follower takes the clock from an anchor, and only from the window that holds the claim.
    function applyClockAnchorMessage(senderId: string, anchor: ClockAnchor): void {
        if (isLeader()) {
            return;
        }
        if (leaderClaim !== null && leaderClaim.windowId !== senderId) {
            return;
        }
        clockAnchor = anchor;
        applyClockAnchorValues(anchor);
    }



    function onChannelData(data: unknown): void {
        const message = parseSessionMessage(data);
        if (message === null || message.senderId === windowId) {
            return;
        }
        handleMessage(message);
    }


    function tick(): void {
        if (!isRunning) {
            return;
        }
        const now = nowMs();
        isArmed();

        if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
            lastHeartbeatMs = now;
            channel.post({ kind: "heartbeat", senderId: windowId, leaderClaim });
        }
        refreshLeaderState();

        if (isLeader()) {
            const isPlaying = store.getValue("isSimPlaying") === true;
            if (holdsClaim() && isPlaying && now - lastAnchorSentMs >= ANCHOR_INTERVAL_MS) {
                sendClockAnchor();
            }
            if (isTrailDirty && now - lastTrailSentMs >= TRAIL_INTERVAL_MS) {
                isTrailDirty = false;
                lastTrailSentMs = now;
                queuePatchField("walkTrail");
            }
            return;
        }

        // Follower: the clock follows the leader's anchor, extrapolated to now.
        if (clockAnchor !== null) {
            const elapsed = extrapolateElapsed(clockAnchor, now, store.getClockLimitSeconds());
            if (elapsed !== store.getValue("simElapsedSeconds")) {
                applyRemoteValues({ simElapsedSeconds: elapsed });
            }
        }
    }


    function start(): void {
        if (isRunning) {
            return;
        }
        isRunning = true;
        previousValues = readWatchedValues();
        channel.listen(onChannelData);
        unsubscribe = store.subscribe(onStoreChange);
        lastHeartbeatMs = nowMs();
        channel.post({ kind: "hello", senderId: windowId });
        channel.post({ kind: "heartbeat", senderId: windowId, leaderClaim });
    }


    function stop(): void {
        if (!isRunning) {
            return;
        }
        isRunning = false;
        if (unsubscribe !== null) {
            unsubscribe();
            unsubscribe = null;
        }
        channel.post({ kind: "goodbye", senderId: windowId });
        channel.close();
        applyRemoteValues({ isSessionLeader: true, connectedWindowCount: 0 });
    }


    return { start, tick, stop };
}
