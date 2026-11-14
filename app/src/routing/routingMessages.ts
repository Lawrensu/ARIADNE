// Messages between routingClient.ts (main thread) and routingWorker.ts (Web Worker).
// Descriptive string message types (docs/development_conventions.md), each with a request id.

import type { LocalPosition } from "../data/contracts";
import type { RoutePlans } from "./routePlans";
import type { RoutingGridInput } from "./routingGrid";




export interface InitialiseRoutingGridRequest {
    message_type: "initialise_routing_grid";
    request_id: number;
    grid_input: RoutingGridInput;
}


export interface ComputeRoutePlansRequest {
    message_type: "compute_route_plans";
    request_id: number;
    start: LocalPosition;
    end: LocalPosition;
    blocked_cell_indices: number[];
}


export interface RerouteFromRequest {
    message_type: "reroute_from";
    request_id: number;
    current: LocalPosition;
    blocked_cell_indices: number[];
}


export type RoutingRequest = InitialiseRoutingGridRequest | ComputeRoutePlansRequest | RerouteFromRequest;




export interface RoutingGridReadyResponse {
    message_type: "routing_grid_ready";
    request_id: number;
}


export interface RoutePlansReadyResponse {
    message_type: "route_plans_ready";
    request_id: number;
    route_plans: RoutePlans;
    compute_time_ms: number;
}


export interface RouteFailedResponse {
    message_type: "route_failed";
    request_id: number;
    error_message: string;
}


export type RoutingResponse = RoutingGridReadyResponse | RoutePlansReadyResponse | RouteFailedResponse;
