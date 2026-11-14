// Store-facing science plan service (D-027, docs/contracts.md 4.6). Owner: Malissa, Stage 2.
//
// recomputeSciencePlan(): reads processedData and sciencePlanStops from the store, routes every leg
// on the app's one routing worker (computeFastLegs, one "fast" A* per leg, no D* Lite prepare),
// computes the plan (sciencePlan.ts) and writes it with setSciencePlan(plan, "plan_ready"), or
// setSciencePlan(null, "idle") when there are no stops, or setSciencePlanStatus("plan_failed", message).
// Late results of older requests are ignored.

import type { Knot, LocalPosition } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";
import { getSharedRoutingClient } from "../planning/routingService";
import type { RoutePlan } from "../state/routeSlice";
import { useAriadneStore } from "../state/store";
import type { RoutedLeg } from "./sciencePlan";
import { computeSciencePlan, returnFieldSecondsAt } from "./sciencePlan";




let latestRequestNumber = 0;


function describeError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}


function legKey(from: LocalPosition, to: LocalPosition): string {
    return `${from.x_m},${from.z_m}|${to.x_m},${to.z_m}`;
}


function routedLegFromRoutePlan(plan: RoutePlan | null): RoutedLeg | null {
    if (plan === null) {
        return null;
    }
    return {
        unloaded_walking_time_s: plan.walking_time_s,
        horizontal_distance_m: plan.horizontal_distance_m,
        path_positions: plan.path_positions,
    };
}


// Rover, then every planned Knot that the planner will route to (known, finite return_field), then
// the rover. Other Knots are skipped by computeSciencePlan before routing, so routing them is wasted.
function plannedWaypoints(processedData: ProcessedData, knotIds: string[]): LocalPosition[] {
    const knotsById = new Map<string, Knot>();
    for (const knot of processedData.knots) {
        knotsById.set(knot.knot_id, knot);
    }
    const stagingPoint = processedData.meta.staging_point;
    const waypoints: LocalPosition[] = [{ x_m: stagingPoint.x_m, z_m: stagingPoint.z_m }];
    for (const knotId of knotIds) {
        const knot = knotsById.get(knotId);
        if (knot === undefined) {
            continue;
        }
        const position = { x_m: knot.x_m, z_m: knot.z_m };
        const returnFieldSeconds = returnFieldSecondsAt(processedData.meta.grid, processedData.float32Layers.return_field, position);
        if (!Number.isFinite(returnFieldSeconds)) {
            continue;
        }
        waypoints.push(position);
    }
    waypoints.push({ x_m: stagingPoint.x_m, z_m: stagingPoint.z_m });
    return waypoints;
}




export async function recomputeSciencePlan(): Promise<void> {
    const store = useAriadneStore.getState();
    const processedData = store.processedData;
    const stops = store.sciencePlanStops;

    latestRequestNumber += 1;
    const requestNumber = latestRequestNumber;

    if (stops.length === 0) {
        store.setSciencePlan(null, "idle");
        return;
    }
    if (processedData === null) {
        // Nothing to plan on yet; the caller recomputes once the data has loaded.
        return;
    }

    store.setSciencePlanStatus("computing");
    try {
        const client = getSharedRoutingClient(processedData);

        // All planned legs in one worker round trip.
        const waypoints = plannedWaypoints(
            processedData,
            stops.map((stop) => stop.knot_id),
        );
        const fastLegs = await client.computeFastLegs(waypoints);
        if (requestNumber !== latestRequestNumber) {
            return;
        }
        const routedLegs = new Map<string, RoutedLeg | null>();
        for (let index = 0; index < fastLegs.length; index++) {
            routedLegs.set(legKey(waypoints[index], waypoints[index + 1]), routedLegFromRoutePlan(fastLegs[index]));
        }

        // A leg that was not in the batch (a Knot became unreachable, so the next leg starts from an
        // earlier stop) is routed on its own.
        const routeLeg = async (from: LocalPosition, to: LocalPosition): Promise<RoutedLeg | null> => {
            const key = legKey(from, to);
            const known = routedLegs.get(key);
            if (known !== undefined) {
                return known;
            }
            const [plan] = await client.computeFastLegs([from, to]);
            const routed = routedLegFromRoutePlan(plan ?? null);
            routedLegs.set(key, routed);
            return routed;
        };

        const plan = await computeSciencePlan({
            knots: processedData.knots,
            stops,
            parameters: processedData.meta.parameters,
            grid: processedData.meta.grid,
            returnField: processedData.float32Layers.return_field,
            stagingPoint: processedData.meta.staging_point,
            routeLeg,
        });
        if (requestNumber !== latestRequestNumber) {
            return;
        }
        useAriadneStore.getState().setSciencePlan(plan, "plan_ready");
    } catch (error) {
        if (requestNumber === latestRequestNumber) {
            useAriadneStore.getState().setSciencePlanStatus("plan_failed", describeError(error));
        }
    }
}
