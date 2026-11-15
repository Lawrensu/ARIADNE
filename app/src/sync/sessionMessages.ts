// Message types for the session sync between windows (D-032). Pure: no React, no store, no browser APIs,
// so it can be tested in node. Every message travels on one BroadcastChannel (same browser only,
// no server, nothing leaves the machine).

import type { ClockAnchor } from "./clockAnchor";
import type { LeaderClaim } from "./leaderElection";



export const SESSION_CHANNEL_NAME = "ariadne_session_v1";



export type SessionMessageKind =
    | "hello"
    | "heartbeat"
    | "leader_claim"
    | "clock_anchor"
    | "state_patch"
    | "state_snapshot"
    | "goodbye";


// Values of the shared store fields, keyed by field name (see SHARED_STATE_FIELDS).
export type SharedFieldValues = Record<string, unknown>;


export interface HelloMessage {
    kind: "hello";
    senderId: string;
}

export interface HeartbeatMessage {
    kind: "heartbeat";
    senderId: string;
    // The newest leader claim this window knows about, so a joining window learns who leads.
    leaderClaim: LeaderClaim | null;
}

export interface LeaderClaimMessage {
    kind: "leader_claim";
    senderId: string;
    claim: LeaderClaim;
}

export interface ClockAnchorMessage {
    kind: "clock_anchor";
    senderId: string;
    anchor: ClockAnchor;
}

export interface StatePatchMessage {
    kind: "state_patch";
    senderId: string;
    fields: SharedFieldValues;
}

// The answer to "hello": every shared field, the clock anchor and the leader claim, for one window.
export interface StateSnapshotMessage {
    kind: "state_snapshot";
    senderId: string;
    targetId: string;
    fields: SharedFieldValues;
    anchor: ClockAnchor;
    leaderClaim: LeaderClaim | null;
}

export interface GoodbyeMessage {
    kind: "goodbye";
    senderId: string;
}


export type SessionMessage =
    | HelloMessage
    | HeartbeatMessage
    | LeaderClaimMessage
    | ClockAnchorMessage
    | StatePatchMessage
    | StateSnapshotMessage
    | GoodbyeMessage;



// Store fields shared between windows (everything else, such as view, camera, panels, layers and HUD
// sheets, stays per window). The clock fields travel as a clock anchor, not as patches.
export const CLOCK_FIELDS: string[] = ["simElapsedSeconds", "isSimPlaying", "simSpeedMultiplier"];

export const SHARED_STATE_FIELDS: string[] = [
    "sciencePlanStops",
    "sciencePlan",
    "completedTaskIds",
    "walkStartedAtSimSeconds",
    "walkPlanSnapshot",
    "walkDetour",
    "walkTrail",
    "alerts",
    "dismissedAlertIds",
    "activeScenarioId",
    "scenarioStatus",
    "scenarioEventIndex",
    "scenarioRunCount",
    "routeStart",
    "routeEnd",
    "routePlans",
    "selectedRouteOption",
];

// Shared fields that the leader's own automatic work changes (or that are small user conveniences).
// A change to these alone never makes a window the leader.
export const NON_CLAIMING_FIELDS: string[] = ["walkTrail", "alerts", "dismissedAlertIds"];



function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}


function isLeaderClaim(value: unknown): value is LeaderClaim {
    return isRecord(value) && typeof value.windowId === "string" && typeof value.claimedAtMs === "number";
}


function isClockAnchor(value: unknown): value is ClockAnchor {
    return (
        isRecord(value) &&
        typeof value.simElapsedSeconds === "number" &&
        typeof value.isSimPlaying === "boolean" &&
        typeof value.simSpeedMultiplier === "number" &&
        typeof value.sentAtRealMs === "number"
    );
}


// Checks the shape of anything that arrives on the channel. Returns null for anything unknown.
export function parseSessionMessage(data: unknown): SessionMessage | null {
    if (!isRecord(data) || typeof data.kind !== "string" || typeof data.senderId !== "string") {
        return null;
    }
    const senderId = data.senderId;

    if (data.kind === "hello") {
        return { kind: "hello", senderId };
    }
    if (data.kind === "goodbye") {
        return { kind: "goodbye", senderId };
    }
    if (data.kind === "heartbeat") {
        let claim: LeaderClaim | null = null;
        if (isLeaderClaim(data.leaderClaim)) {
            claim = data.leaderClaim;
        }
        return { kind: "heartbeat", senderId, leaderClaim: claim };
    }
    if (data.kind === "leader_claim") {
        if (!isLeaderClaim(data.claim)) {
            return null;
        }
        return { kind: "leader_claim", senderId, claim: data.claim };
    }
    if (data.kind === "clock_anchor") {
        if (!isClockAnchor(data.anchor)) {
            return null;
        }
        return { kind: "clock_anchor", senderId, anchor: data.anchor };
    }
    if (data.kind === "state_patch") {
        if (!isRecord(data.fields)) {
            return null;
        }
        return { kind: "state_patch", senderId, fields: data.fields };
    }
    if (data.kind === "state_snapshot") {
        if (typeof data.targetId !== "string" || !isRecord(data.fields) || !isClockAnchor(data.anchor)) {
            return null;
        }
        let claim: LeaderClaim | null = null;
        if (isLeaderClaim(data.leaderClaim)) {
            claim = data.leaderClaim;
        }
        return {
            kind: "state_snapshot",
            senderId,
            targetId: data.targetId,
            fields: data.fields,
            anchor: data.anchor,
            leaderClaim: claim,
        };
    }
    return null;
}
