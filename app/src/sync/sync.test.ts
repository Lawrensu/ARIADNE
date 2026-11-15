import { describe, expect, it } from "vitest";

import { extrapolateElapsed, isClockJump } from "./clockAnchor";
import type { ClockAnchor } from "./clockAnchor";
import { compareClaims, isLeaderWindow, liveWindowIds, newerClaim, nextClaimTimeMs, PEER_TIMEOUT_MS } from "./leaderElection";
import { ARM_DELAY_MS, createSessionController, HEARTBEAT_INTERVAL_MS } from "./sessionController";
import type { ChannelAdapter, SessionController, StoreAdapter } from "./sessionController";
import { parseSessionMessage } from "./sessionMessages";
import type { SessionMessage } from "./sessionMessages";



describe("leader election", () => {
    it("the later claim wins and equal times go to the greater window id", () => {
        expect(compareClaims({ windowId: "a", claimedAtMs: 2 }, { windowId: "b", claimedAtMs: 1 })).toBeGreaterThan(0);
        expect(compareClaims({ windowId: "a", claimedAtMs: 1 }, { windowId: "b", claimedAtMs: 1 })).toBeLessThan(0);
        expect(compareClaims({ windowId: "b", claimedAtMs: 1 }, { windowId: "b", claimedAtMs: 1 })).toBe(0);
        const winner = newerClaim({ windowId: "a", claimedAtMs: 5 }, { windowId: "b", claimedAtMs: 5 });
        expect(winner?.windowId).toBe("b");
        expect(newerClaim(null, null)).toBeNull();
    });

    it("a new claim always beats the current one", () => {
        expect(nextClaimTimeMs(100, null)).toBe(100);
        expect(nextClaimTimeMs(100, { windowId: "x", claimedAtMs: 100 })).toBe(101);
        expect(nextClaimTimeMs(100, { windowId: "x", claimedAtMs: 50 })).toBe(100);
    });

    it("alone is always leader; otherwise the claimant leads while it is alive", () => {
        expect(isLeaderWindow("a", null, [])).toBe(true);
        expect(isLeaderWindow("a", { windowId: "b", claimedAtMs: 1 }, [])).toBe(true);
        expect(isLeaderWindow("a", { windowId: "b", claimedAtMs: 1 }, ["b"])).toBe(false);
        expect(isLeaderWindow("a", { windowId: "a", claimedAtMs: 1 }, ["b"])).toBe(true);
    });

    it("without a live claimant the greatest window id leads", () => {
        expect(isLeaderWindow("a", null, ["b"])).toBe(false);
        expect(isLeaderWindow("b", null, ["a"])).toBe(true);
        expect(isLeaderWindow("a", { windowId: "gone", claimedAtMs: 1 }, ["b"])).toBe(false);
        expect(isLeaderWindow("c", { windowId: "gone", claimedAtMs: 1 }, ["b"])).toBe(true);
    });

    it("drops windows not heard from within the timeout", () => {
        const heard = new Map<string, number>([["fresh", 9000], ["old", 1000]]);
        expect(liveWindowIds(heard, 9000 + PEER_TIMEOUT_MS - 1)).toEqual(["fresh"]);
    });
});



describe("clock anchor", () => {
    const anchor: ClockAnchor = { simElapsedSeconds: 100, isSimPlaying: true, simSpeedMultiplier: 60, sentAtRealMs: 10_000 };

    it("extrapolates while playing and holds while paused", () => {
        expect(extrapolateElapsed(anchor, 12_000, 1e9)).toBeCloseTo(220, 6);
        expect(extrapolateElapsed({ ...anchor, isSimPlaying: false }, 12_000, 1e9)).toBe(100);
        expect(extrapolateElapsed(anchor, 9_000, 1e9)).toBe(100);
    });

    it("clamps to the limit", () => {
        expect(extrapolateElapsed(anchor, 12_000, 150)).toBe(150);
    });

    it("tells ticking from a jump", () => {
        expect(isClockJump(anchor, 220.5, true, 60, 12_000, 1e9)).toBe(false);
        expect(isClockJump(anchor, 0, true, 60, 12_000, 1e9)).toBe(true);
        expect(isClockJump(null, 5, false, 60, 12_000, 1e9)).toBe(true);
        const paused = { ...anchor, isSimPlaying: false };
        expect(isClockJump(paused, 100, false, 60, 12_000, 1e9)).toBe(false);
        expect(isClockJump(paused, 130, false, 60, 12_000, 1e9)).toBe(true);
    });
});



describe("message parsing", () => {
    it("accepts known kinds and rejects malformed data", () => {
        expect(parseSessionMessage({ kind: "hello", senderId: "a" })).toEqual({ kind: "hello", senderId: "a" });
        expect(parseSessionMessage({ kind: "state_patch", senderId: "a", fields: { x: 1 } })?.kind).toBe("state_patch");
        expect(parseSessionMessage({ kind: "leader_claim", senderId: "a" })).toBeNull();
        expect(parseSessionMessage({ kind: "clock_anchor", senderId: "a", anchor: { simElapsedSeconds: 1 } })).toBeNull();
        expect(parseSessionMessage({ kind: "nope", senderId: "a" })).toBeNull();
        expect(parseSessionMessage("hello")).toBeNull();
        expect(parseSessionMessage(null)).toBeNull();
    });
});



// ---- Two controllers on fake channels and fake stores ----

class FakeHub {
    private readonly listeners = new Map<string, (data: unknown) => void>();
    readonly sent: SessionMessage[] = [];

    createChannel(windowId: string): ChannelAdapter {
        return {
            post: (message) => {
                this.sent.push(message);
                // A real BroadcastChannel delivers a structured copy to the other windows only.
                const copy = JSON.parse(JSON.stringify(message)) as unknown;
                for (const [otherId, listener] of this.listeners) {
                    if (otherId !== windowId) {
                        listener(copy);
                    }
                }
            },
            listen: (listener) => {
                this.listeners.set(windowId, listener);
            },
            close: () => {
                this.listeners.delete(windowId);
            },
        };
    }

    countOf(kind: string, senderId?: string): number {
        return this.sent.filter((message) => message.kind === kind && (senderId === undefined || message.senderId === senderId)).length;
    }
}


class FakeStore {
    values: Record<string, unknown> = {
        simElapsedSeconds: 0,
        isSimPlaying: false,
        simSpeedMultiplier: 60,
        sciencePlanStops: [],
        sciencePlan: null,
        completedTaskIds: [],
        walkStartedAtSimSeconds: null,
        walkPlanSnapshot: null,
        walkDetour: null,
        walkTrail: [],
        alerts: [],
        dismissedAlertIds: [],
        activeScenarioId: null,
        scenarioStatus: "idle",
        scenarioEventIndex: 0,
        scenarioRunCount: 0,
        routeStart: null,
        routeEnd: null,
        routePlans: {},
        selectedRouteOption: "fast",
        isSessionLeader: true,
        connectedWindowCount: 0,
    };
    private readonly listeners = new Set<() => void>();

    // What the app does on a user action or a driver tick.
    set(values: Record<string, unknown>): void {
        Object.assign(this.values, values);
        for (const listener of [...this.listeners]) {
            listener();
        }
    }

    adapter(): StoreAdapter {
        return {
            getValue: (field) => this.values[field],
            setValues: (values) => this.set(values),
            subscribe: (listener) => {
                this.listeners.add(listener);
                return () => this.listeners.delete(listener);
            },
            isDataReady: () => true,
            getClockLimitSeconds: () => 8 * 3600,
        };
    }
}


interface TestWindow {
    id: string;
    store: FakeStore;
    controller: SessionController;
}


class TestSession {
    nowMs = 1_000_000;
    readonly hub = new FakeHub();
    readonly windows: TestWindow[] = [];

    open(id: string): TestWindow {
        const store = new FakeStore();
        const controller = createSessionController({
            windowId: id,
            store: store.adapter(),
            channel: this.hub.createChannel(id),
            nowMs: () => this.nowMs,
        });
        const testWindow = { id, store, controller };
        this.windows.push(testWindow);
        controller.start();
        controller.tick();
        return testWindow;
    }

    // Advances time in 250 ms steps, ticking every window and letting microtasks (patch flushes) run.
    async advance(milliseconds: number): Promise<void> {
        const steps = Math.ceil(milliseconds / 250);
        for (let step = 0; step < steps; step++) {
            this.nowMs += 250;
            for (const testWindow of this.windows) {
                // The leader's clock driver: elapsed grows by real delta x speed while playing.
                const store = testWindow.store;
                if (store.values.isSessionLeader === true && store.values.isSimPlaying === true) {
                    store.set({ simElapsedSeconds: Number(store.values.simElapsedSeconds) + 0.25 * Number(store.values.simSpeedMultiplier) });
                }
            }
            for (const testWindow of this.windows) {
                testWindow.controller.tick();
            }
            await Promise.resolve();
        }
    }
}


async function sessionWithTwoWindows(): Promise<{ session: TestSession; a: TestWindow; b: TestWindow }> {
    const session = new TestSession();
    const a = session.open("window_a");
    const b = session.open("window_b");
    await session.advance(ARM_DELAY_MS + HEARTBEAT_INTERVAL_MS);
    return { session, a, b };
}


describe("session controller", () => {
    it("a window alone is leader", () => {
        const session = new TestSession();
        const a = session.open("window_a");
        expect(a.store.values.isSessionLeader).toBe(true);
        expect(a.store.values.connectedWindowCount).toBe(0);
    });

    it("two idle windows agree on one leader and count each other", async () => {
        const { a, b } = await sessionWithTwoWindows();
        expect(a.store.values.connectedWindowCount).toBe(1);
        expect(b.store.values.connectedWindowCount).toBe(1);
        expect(a.store.values.isSessionLeader).not.toBe(b.store.values.isSessionLeader);
        // The greatest id leads when nobody has claimed.
        expect(b.store.values.isSessionLeader).toBe(true);
    });

    it("a user action makes that window leader and its change reaches the other window once", async () => {
        const { session, a, b } = await sessionWithTwoWindows();
        const stops = [{ knot_id: "knot_1", chosen_task_ids: ["task_1"] }];
        a.store.set({ sciencePlanStops: stops });
        await session.advance(250);

        expect(a.store.values.isSessionLeader).toBe(true);
        expect(b.store.values.isSessionLeader).toBe(false);
        expect(b.store.values.sciencePlanStops).toEqual(stops);
        // The receiver applied it without sending it back.
        expect(session.hub.countOf("state_patch", "window_b")).toBe(0);
        expect(session.hub.countOf("state_patch", "window_a")).toBe(1);
    });

    it("the other window taking an action takes the lead and the clock", async () => {
        const { session, a, b } = await sessionWithTwoWindows();
        a.store.set({ isSimPlaying: true, simSpeedMultiplier: 60 });
        await session.advance(2000);
        expect(a.store.values.isSessionLeader).toBe(true);
        expect(b.store.values.isSimPlaying).toBe(true);

        // The follower mirrors the leader's clock by extrapolating from the anchor.
        a.store.set({ simElapsedSeconds: 120 });
        await session.advance(250);
        const followerElapsed = Number(b.store.values.simElapsedSeconds);
        expect(followerElapsed).toBeGreaterThan(100);

        b.store.set({ isSimPlaying: false });
        await session.advance(250);
        expect(b.store.values.isSessionLeader).toBe(true);
        expect(a.store.values.isSessionLeader).toBe(false);
        expect(a.store.values.isSimPlaying).toBe(false);
        expect(a.store.values.simElapsedSeconds).toBe(b.store.values.simElapsedSeconds);
    });

    it("a follower's clock advances smoothly between anchors", async () => {
        const { session, a, b } = await sessionWithTwoWindows();
        a.store.set({ isSimPlaying: true });
        await session.advance(250);
        const first = Number(b.store.values.simElapsedSeconds);
        await session.advance(250);
        const second = Number(b.store.values.simElapsedSeconds);
        // 250 ms real at 60x = 15 s simulated.
        expect(second - first).toBeGreaterThan(14);
        expect(second - first).toBeLessThan(16);
    });

    it("a leader scrub is sent as a clock jump", async () => {
        const { session, a, b } = await sessionWithTwoWindows();
        a.store.set({ sciencePlanStops: [{ knot_id: "k", chosen_task_ids: [] }] });
        await session.advance(250);
        a.store.set({ simElapsedSeconds: 5000 });
        await session.advance(250);
        expect(b.store.values.simElapsedSeconds).toBe(5000);
    });

    it("a window that joins late gets the full state from the leader", async () => {
        const session = new TestSession();
        const a = session.open("window_a");
        await session.advance(ARM_DELAY_MS + 250);
        const alerts = [{ alert_id: "walk_started" }];
        a.store.set({ alerts, completedTaskIds: ["task_1"], isSimPlaying: true, simElapsedSeconds: 900 });
        await session.advance(500);

        const b = session.open("window_b");
        await session.advance(250);
        expect(b.store.values.alerts).toEqual(alerts);
        expect(b.store.values.completedTaskIds).toEqual(["task_1"]);
        expect(b.store.values.isSimPlaying).toBe(true);
        expect(Number(b.store.values.simElapsedSeconds)).toBeGreaterThan(900);
        expect(b.store.values.isSessionLeader).toBe(false);
        expect(a.store.values.isSessionLeader).toBe(true);
    });

    it("the follower takes over when the leader goes quiet", async () => {
        const { session, a, b } = await sessionWithTwoWindows();
        a.store.set({ sciencePlanStops: [{ knot_id: "k", chosen_task_ids: [] }] });
        await session.advance(250);
        expect(b.store.values.isSessionLeader).toBe(false);

        // Window a closes without a goodbye (crash): drop it from the session.
        session.windows.splice(session.windows.indexOf(a), 1);
        await session.advance(4000);
        expect(b.store.values.isSessionLeader).toBe(true);
        expect(b.store.values.connectedWindowCount).toBe(0);
    });

    it("a window closing with a goodbye hands over at once", async () => {
        const { session, a, b } = await sessionWithTwoWindows();
        a.store.set({ sciencePlanStops: [{ knot_id: "k", chosen_task_ids: [] }] });
        await session.advance(250);
        a.controller.stop();
        session.windows.splice(session.windows.indexOf(a), 1);
        await session.advance(250);
        expect(b.store.values.isSessionLeader).toBe(true);
    });

    it("a local recomputation equal to the remote value does not take the lead", async () => {
        const { session, a, b } = await sessionWithTwoWindows();
        const plan = { total_plan_time_s: 100 };
        a.store.set({ sciencePlan: plan });
        await session.advance(250);
        expect(b.store.values.isSessionLeader).toBe(false);

        // The plan panel in window b recomputes the same plan after the remote edit.
        b.store.set({ sciencePlan: { total_plan_time_s: 100 } });
        await session.advance(250);
        expect(b.store.values.isSessionLeader).toBe(false);
        expect(a.store.values.isSessionLeader).toBe(true);
    });

    it("changes before the data has settled are not user actions", () => {
        const session = new TestSession();
        const a = session.open("window_a");
        // Armed only ARM_DELAY_MS after the data is ready, which has not passed yet.
        a.store.set({ sciencePlanStops: [{ knot_id: "k", chosen_task_ids: [] }] });
        expect(session.hub.countOf("leader_claim")).toBe(0);
    });

    it("works when BroadcastChannel is not used at all (single window)", async () => {
        const session = new TestSession();
        const a = session.open("window_a");
        await session.advance(ARM_DELAY_MS + 500);
        a.store.set({ isSimPlaying: true });
        await session.advance(1000);
        expect(a.store.values.isSessionLeader).toBe(true);
        expect(session.hub.countOf("state_patch")).toBe(0);
        expect(session.hub.countOf("clock_anchor")).toBe(0);
    });
});
