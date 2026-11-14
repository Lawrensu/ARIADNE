// Messages between routingClient.ts (main thread) and routingWorker.ts (Web Worker).
// Descriptive string message types (docs/development_conventions.md), each with a request id.

import type { LocalPosition } from "../data/contracts";
import type { RoutePlan } from "../state/routeSlice";
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


// One "fast" A* route per consecutive pair of waypoints (the science plan legs, contracts.md 4.6).
// Uses the runtime-blocked cells already applied in the worker and does not change them; it never
// runs the D* Lite prepare step, so it does not disturb a pending reroute.
export interface ComputeFastLegsRequest {
    message_type: "compute_fast_legs";
    request_id: number;
    waypoints: LocalPosition[];
}


export type RoutingRequest = InitialiseRoutingGridRequest | ComputeRoutePlansRequest | RerouteFromRequest | ComputeFastLegsRequest;




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


// fast_legs[i] is the "fast" route from waypoints[i] to waypoints[i + 1], or null when unreachable.
export interface FastLegsReadyResponse {
    message_type: "fast_legs_ready";
    request_id: number;
    fast_legs: Array<RoutePlan | null>;
    compute_time_ms: number;
}


export interface RouteFailedResponse {
    message_type: "route_failed";
    request_id: number;
    error_message: string;
}


export type RoutingResponse = RoutingGridReadyResponse | RoutePlansReadyResponse | FastLegsReadyResponse | RouteFailedResponse;
