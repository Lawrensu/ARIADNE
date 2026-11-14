// One routing worker for the whole app, and the store-facing functions that use it
// (owner: Malissa, Stage 2). Letta's alerts call planRoute() for the one-tap [ROUTE] to a shelter,
// and rerouteAroundBlockedCells() when a hazard blocks the way.

import type { LocalPosition } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";
import { createRoutingClient } from "../routing/routingClient";
import type { RouteEndpoint } from "../state/routeSlice";
import { useAriadneStore } from "../state/store";



type RoutingClient = ReturnType<typeof createRoutingClient>;


let routingClient: RoutingClient | null = null;
let routingClientData: ProcessedData | null = null;
let latestRequestNumber = 0;



// The one routing worker of the app, shared with the science planner (src/science/sciencePlanService.ts).
export function getSharedRoutingClient(processedData: ProcessedData): RoutingClient {
    return getRoutingClient(processedData);
}


function getRoutingClient(processedData: ProcessedData): RoutingClient {
    if (routingClient !== null && routingClientData === processedData) {
        return routingClient;
    }
    if (routingClient !== null) {
        routingClient.dispose();
    }
    routingClient = createRoutingClient(processedData);
    routingClientData = processedData;
    return routingClient;
}


function describeError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}



// Computes fast and safe routes between two endpoints and stores them. Older requests that finish
// late are ignored, so the screen always shows the latest request.
export async function planRoute(start: RouteEndpoint, end: RouteEndpoint): Promise<void> {
    const store = useAriadneStore.getState();
    const processedData = store.processedData;
    if (processedData === null) {
        return;
    }
    store.setRouteStart(start);
    store.setRouteEnd(end);
    store.setRouteStatus("computing");

    latestRequestNumber += 1;
    const requestNumber = latestRequestNumber;
    try {
        const client = getRoutingClient(processedData);
        const plans = await client.computeRoutePlans(start.position, end.position, store.blockedCellIndices);
        if (requestNumber !== latestRequestNumber) {
            return;
        }
        if (plans.fast === undefined && plans.safe === undefined) {
            useAriadneStore.getState().setRoutePlans({}, "no_route");
        } else {
            useAriadneStore.getState().setRoutePlans(plans, "route_ready");
        }
    } catch (error) {
        if (requestNumber === latestRequestNumber) {
            useAriadneStore.getState().setRouteStatus("route_failed", describeError(error));
        }
    }
}


// Marks cells impassable and replans from the given position to the current route end with the
// incremental replanner (D* Lite). Used for hazards such as a blocked passage.
export async function rerouteAroundBlockedCells(currentPosition: LocalPosition, newBlockedCellIndices: number[]): Promise<void> {
    const store = useAriadneStore.getState();
    const processedData = store.processedData;
    if (processedData === null || store.routeEnd === null) {
        return;
    }
    const blocked = Array.from(new Set([...store.blockedCellIndices, ...newBlockedCellIndices]));
    store.setBlockedCellIndices(blocked);
    store.setRouteStatus("computing");

    latestRequestNumber += 1;
    const requestNumber = latestRequestNumber;
    try {
        const client = getRoutingClient(processedData);
        const plans = await client.rerouteFrom(currentPosition, blocked);
        if (requestNumber !== latestRequestNumber) {
            return;
        }
        if (plans.fast === undefined && plans.safe === undefined) {
            useAriadneStore.getState().setRoutePlans({}, "no_route");
        } else {
            useAriadneStore.getState().setRoutePlans(plans, "route_ready");
        }
    } catch (error) {
        if (requestNumber === latestRequestNumber) {
            useAriadneStore.getState().setRouteStatus("route_failed", describeError(error));
        }
    }
}


export function clearBlockedCells(): void {
    useAriadneStore.getState().setBlockedCellIndices([]);
}
