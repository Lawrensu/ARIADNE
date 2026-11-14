// Module Web Worker that runs the routing off the main thread.
// All algorithm code lives in plain modules (routingSession.ts and below); this file only
// dispatches messages (routingMessages.ts).

import type { RoutingRequest, RoutingResponse } from "./routingMessages";
import { RoutingSession } from "./routingSession";




const workerScope = self as unknown as DedicatedWorkerGlobalScope;
let session: RoutingSession | null = null;


function postResponse(response: RoutingResponse): void {
    workerScope.postMessage(response);
}


function errorMessageOf(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}


function handleRequest(request: RoutingRequest): void {
    if (request.message_type === "initialise_routing_grid") {
        session = new RoutingSession(request.grid_input);
        postResponse({ message_type: "routing_grid_ready", request_id: request.request_id });
        return;
    }

    if (session === null) {
        postResponse({
            message_type: "route_failed",
            request_id: request.request_id,
            error_message: "Routing worker has no grid yet (initialise_routing_grid not received)",
        });
        return;
    }

    if (request.message_type === "compute_route_plans") {
        const startedAt = performance.now();
        const routePlans = session.computeRoutePlans(request.start, request.end, request.blocked_cell_indices);
        postResponse({
            message_type: "route_plans_ready",
            request_id: request.request_id,
            route_plans: routePlans,
            compute_time_ms: performance.now() - startedAt,
        });
        // After answering, run the initial D* Lite searches so a later reroute is incremental.
        session.prepareReplanners(request.start);
        return;
    }

    if (request.message_type === "reroute_from") {
        const startedAt = performance.now();
        const routePlans = session.rerouteFrom(request.current, request.blocked_cell_indices);
        postResponse({
            message_type: "route_plans_ready",
            request_id: request.request_id,
            route_plans: routePlans,
            compute_time_ms: performance.now() - startedAt,
        });
        return;
    }
}


workerScope.onmessage = (event: MessageEvent<RoutingRequest>) => {
    const request = event.data;
    try {
        handleRequest(request);
    } catch (error) {
        postResponse({
            message_type: "route_failed",
            request_id: request.request_id,
            error_message: errorMessageOf(error),
        });
    }
};
