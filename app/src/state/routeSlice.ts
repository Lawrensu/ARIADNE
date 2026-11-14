// Route slice: route endpoints, computed route options and blocked cells (owner: Malissa, Stage 2).
// The routing code in src/routing/ produces RoutePlan objects; this slice only stores them.

import type { StateCreator } from "zustand";

import type { LocalPosition } from "../data/contracts";
import type { AriadneState } from "./store";



// What a route endpoint refers to. "cell" is any picked grid cell.
export type RouteEndpointKind = "knot" | "staging_point" | "shelter" | "cell";


export interface RouteEndpoint {
    endpoint_kind: RouteEndpointKind;
    endpoint_id: string;
    label: string;
    position: LocalPosition;
}


// "fast": minimum walking time (edge cost from contracts.md 4.2).
// "safe": walking time weighted further towards low-penalty, low-slope, sheltered ground (est.).
// "smooth": minimum walking time with any-angle straight segments (Theta*), contract cost along each segment (est.).
export type RouteOptionId = "fast" | "safe" | "smooth";


export interface RoutePlan {
    route_option: RouteOptionId;
    // Grid cell indices (row * width + col) from start to end, inclusive.
    cell_indices: number[];
    // Cell centres in local grid metres, same order as cell_indices.
    path_positions: LocalPosition[];
    // Walking time along the path with the contract edge cost (contracts.md 4.2), seconds, est.
    walking_time_s: number;
    // Horizontal length of the path, metres.
    horizontal_distance_m: number;
    // Model-derived, always shown with "est.".
    is_estimate: true;
}


// "idle": nothing requested. "computing": the worker is busy. "route_ready": routes are in routePlans.
// "no_route": the end cannot be reached. "route_failed": an error occurred (see routeError).
export type RouteStatus = "idle" | "computing" | "route_ready" | "no_route" | "route_failed";


export interface RouteSlice {
    routeStart: RouteEndpoint | null;
    routeEnd: RouteEndpoint | null;
    routePlans: Partial<Record<RouteOptionId, RoutePlan>>;
    selectedRouteOption: RouteOptionId;
    routeStatus: RouteStatus;
    routeError: string | null;
    // Cells marked impassable at runtime (for example a hazard), used for rerouting.
    blockedCellIndices: number[];
    setRouteStart: (endpoint: RouteEndpoint | null) => void;
    setRouteEnd: (endpoint: RouteEndpoint | null) => void;
    setRoutePlans: (plans: Partial<Record<RouteOptionId, RoutePlan>>, status: RouteStatus) => void;
    setRouteStatus: (status: RouteStatus, error?: string | null) => void;
    setSelectedRouteOption: (option: RouteOptionId) => void;
    setBlockedCellIndices: (cellIndices: number[]) => void;
    clearRoute: () => void;
}



export const createRouteSlice: StateCreator<AriadneState, [], [], RouteSlice> = (set) => ({
    routeStart: null,
    routeEnd: null,
    routePlans: {},
    selectedRouteOption: "fast",
    routeStatus: "idle",
    routeError: null,
    blockedCellIndices: [],

    setRouteStart: (endpoint) => set({ routeStart: endpoint }),
    setRouteEnd: (endpoint) => set({ routeEnd: endpoint }),
    setRoutePlans: (plans, status) => set({ routePlans: plans, routeStatus: status, routeError: null }),
    setRouteStatus: (status, error = null) => set({ routeStatus: status, routeError: error }),
    setSelectedRouteOption: (option) => set({ selectedRouteOption: option }),
    setBlockedCellIndices: (cellIndices) => set({ blockedCellIndices: cellIndices }),
    clearRoute: () =>
        set({ routeStart: null, routeEnd: null, routePlans: {}, routeStatus: "idle", routeError: null }),
});
