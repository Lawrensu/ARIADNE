// Walk and scenario driver (owner: Lawrence, Stage 3 takeover, D-030). Connects the pure walk
// timeline (walkTimeline.ts) and scenario engine (scenarioEngine.ts) to the store:
//   - useWalkAndScenarioDriver(): on every simulation clock change, fires due scenario events,
//     moves the simulated astronaut, checks off tasks as their planned time ends, and keeps the
//     breadcrumb trail. Mount it once (MainView).
//   - rerouteWalkTo(): leaves the plan and walks a routed path to a target (alert [ROUTE]).
//   - runDemoScenario(): resets everything, plans all five Knots and plays the storm scenario.
// Everything is driven by simElapsedSeconds, so the same scenario runs identically every time.

import { useEffect } from "react";

import { resolveAlertTarget } from "../alerts/alertTargets";
import type { LocalPosition } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";
import { planRoute } from "../planning/routingService";
import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { recomputeSciencePlan } from "../science/sciencePlanService";
import { nearestNeighbourOrder } from "../science/ui/planDisplay";
import type { AlertRecord, AlertSeverity } from "../state/alertsSlice";
import type { RouteEndpoint } from "../state/routeSlice";
import type { SciencePlan } from "../state/scienceSlice";
import { useAriadneStore } from "../state/store";
import type { AriadneState } from "../state/store";
import type { WalkPhase } from "../state/walkSlice";
import { dueEvents, SOLAR_STORM_SCENARIO } from "./scenarioEngine";
import type { ScenarioEvent } from "./scenarioEngine";
import type { WalkTimeline } from "./walkTimeline";
import { buildWalkTimeline, tasksFinishedBetween, walkStateAt } from "./walkTimeline";



// Simulated seconds per real second while the demo plays (one sim hour per real minute).
export const DEMO_SIM_SPEED = 60;
// A new breadcrumb point every this many metres walked.
const TRAIL_SPACING_M = 8;
const ASTRONAUT_ENDPOINT_ID = "astronaut_position";
const SHELTERED_ALERT_ID = "walk_arrived_in_shelter";



// The timeline is rebuilt only when the frozen plan or the start time changes.
let cachedTimeline: { plan: SciencePlan; startedAt: number; timeline: WalkTimeline } | null = null;


function currentTimeline(state: AriadneState): WalkTimeline | null {
    const plan = state.walkPlanSnapshot;
    const startedAt = state.walkStartedAtSimSeconds;
    if (plan === null || startedAt === null || state.processedData === null) {
        cachedTimeline = null;
        return null;
    }
    if (cachedTimeline !== null && cachedTimeline.plan === plan && cachedTimeline.startedAt === startedAt) {
        return cachedTimeline.timeline;
    }
    const timeline = buildWalkTimeline(plan, state.processedData.knots, state.processedData.meta.staging_point, startedAt);
    cachedTimeline = { plan, startedAt, timeline };
    return timeline;
}


function astronautPositionAt(state: AriadneState, simSeconds: number): LocalPosition | null {
    if (state.processedData === null) {
        return null;
    }
    const walk = walkStateAt(currentTimeline(state), state.walkDetour, state.processedData.meta.staging_point, simSeconds);
    return walk.position;
}


function currentLoadFactor(state: AriadneState, processedData: ProcessedData): number {
    const parameters = loadParametersFromMeta(processedData.meta.parameters);
    return loadFactor(carriedLoadKg(processedData.knots, state.completedTaskIds, parameters), parameters);
}



// Leave the plan at atSimSeconds and walk the fast route to the target. With no walk under way the
// route is only drawn on the map from the rover (nothing moves).
export async function rerouteWalkTo(target: RouteEndpoint, atSimSeconds: number): Promise<void> {
    const state = useAriadneStore.getState();
    const processedData = state.processedData;
    if (processedData === null) {
        return;
    }

    if (state.walkStartedAtSimSeconds === null) {
        const rover: RouteEndpoint = {
            endpoint_kind: "staging_point",
            endpoint_id: "staging_point",
            label: "Rover",
            position: processedData.meta.staging_point,
        };
        await planRoute(rover, target);
        return;
    }

    const from = astronautPositionAt(state, atSimSeconds);
    if (from === null) {
        return;
    }
    const start: RouteEndpoint = {
        endpoint_kind: "cell",
        endpoint_id: ASTRONAUT_ENDPOINT_ID,
        label: "You are here (sim.)",
        position: from,
    };
    await planRoute(start, target);

    const after = useAriadneStore.getState();
    const route = after.routePlans.fast ?? after.routePlans.safe;
    if (route === undefined) {
        return;
    }

    const path: LocalPosition[] = [from, ...route.path_positions];
    const lastPoint = path[path.length - 1];
    if (lastPoint.x_m !== target.position.x_m || lastPoint.z_m !== target.position.z_m) {
        path.push(target.position);
    }

    let phaseOnArrival: WalkPhase = "sheltering";
    if (target.endpoint_kind === "knot") {
        phaseOnArrival = "at_knot";
    }

    after.setWalkDetour({
        started_at_sim_seconds: atSimSeconds,
        path_positions: path,
        walking_time_s: route.walking_time_s * currentLoadFactor(after, processedData),
        target_kind: target.endpoint_kind,
        target_id: target.endpoint_id,
        target_label: target.label,
        phase_on_arrival: phaseOnArrival,
        is_estimate: true,
    });
}



function severityForEvent(eventType: string): AlertSeverity {
    if (eventType === "solar_particle_event_alert") {
        return "no_go";
    }
    if (eventType === "reroute_to_shelter") {
        return "caution";
    }
    return "go";
}


function scenarioEventAlert(state: AriadneState, event: ScenarioEvent, eventIndex: number): AlertRecord {
    const shelterId = event.payload.shelter_id;
    const knotId = event.payload.knot_id;

    const alert: AlertRecord = {
        alert_id: `${SOLAR_STORM_SCENARIO.scenario_id}:${eventIndex}:${event.event_type}`,
        alert_type: event.event_type,
        severity: severityForEvent(event.event_type),
        what_happened: event.display_message,
        recommended_action: event.recommended_action,
        distance_m: null,
        time_s: null,
        route_target_kind: null,
        route_target_id: null,
        route_target_label: null,
        created_at_sim_seconds: event.at_sim_seconds,
        is_estimate: true,
    };
    // "walk_started" names the first Knot but needs no [ROUTE]: the plan already goes there.
    if (typeof shelterId === "string") {
        alert.route_target_kind = "shelter";
        alert.route_target_id = shelterId;
    } else if (typeof knotId === "string" && event.event_type !== "walk_started") {
        alert.route_target_kind = "knot";
        alert.route_target_id = knotId;
    }

    const position = astronautPositionAt(state, event.at_sim_seconds);
    if (state.processedData !== null && position !== null) {
        const target = resolveAlertTarget(state.processedData, alert, position);
        if (target !== null) {
            alert.route_target_label = target.endpoint.label;
            alert.distance_m = target.distance_m;
            alert.time_s = target.walking_time_s * currentLoadFactor(state, state.processedData);
        }
    }
    return alert;
}


function applyScenarioEvent(event: ScenarioEvent, eventIndex: number): void {
    const state = useAriadneStore.getState();

    if (event.event_type === "walk_started") {
        if (state.sciencePlan !== null) {
            state.startWalk(event.at_sim_seconds, state.sciencePlan);
        }
    }

    const fresh = useAriadneStore.getState();
    const alert = scenarioEventAlert(fresh, event, eventIndex);
    fresh.raiseAlert(alert);

    if (event.event_type === "reroute_to_shelter" && fresh.walkDetour === null && fresh.processedData !== null) {
        const shelterId = event.payload.shelter_id;
        const shelter = fresh.processedData.shelters.find((candidate) => candidate.shelter_id === shelterId);
        if (shelter !== undefined) {
            const target: RouteEndpoint = {
                endpoint_kind: "shelter",
                endpoint_id: shelter.shelter_id,
                label: alert.route_target_label ?? shelter.shelter_id,
                position: { x_m: shelter.x_m, z_m: shelter.z_m },
            };
            void rerouteWalkTo(target, event.at_sim_seconds);
        }
    }
}



// Fires the due events in order. Before each event the walk is advanced to the event's own time, so
// tasks that ended earlier in a long frame count for the event (for example the load on a reroute).
// Returns the simulation time the walk has been advanced to.
function runScenarioStep(previousSimSeconds: number, simSeconds: number): number {
    const state = useAriadneStore.getState();
    if (state.scenarioStatus !== "running") {
        return previousSimSeconds;
    }
    const due = dueEvents(SOLAR_STORM_SCENARIO, state.scenarioEventIndex, simSeconds);
    if (due.events.length === 0) {
        return previousSimSeconds;
    }
    // Store the new index first so a nested store update never fires the same event twice.
    state.setScenarioEventIndex(due.nextIndex);
    let eventIndex = due.nextIndex - due.events.length;
    let walkedTo = previousSimSeconds;
    for (const event of due.events) {
        if (event.at_sim_seconds > walkedTo) {
            runWalkStep(walkedTo, event.at_sim_seconds);
            walkedTo = event.at_sim_seconds;
        }
        applyScenarioEvent(event, eventIndex);
        eventIndex += 1;
    }
    if (due.nextIndex >= SOLAR_STORM_SCENARIO.events.length) {
        useAriadneStore.getState().setScenarioStatus("complete");
    }
    return walkedTo;
}


function shelteredMessage(targetId: string, targetLabel: string): string {
    if (targetId === "shelter_rover") {
        return "Sheltered in the rover.";
    }
    return `Sheltered at ${targetLabel}.`;
}


function runWalkStep(previousSimSeconds: number, simSeconds: number): void {
    const state = useAriadneStore.getState();
    const processedData = state.processedData;
    if (processedData === null) {
        return;
    }
    const timeline = currentTimeline(state);
    const walk = walkStateAt(timeline, state.walkDetour, processedData.meta.staging_point, simSeconds);

    state.setAstronautPosition(walk.position, walk.heading_deg ?? state.astronautHeadingDeg);
    if (walk.phase !== state.walkPhase) {
        state.setWalkPhase(walk.phase);
    }

    if (timeline !== null && simSeconds > previousSimSeconds) {
        const finished = tasksFinishedBetween(timeline, state.walkDetour, previousSimSeconds, simSeconds);
        for (const taskId of finished) {
            state.setTaskCompleted(taskId, true);
        }
    }

    if (state.walkStartedAtSimSeconds === null) {
        if (state.walkTrail.length > 0) {
            state.setWalkTrail([]);
        }
    } else if (simSeconds < previousSimSeconds) {
        // The clock went back (reset or scrub): start the trail again from here.
        state.setWalkTrail([walk.position]);
    } else {
        const trail = state.walkTrail;
        const lastPoint = trail.length > 0 ? trail[trail.length - 1] : null;
        const isFarEnough =
            lastPoint === null ||
            Math.hypot(walk.position.x_m - lastPoint.x_m, walk.position.z_m - lastPoint.z_m) >= TRAIL_SPACING_M;
        if (isFarEnough) {
            state.setWalkTrail([...trail, walk.position]);
        }
    }

    const detour = state.walkDetour;
    if (walk.phase === "sheltering" && detour !== null) {
        useAriadneStore.getState().raiseAlert({
            alert_id: SHELTERED_ALERT_ID,
            alert_type: "sheltered",
            severity: "go",
            what_happened: shelteredMessage(detour.target_id, detour.target_label),
            recommended_action: "Stay inside until the dose rate falls; check it under Conditions.",
            distance_m: 0,
            time_s: 0,
            route_target_kind: null,
            route_target_id: null,
            route_target_label: null,
            created_at_sim_seconds: detour.started_at_sim_seconds + detour.walking_time_s,
            is_estimate: true,
        });
    }
}



// Mount once. Runs on every change of the clock, the walk start or the detour.
export function useWalkAndScenarioDriver(): void {
    useEffect(() => {
        let previousSimSeconds = useAriadneStore.getState().simElapsedSeconds;
        let isStepping = false;

        function step(): void {
            if (isStepping) {
                return;
            }
            isStepping = true;
            try {
                const simSeconds = useAriadneStore.getState().simElapsedSeconds;
                const walkedTo = runScenarioStep(previousSimSeconds, simSeconds);
                runWalkStep(walkedTo, simSeconds);
                previousSimSeconds = simSeconds;
            } finally {
                isStepping = false;
            }
        }

        step();
        const unsubscribe = useAriadneStore.subscribe((state, previous) => {
            const clockChanged = state.simElapsedSeconds !== previous.simElapsedSeconds;
            const walkChanged =
                state.walkStartedAtSimSeconds !== previous.walkStartedAtSimSeconds ||
                state.walkDetour !== previous.walkDetour ||
                state.scenarioStatus !== previous.scenarioStatus;
            if (clockChanged || walkChanged) {
                step();
            }
        });
        return unsubscribe;
    }, []);
}



// Start walking the current science plan now (free mode, without the scripted scenario).
export function startWalkNow(): void {
    const state = useAriadneStore.getState();
    if (state.sciencePlan === null) {
        return;
    }
    state.startWalk(state.simElapsedSeconds, state.sciencePlan);
}



// Reset the clock, the walk, alerts, routes and tasks; plan all five Knots (nearest first, every
// task); then play the scripted storm scenario from 0 at DEMO_SIM_SPEED.
export async function runDemoScenario(): Promise<void> {
    const state = useAriadneStore.getState();
    const processedData = state.processedData;
    if (processedData === null) {
        return;
    }

    state.setSimPlaying(false);
    state.resetSim();
    state.resetScenario();
    state.resetWalk();
    state.clearAlerts();
    state.clearRoute();
    for (const taskId of [...state.completedTaskIds]) {
        state.setTaskCompleted(taskId, false);
    }

    const knots = processedData.knots;
    const orderedIds = nearestNeighbourOrder(processedData.meta.staging_point, knots);
    const stops = [];
    for (const knotId of orderedIds) {
        const knot = knots.find((candidate) => candidate.knot_id === knotId);
        if (knot !== undefined) {
            stops.push({ knot_id: knot.knot_id, chosen_task_ids: knot.science_tasks.map((task) => task.task_id) });
        }
    }
    useAriadneStore.getState().setSciencePlanStops(stops);
    await recomputeSciencePlan();

    const ready = useAriadneStore.getState();
    if (ready.sciencePlan === null) {
        return;
    }
    ready.startScenario(SOLAR_STORM_SCENARIO.scenario_id);
    ready.setSimSpeedMultiplier(DEMO_SIM_SPEED);
    ready.setSimPlaying(true);
}
