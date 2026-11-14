// Main-thread client for the routing Web Worker (routingWorker.ts).
// The worker gets copies of the grid arrays (slice()), so the main thread keeps its own; the
// copies' buffers are transferred, not copied a second time.

import type { LocalPosition } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";
import type { RouteOptionId, RoutePlan } from "../state/routeSlice";
import type { FastLegsReadyResponse, RoutePlansReadyResponse, RoutingRequest, RoutingResponse } from "./routingMessages";
import type { RoutingGridInput } from "./routingGrid";




export interface RoutingClient {
    // A* for "fast" and "safe" from start to end. An option without a route is left out.
    computeRoutePlans(
        start: LocalPosition,
        end: LocalPosition,
        blockedCellIndices: number[],
    ): Promise<Partial<Record<RouteOptionId, RoutePlan>>>;
    // D* Lite replan from the astronaut's current position to the end of the last computeRoutePlans.
    rerouteFrom(current: LocalPosition, blockedCellIndices: number[]): Promise<Partial<Record<RouteOptionId, RoutePlan>>>;
    // One "fast" A* route per consecutive pair of waypoints (science plan legs, contracts.md 4.6):
    // result[i] goes from waypoints[i] to waypoints[i + 1], null where unreachable. Same worker and
    // grid; uses the blocked cells already applied there and skips the D* Lite prepare step.
    computeFastLegs(waypoints: LocalPosition[]): Promise<Array<RoutePlan | null>>;
    // Stops the worker; pending requests are rejected.
    dispose(): void;
}


type SuccessResponse = RoutePlansReadyResponse | FastLegsReadyResponse;


interface PendingRequest {
    resolve: (response: SuccessResponse) => void;
    reject: (error: Error) => void;
}




export function createRoutingClient(processedData: ProcessedData): RoutingClient {
    const worker = new Worker(new URL("./routingWorker.ts", import.meta.url), { type: "module" });
    const pendingRequests = new Map<number, PendingRequest>();
    let nextRequestId = 1;
    let isDisposed = false;

    worker.onmessage = (event: MessageEvent<RoutingResponse>) => {
        const response = event.data;
        if (response.message_type === "routing_grid_ready") {
            return;
        }
        const pending = pendingRequests.get(response.request_id);
        if (pending === undefined) {
            return;
        }
        pendingRequests.delete(response.request_id);
        if (response.message_type === "route_failed") {
            pending.reject(new Error(response.error_message));
        } else {
            pending.resolve(response);
        }
    };

    worker.onerror = (event: ErrorEvent) => {
        const error = new Error(`Routing worker error: ${event.message}`);
        for (const pending of pendingRequests.values()) {
            pending.reject(error);
        }
        pendingRequests.clear();
    };

    const gridInput: RoutingGridInput = {
        grid: { ...processedData.meta.grid },
        heightmap: processedData.float32Layers.heightmap.slice(),
        traversal_penalty: processedData.float32Layers.traversal_penalty.slice(),
        slope_degrees: processedData.float32Layers.slope_degrees.slice(),
        viewshed_rover: processedData.uint8Layers.viewshed_rover.slice(),
        parameters: processedData.meta.parameters,
    };
    const initialiseRequest: RoutingRequest = {
        message_type: "initialise_routing_grid",
        request_id: 0,
        grid_input: gridInput,
    };
    // The worker handles messages in order, so later requests wait for the grid without an await.
    worker.postMessage(initialiseRequest, [
        gridInput.heightmap.buffer,
        gridInput.traversal_penalty.buffer,
        gridInput.slope_degrees.buffer,
        gridInput.viewshed_rover.buffer,
    ]);


    function sendRequest(request: RoutingRequest): Promise<SuccessResponse> {
        if (isDisposed) {
            return Promise.reject(new Error("Routing client has been disposed"));
        }
        return new Promise((resolve, reject) => {
            pendingRequests.set(request.request_id, { resolve, reject });
            worker.postMessage(request);
        });
    }


    async function sendRoutePlansRequest(request: RoutingRequest): Promise<Partial<Record<RouteOptionId, RoutePlan>>> {
        const response = await sendRequest(request);
        if (response.message_type !== "route_plans_ready") {
            throw new Error(`Routing worker answered ${response.message_type}, expected route_plans_ready`);
        }
        return response.route_plans;
    }


    return {
        computeRoutePlans(start, end, blockedCellIndices) {
            const requestId = nextRequestId;
            nextRequestId += 1;
            return sendRoutePlansRequest({
                message_type: "compute_route_plans",
                request_id: requestId,
                start: { x_m: start.x_m, z_m: start.z_m },
                end: { x_m: end.x_m, z_m: end.z_m },
                blocked_cell_indices: blockedCellIndices.slice(),
            });
        },

        rerouteFrom(current, blockedCellIndices) {
            const requestId = nextRequestId;
            nextRequestId += 1;
            return sendRoutePlansRequest({
                message_type: "reroute_from",
                request_id: requestId,
                current: { x_m: current.x_m, z_m: current.z_m },
                blocked_cell_indices: blockedCellIndices.slice(),
            });
        },

        async computeFastLegs(waypoints) {
            const requestId = nextRequestId;
            nextRequestId += 1;
            const response = await sendRequest({
                message_type: "compute_fast_legs",
                request_id: requestId,
                waypoints: waypoints.map((waypoint) => ({ x_m: waypoint.x_m, z_m: waypoint.z_m })),
            });
            if (response.message_type !== "fast_legs_ready") {
                throw new Error(`Routing worker answered ${response.message_type}, expected fast_legs_ready`);
            }
            return response.fast_legs;
        },

        dispose() {
            if (isDisposed) {
                return;
            }
            isDisposed = true;
            worker.terminate();
            const error = new Error("Routing client has been disposed");
            for (const pending of pendingRequests.values()) {
                pending.reject(error);
            }
            pendingRequests.clear();
        },
    };
}
