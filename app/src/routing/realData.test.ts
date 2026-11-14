// Routing on the real data/processed/ grid (gate requirement for Stage 2).
// The return_field cross-check proves the TypeScript graph and walking function match the pipeline:
// return_field is the time to walk FROM a cell TO the staging point (contracts.md 3.6), so the
// fast A* time from each Knot cell to the staging cell must equal it.

import { beforeAll, describe, expect, it } from "vitest";

import { cellFromPosition, cellIndex } from "../data/grid";
import type { ProcessedData } from "../data/loadProcessed";
import { loadProcessedDataFromDisk } from "../data/loadProcessedFromDisk";
import { findPathAStar } from "./aStar";
import { DStarLitePlanner } from "./dStarLite";
import { measurePath } from "./routePlans";
import type { RoutingGrid } from "./routingGrid";
import { applyBlockedCells, createRoutingGrid, routingGridInputFromProcessedData } from "./routingGrid";
import { RoutingSession } from "./routingSession";
import { relativeDifference } from "./syntheticGrids";




const RETURN_FIELD_TOLERANCE = 0.01;
const REPLAN_TOLERANCE = 1e-6;

let data: ProcessedData;
let routingGrid: RoutingGrid;
let stagingIndex: number;


beforeAll(async () => {
    data = await loadProcessedDataFromDisk();
    routingGrid = createRoutingGrid(routingGridInputFromProcessedData(data));
    stagingIndex = cellIndex(data.meta.grid, cellFromPosition(data.meta.grid, data.meta.staging_point));
});




describe("real data: fast A* from each Knot to the staging point equals return_field (contracts.md 3.6)", () => {
    it("matches within 1% for every Knot", () => {
        expect(data.knots.length).toBeGreaterThan(0);
        const grid = data.meta.grid;
        console.log(`grid ${grid.width} x ${grid.height} cells, ${grid.cell_size_m} m; staging cell ${stagingIndex}`);
        console.log("knot_id | A* s | return_field s | relative difference | A* ms | expanded cells");
        for (const knot of data.knots) {
            const knotIndex = cellIndex(grid, cellFromPosition(grid, knot));
            const returnFieldSeconds = data.float32Layers.return_field[knotIndex];
            const startedAt = performance.now();
            const path = findPathAStar(routingGrid, knotIndex, stagingIndex, "fast");
            const elapsedMs = performance.now() - startedAt;
            expect(path).not.toBeNull();
            const aStarSeconds = path!.searchCost;
            const difference = relativeDifference(aStarSeconds, returnFieldSeconds);
            console.log(
                `${knot.knot_id} | ${aStarSeconds.toFixed(2)} | ${returnFieldSeconds.toFixed(2)} | ${difference.toExponential(3)} | ${elapsedMs.toFixed(0)} | ${path!.expandedCellCount}`,
            );
            expect(Number.isFinite(returnFieldSeconds)).toBe(true);
            expect(difference).toBeLessThan(RETURN_FIELD_TOLERANCE);
            // The RoutePlan time (contract time summed along the path) is the same number.
            expect(relativeDifference(measurePath(routingGrid, path!.cellIndices).walkingTimeSeconds, aStarSeconds)).toBeLessThan(1e-9);
        }
    });
});




describe("real data: D* Lite replanning", () => {
    it("after blocking cells on the route and moving the start, equals a fresh A*", () => {
        const grid = data.meta.grid;
        const knot = data.knots[0];
        const knotIndex = cellIndex(grid, cellFromPosition(grid, knot));
        applyBlockedCells(routingGrid, []);

        const planner = new DStarLitePlanner(routingGrid, "fast");
        let startedAt = performance.now();
        planner.initialise(knotIndex, stagingIndex);
        planner.replan();
        const initialMs = performance.now() - startedAt;
        const initialPath = planner.extractPath();
        expect(initialPath).not.toBeNull();
        expect(relativeDifference(planner.costFromStart(), data.float32Layers.return_field[knotIndex])).toBeLessThan(RETURN_FIELD_TOLERANCE);

        // The astronaut walks 40 steps, then a hazard (radius 6 cells = 12 m) blocks the route ahead.
        const route = initialPath!.cellIndices;
        const current = route[40];
        const hazardCentre = route[Math.floor(route.length / 2)];
        const centreRow = Math.floor(hazardCentre / grid.width);
        const centreCol = hazardCentre - centreRow * grid.width;
        const blocked: number[] = [];
        for (let row = centreRow - 6; row <= centreRow + 6; row++) {
            for (let col = centreCol - 6; col <= centreCol + 6; col++) {
                if (row >= 0 && row < grid.height && col >= 0 && col < grid.width) {
                    blocked.push(row * grid.width + col);
                }
            }
        }

        startedAt = performance.now();
        const changed = applyBlockedCells(routingGrid, blocked);
        planner.moveStart(current);
        planner.notifyCellsChanged(changed);
        planner.replan();
        const replanned = planner.extractPath();
        const replanMs = performance.now() - startedAt;
        const replanExpanded = planner.lastExpandedCellCount;

        startedAt = performance.now();
        const fresh = findPathAStar(routingGrid, current, stagingIndex, "fast");
        const freshMs = performance.now() - startedAt;

        expect(fresh).not.toBeNull();
        expect(replanned).not.toBeNull();
        const difference = relativeDifference(planner.costFromStart(), fresh!.searchCost);
        console.log(
            `D* Lite ${knot.knot_id}: initial ${initialMs.toFixed(0)} ms; replan ${replanMs.toFixed(0)} ms (${replanExpanded} expansions) ` +
                `= ${planner.costFromStart().toFixed(2)} s; fresh A* ${freshMs.toFixed(0)} ms (${fresh!.expandedCellCount} expansions) ` +
                `= ${fresh!.searchCost.toFixed(2)} s; relative difference ${difference.toExponential(3)}`,
        );
        expect(difference).toBeLessThan(REPLAN_TOLERANCE);
        expect(relativeDifference(replanned!.searchCost, fresh!.searchCost)).toBeLessThan(REPLAN_TOLERANCE);
        for (const cell of replanned!.cellIndices) {
            expect(routingGrid.blockedCells[cell]).toBe(0);
        }
        applyBlockedCells(routingGrid, []);
    });

    it("RoutingSession computes fast and safe plans and reroutes on the real grid", () => {
        const session = new RoutingSession(routingGridInputFromProcessedData(data));
        const knot = data.knots[2];
        let startedAt = performance.now();
        const plans = session.computeRoutePlans(data.meta.staging_point, knot, []);
        const computeMs = performance.now() - startedAt;
        expect(plans.fast).toBeDefined();
        expect(plans.safe).toBeDefined();
        console.log(
            `RoutingSession staging point -> ${knot.knot_id}: fast ${plans.fast!.walking_time_s.toFixed(0)} s est. over ` +
                `${plans.fast!.horizontal_distance_m.toFixed(0)} m; safe ${plans.safe!.walking_time_s.toFixed(0)} s est. over ` +
                `${plans.safe!.horizontal_distance_m.toFixed(0)} m; both A* in ${computeMs.toFixed(0)} ms`,
        );
        expect(plans.safe!.walking_time_s).toBeGreaterThanOrEqual(plans.fast!.walking_time_s - 1e-6);

        startedAt = performance.now();
        session.prepareReplanners(data.meta.staging_point);
        const prepareMs = performance.now() - startedAt;

        const fastCells = plans.fast!.cell_indices;
        const current = plans.fast!.path_positions[30];
        const blocked = fastCells.slice(Math.floor(fastCells.length / 2), Math.floor(fastCells.length / 2) + 15);
        startedAt = performance.now();
        const rerouted = session.rerouteFrom(current, blocked);
        const rerouteMs = performance.now() - startedAt;
        console.log(`RoutingSession prepare ${prepareMs.toFixed(0)} ms; reroute (fast + safe) ${rerouteMs.toFixed(0)} ms`);

        const fresh = new RoutingSession(routingGridInputFromProcessedData(data)).computeRoutePlans(current, knot, blocked);
        expect(rerouted.fast).toBeDefined();
        expect(rerouted.safe).toBeDefined();
        expect(relativeDifference(rerouted.fast!.walking_time_s, fresh.fast!.walking_time_s)).toBeLessThan(REPLAN_TOLERANCE);
    });
});
