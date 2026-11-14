// The routing state that lives inside the Web Worker, as a plain class so it is testable in Node.
// computeRoutePlans: fresh A* for every route option.
// rerouteFrom: D* Lite (one planner per route option) towards the last requested end, repaired
// incrementally when cells are blocked or unblocked and when the astronaut moves.
// computeFastLegs: one "fast" A* per consecutive pair of waypoints (science plan legs), without
// touching the blocked cells or the D* Lite planners.

import type { LocalPosition } from "../data/contracts";
import type { RouteOptionId, RoutePlan } from "../state/routeSlice";
import { DStarLitePlanner } from "./dStarLite";
import type { RoutePlans } from "./routePlans";
import { ROUTE_OPTION_IDS, buildRoutePlan, computeRoutePlan, computeRoutePlansOnGrid } from "./routePlans";
import type { RoutingGrid, RoutingGridInput } from "./routingGrid";
import { applyBlockedCells, createRoutingGrid, isCellPassable, snapToPassableCell } from "./routingGrid";




export class RoutingSession {
    readonly routingGrid: RoutingGrid;
    private goalPosition: LocalPosition | null = null;
    private goalIndex = -1;
    private readonly planners: Partial<Record<RouteOptionId, DStarLitePlanner>> = {};


    constructor(input: RoutingGridInput) {
        this.routingGrid = createRoutingGrid(input);
    }


    computeRoutePlans(start: LocalPosition, end: LocalPosition, blockedCellIndices: number[]): RoutePlans {
        // The changed cells are not needed here: the planners restart from scratch below.
        applyBlockedCells(this.routingGrid, blockedCellIndices);
        this.goalPosition = end;
        this.goalIndex = snapToPassableCell(this.routingGrid, end);
        // A new end means a new D* Lite search; the planners restart on the next prepare or reroute.
        this.forgetPlannerSearches();
        return computeRoutePlansOnGrid(this.routingGrid, start, end);
    }


    // Runs the initial D* Lite searches so the first reroute is already incremental.
    // The worker calls it right after answering compute_route_plans.
    prepareReplanners(start: LocalPosition): void {
        if (this.goalIndex === -1) {
            return;
        }
        const startIndex = snapToPassableCell(this.routingGrid, start);
        if (startIndex === -1) {
            return;
        }
        for (const routeOption of ROUTE_OPTION_IDS) {
            const planner = this.plannerFor(routeOption);
            if (!planner.isInitialised) {
                planner.initialise(startIndex, this.goalIndex);
                planner.replan();
            }
        }
    }


    // "fast" route (contracts.md 4.2 edge cost, unloaded) for each consecutive pair of waypoints:
    // result[i] goes from waypoints[i] to waypoints[i + 1], null when unreachable. Uses the
    // runtime-blocked cells already applied and leaves them, the goal and the planners unchanged.
    computeFastLegs(waypoints: LocalPosition[]): Array<RoutePlan | null> {
        const legs: Array<RoutePlan | null> = [];
        for (let index = 1; index < waypoints.length; index++) {
            legs.push(computeRoutePlan(this.routingGrid, "fast", waypoints[index - 1], waypoints[index]));
        }
        return legs;
    }


    // Replans from the astronaut's current position to the last requested end.
    rerouteFrom(current: LocalPosition, blockedCellIndices: number[]): RoutePlans {
        if (this.goalPosition === null) {
            throw new Error("rerouteFrom: no route has been requested yet (call computeRoutePlans first)");
        }
        const plans: RoutePlans = {};
        const changedCells = applyBlockedCells(this.routingGrid, blockedCellIndices);

        // If the end cell itself was blocked, snap the requested end again; a different end cell
        // means a new D* Lite search.
        let goalNeedsSnapping = false;
        if (this.goalIndex === -1) {
            goalNeedsSnapping = true;
        } else {
            if (!isCellPassable(this.routingGrid, this.goalIndex)) {
                goalNeedsSnapping = true;
            }
        }
        if (goalNeedsSnapping) {
            const snappedGoalIndex = snapToPassableCell(this.routingGrid, this.goalPosition);
            if (snappedGoalIndex !== this.goalIndex) {
                this.goalIndex = snappedGoalIndex;
                this.forgetPlannerSearches();
            }
        }

        const startIndex = snapToPassableCell(this.routingGrid, current);
        if (startIndex === -1 || this.goalIndex === -1) {
            // Changes still have to reach the planners so later reroutes stay correct.
            this.notifyPlanners(changedCells);
            return plans;
        }

        for (const routeOption of ROUTE_OPTION_IDS) {
            const planner = this.plannerFor(routeOption);
            if (planner.isInitialised) {
                planner.moveStart(startIndex);
                planner.notifyCellsChanged(changedCells);
            } else {
                planner.initialise(startIndex, this.goalIndex);
            }
            planner.replan();
            const path = planner.extractPath();
            if (path === null) {
                continue;
            }
            const plan = buildRoutePlan(this.routingGrid, routeOption, path);
            if (plan !== null) {
                plans[routeOption] = plan;
            }
        }
        return plans;
    }



    private plannerFor(routeOption: RouteOptionId): DStarLitePlanner {
        let planner = this.planners[routeOption];
        if (planner === undefined) {
            planner = new DStarLitePlanner(this.routingGrid, routeOption);
            this.planners[routeOption] = planner;
        }
        return planner;
    }


    private forgetPlannerSearches(): void {
        for (const routeOption of ROUTE_OPTION_IDS) {
            const planner = this.planners[routeOption];
            if (planner !== undefined) {
                planner.reset();
            }
        }
    }


    private notifyPlanners(changedCells: number[]): void {
        for (const routeOption of ROUTE_OPTION_IDS) {
            const planner = this.planners[routeOption];
            if (planner !== undefined) {
                if (planner.isInitialised) {
                    planner.notifyCellsChanged(changedCells);
                }
            }
        }
    }
}
