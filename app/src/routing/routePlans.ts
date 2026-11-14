// Route options and RoutePlan building (app/src/state/routeSlice.ts).
// "fast": minimum contract edge cost (contracts.md 4.2).
// "safe": the same search with safeEdgeWeight >= 1 on each edge (routingGrid.ts, estimate).
// For both, walking_time_s is the contract walking time summed along the chosen path, never the
// weighted search cost, so the number shown to the crew means the same thing for both options.

import type { LocalPosition } from "../data/contracts";
import type { RouteOptionId, RoutePlan } from "../state/routeSlice";
import type { GridPath } from "./aStar";
import { findPathAStar } from "./aStar";
import type { RoutingGrid } from "./routingGrid";
import { cellCentreFromIndex, contractEdgeCostSeconds, neighbourDirection, snapToPassableCell } from "./routingGrid";




export const ROUTE_OPTION_IDS: RouteOptionId[] = ["fast", "safe"];


export type RoutePlans = Partial<Record<RouteOptionId, RoutePlan>>;




export interface PathMeasures {
    walkingTimeSeconds: number;
    horizontalDistanceMetres: number;
}


// Contract walking time and horizontal length along consecutive 8-neighbour cells.
// Returns +Infinity time if a step is not a contract edge (should not happen for search output).
export function measurePath(routingGrid: RoutingGrid, cellIndices: number[]): PathMeasures {
    let walkingTimeSeconds = 0;
    let horizontalDistanceMetres = 0;
    for (let step = 1; step < cellIndices.length; step++) {
        const fromIndex = cellIndices[step - 1];
        const toIndex = cellIndices[step];
        const direction = neighbourDirection(routingGrid, fromIndex, toIndex);
        if (direction === -1) {
            return { walkingTimeSeconds: Number.POSITIVE_INFINITY, horizontalDistanceMetres: Number.NaN };
        }
        const stepDistance = routingGrid.stepDistanceMetres[direction];
        walkingTimeSeconds += contractEdgeCostSeconds(routingGrid, fromIndex, toIndex, stepDistance);
        horizontalDistanceMetres += stepDistance;
    }
    return { walkingTimeSeconds, horizontalDistanceMetres };
}


export function buildRoutePlan(routingGrid: RoutingGrid, routeOption: RouteOptionId, path: GridPath): RoutePlan | null {
    const measures = measurePath(routingGrid, path.cellIndices);
    if (!Number.isFinite(measures.walkingTimeSeconds)) {
        return null;
    }
    return {
        route_option: routeOption,
        cell_indices: path.cellIndices.slice(),
        path_positions: path.cellIndices.map((index) => cellCentreFromIndex(routingGrid, index)),
        walking_time_s: measures.walkingTimeSeconds,
        horizontal_distance_m: measures.horizontalDistanceMetres,
        is_estimate: true,
    };
}




// Start and end snapped to passable cells (routingGrid.SNAP_RADIUS_M). -1 when none is close.
export interface SnappedEndpoints {
    startIndex: number;
    endIndex: number;
}


export function snapEndpoints(routingGrid: RoutingGrid, start: LocalPosition, end: LocalPosition): SnappedEndpoints {
    return {
        startIndex: snapToPassableCell(routingGrid, start),
        endIndex: snapToPassableCell(routingGrid, end),
    };
}


// A* for one route option. Returns null when start or end has no passable cell within the snap
// radius, or when the end cannot be reached.
// Uses the blocked cells already applied to routingGrid (see applyBlockedCells).
export function computeRoutePlan(
    routingGrid: RoutingGrid,
    routeOption: RouteOptionId,
    start: LocalPosition,
    end: LocalPosition,
): RoutePlan | null {
    const endpoints = snapEndpoints(routingGrid, start, end);
    if (endpoints.startIndex === -1) {
        return null;
    }
    if (endpoints.endIndex === -1) {
        return null;
    }
    const path = findPathAStar(routingGrid, endpoints.startIndex, endpoints.endIndex, routeOption);
    if (path === null) {
        return null;
    }
    return buildRoutePlan(routingGrid, routeOption, path);
}


// Every route option. An option that has no route (null above) is left out of the result, which
// matches RouteSlice.routePlans (Partial<Record<RouteOptionId, RoutePlan>>).
export function computeRoutePlansOnGrid(routingGrid: RoutingGrid, start: LocalPosition, end: LocalPosition): RoutePlans {
    const plans: RoutePlans = {};
    for (const routeOption of ROUTE_OPTION_IDS) {
        const plan = computeRoutePlan(routingGrid, routeOption, start, end);
        if (plan !== null) {
            plans[routeOption] = plan;
        }
    }
    return plans;
}
