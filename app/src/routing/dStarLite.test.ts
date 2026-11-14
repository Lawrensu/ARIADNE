import { describe, expect, it } from "vitest";

import { findPathAStar } from "./aStar";
import { DStarLitePlanner } from "./dStarLite";
import { RoutingSession } from "./routingSession";
import { applyBlockedCells, cellCentreFromIndex } from "./routingGrid";
import { createRandom, createSyntheticGrid, firstPassableCellNear, relativeDifference } from "./syntheticGrids";




const RELATIVE_TOLERANCE = 1e-6;


// Cells within radiusCells of a centre cell (square), clipped to the grid.
function cellsAround(width: number, height: number, centreIndex: number, radiusCells: number): number[] {
    const centreRow = Math.floor(centreIndex / width);
    const centreCol = centreIndex - centreRow * width;
    const cells: number[] = [];
    for (let row = centreRow - radiusCells; row <= centreRow + radiusCells; row++) {
        for (let col = centreCol - radiusCells; col <= centreCol + radiusCells; col++) {
            if (row >= 0 && row < height && col >= 0 && col < width) {
                cells.push(row * width + col);
            }
        }
    }
    return cells;
}




describe("DStarLitePlanner on synthetic grids", () => {
    it("initial search equals A* for both route options", () => {
        const grid = createSyntheticGrid({ width: 70, height: 50, cellSizeMetres: 2, seed: 7, impassableFraction: 0.15, heightAmplitudeMetres: 0.6 });
        const start = firstPassableCellNear(grid, 1, 1);
        const goal = firstPassableCellNear(grid, 48, 68);
        for (const routeOption of ["fast", "safe"] as const) {
            const planner = new DStarLitePlanner(grid, routeOption);
            planner.initialise(start, goal);
            planner.replan();
            const reference = findPathAStar(grid, start, goal, routeOption)!;
            expect(relativeDifference(planner.costFromStart(), reference.searchCost)).toBeLessThan(RELATIVE_TOLERANCE);
            const path = planner.extractPath()!;
            expect(path.cellIndices[0]).toBe(start);
            expect(path.cellIndices[path.cellIndices.length - 1]).toBe(goal);
            expect(relativeDifference(path.searchCost, reference.searchCost)).toBeLessThan(RELATIVE_TOLERANCE);
        }
    });

    it("after blocking cells on the route and moving the start, equals a fresh A* on the modified grid", () => {
        for (let seed = 1; seed <= 6; seed++) {
            const grid = createSyntheticGrid({ width: 80, height: 60, cellSizeMetres: 2, seed, impassableFraction: 0.12, heightAmplitudeMetres: 0.6 });
            const random = createRandom(seed * 101);
            let start = firstPassableCellNear(grid, 2, 2);
            const goal = firstPassableCellNear(grid, 57, 77);
            for (const routeOption of ["fast", "safe"] as const) {
                applyBlockedCells(grid, []);
                start = firstPassableCellNear(grid, 2, 2);
                const planner = new DStarLitePlanner(grid, routeOption);
                planner.initialise(start, goal);
                planner.replan();
                let blocked: number[] = [];

                for (let round = 0; round < 5; round++) {
                    const path = planner.extractPath();
                    if (path === null) {
                        break;
                    }
                    // Walk a few steps along the current route.
                    const stepsWalked = Math.min(path.cellIndices.length - 1, 1 + Math.floor(random() * 8));
                    start = path.cellIndices[stepsWalked];
                    if (start === goal) {
                        break;
                    }
                    // Block a patch on the route ahead (never the astronaut's or the goal's cell).
                    const aheadIndex = Math.min(path.cellIndices.length - 2, stepsWalked + 3 + Math.floor(random() * 10));
                    const patch = cellsAround(80, 60, path.cellIndices[aheadIndex], 1 + Math.floor(random() * 2));
                    const newBlocked = patch.filter((cell) => cell !== start && cell !== goal);
                    // Sometimes unblock an earlier patch too, so cost decreases are covered.
                    if (round === 3) {
                        blocked = [];
                    }
                    blocked = blocked.concat(newBlocked);
                    const changed = applyBlockedCells(grid, blocked);
                    planner.moveStart(start);
                    planner.notifyCellsChanged(changed);
                    planner.replan();

                    const fresh = findPathAStar(grid, start, goal, routeOption);
                    if (fresh === null) {
                        expect(planner.costFromStart()).toBe(Number.POSITIVE_INFINITY);
                        expect(planner.extractPath()).toBeNull();
                        break;
                    }
                    expect(relativeDifference(planner.costFromStart(), fresh.searchCost)).toBeLessThan(RELATIVE_TOLERANCE);
                    const replanned = planner.extractPath()!;
                    expect(replanned).not.toBeNull();
                    expect(relativeDifference(replanned.searchCost, fresh.searchCost)).toBeLessThan(RELATIVE_TOLERANCE);
                    for (const cell of replanned.cellIndices) {
                        expect(grid.blockedCells[cell]).toBe(0);
                    }
                }
            }
        }
    });

    it("reports no route when the goal gets walled off", () => {
        const grid = createSyntheticGrid({ width: 40, height: 40, cellSizeMetres: 2, seed: 3, impassableFraction: 0, heightAmplitudeMetres: 0.2 });
        const start = 0;
        const goal = 20 * 40 + 20;
        const planner = new DStarLitePlanner(grid, "fast");
        planner.initialise(start, goal);
        planner.replan();
        expect(Number.isFinite(planner.costFromStart())).toBe(true);
        const ring = cellsAround(40, 40, goal, 2).filter((cell) => {
            const row = Math.floor(cell / 40);
            const col = cell - row * 40;
            return Math.max(Math.abs(row - 20), Math.abs(col - 20)) === 2;
        });
        planner.notifyCellsChanged(applyBlockedCells(grid, ring));
        planner.replan();
        expect(planner.costFromStart()).toBe(Number.POSITIVE_INFINITY);
        expect(planner.extractPath()).toBeNull();
    });
});




describe("RoutingSession (the worker's logic, without a Worker)", () => {
    it("rerouteFrom equals a fresh computeRoutePlans on the same blocked set", () => {
        const input = createSyntheticGrid({ width: 60, height: 60, cellSizeMetres: 2, seed: 11, impassableFraction: 0.1, heightAmplitudeMetres: 0.5 });
        const session = new RoutingSession({
            grid: input.grid,
            heightmap: input.heightmap,
            traversal_penalty: input.traversalPenalty,
            slope_degrees: input.slopeDegrees,
            viewshed_rover: input.viewshedRover,
        });
        const start = cellCentreFromIndex(session.routingGrid, firstPassableCellNear(session.routingGrid, 1, 1));
        const end = cellCentreFromIndex(session.routingGrid, firstPassableCellNear(session.routingGrid, 58, 58));

        const initial = session.computeRoutePlans(start, end, []);
        expect(initial.fast).toBeDefined();
        session.prepareReplanners(start);

        const fastCells = initial.fast!.cell_indices;
        const current = initial.fast!.path_positions[5];
        const blocked = cellsAround(60, 60, fastCells[Math.floor(fastCells.length / 2)], 2);
        const rerouted = session.rerouteFrom(current, blocked);

        const checkSession = new RoutingSession({
            grid: input.grid,
            heightmap: input.heightmap,
            traversal_penalty: input.traversalPenalty,
            slope_degrees: input.slopeDegrees,
            viewshed_rover: input.viewshedRover,
        });
        const fresh = checkSession.computeRoutePlans(current, end, blocked);
        for (const routeOption of ["fast", "safe"] as const) {
            expect(rerouted[routeOption]).toBeDefined();
            expect(rerouted[routeOption]!.route_option).toBe(routeOption);
            expect(rerouted[routeOption]!.is_estimate).toBe(true);
            expect(rerouted[routeOption]!.path_positions[0]).toEqual(current);
        }
        // "fast" minimises contract time, so both searches must agree on it.
        expect(relativeDifference(rerouted.fast!.walking_time_s, fresh.fast!.walking_time_s)).toBeLessThan(RELATIVE_TOLERANCE);
    });

    it("rerouteFrom before any computeRoutePlans throws", () => {
        const input = createSyntheticGrid({ width: 10, height: 10, cellSizeMetres: 2, seed: 1, impassableFraction: 0, heightAmplitudeMetres: 0.1 });
        const session = new RoutingSession({
            grid: input.grid,
            heightmap: input.heightmap,
            traversal_penalty: input.traversalPenalty,
            slope_degrees: input.slopeDegrees,
            viewshed_rover: input.viewshedRover,
        });
        expect(() => session.rerouteFrom({ x_m: 1, z_m: 1 }, [])).toThrow();
    });
});
