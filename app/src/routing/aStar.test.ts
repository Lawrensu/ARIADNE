import { describe, expect, it } from "vitest";

import { findPathAStar } from "./aStar";
import { computeRoutePlan, computeRoutePlansOnGrid, measurePath } from "./routePlans";
import {
    SAFE_NO_COMMS_WEIGHT,
    SAFE_PENALTY_WEIGHT,
    SAFE_SLOPE_WEIGHT,
    SNAP_RADIUS_M,
    applyBlockedCells,
    cellCentreFromIndex,
    contractEdgeCostSeconds,
    createRoutingGrid,
    heuristicSeconds,
    safeEdgeWeight,
} from "./routingGrid";
import { walkingTimeSeconds } from "./walkingTime";
import { createSyntheticGrid, firstPassableCellNear, referenceDijkstraCost, relativeDifference } from "./syntheticGrids";




function flatGrid(width: number, height: number, cellSizeMetres: number) {
    const cellCount = width * height;
    return createRoutingGrid({
        grid: { width, height, cell_size_m: cellSizeMetres },
        heightmap: new Float32Array(cellCount),
        traversal_penalty: new Float32Array(cellCount).fill(1),
        slope_degrees: new Float32Array(cellCount),
        viewshed_rover: new Uint8Array(cellCount).fill(1),
    });
}




describe("contract edge cost (contracts.md 4.2)", () => {
    it("is walking time times the max penalty of the two cells, and direction-dependent", () => {
        const grid = createRoutingGrid({
            grid: { width: 2, height: 1, cell_size_m: 2 },
            heightmap: new Float32Array([0, 0.4]),
            traversal_penalty: new Float32Array([1, 1.5]),
            slope_degrees: new Float32Array([0, 0]),
            viewshed_rover: new Uint8Array([1, 1]),
        });
        const uphill = contractEdgeCostSeconds(grid, 0, 1, 2);
        const downhill = contractEdgeCostSeconds(grid, 1, 0, 2);
        expect(uphill).toBeCloseTo(walkingTimeSeconds(2, Math.fround(0.4)) * 1.5, 9);
        expect(downhill).toBeCloseTo(walkingTimeSeconds(2, -Math.fround(0.4)) * 1.5, 9);
        expect(uphill).not.toBeCloseTo(downhill, 3);
    });

    it("does not exist for +Infinity penalty, NaN height, too-steep steps or blocked cells", () => {
        const grid = createRoutingGrid({
            grid: { width: 4, height: 1, cell_size_m: 2 },
            heightmap: new Float32Array([0, 0, Number.NaN, 5]),
            traversal_penalty: new Float32Array([1, Number.POSITIVE_INFINITY, 1, 1]),
            slope_degrees: new Float32Array(4),
            viewshed_rover: new Uint8Array(4).fill(1),
        });
        expect(contractEdgeCostSeconds(grid, 0, 1, 2)).toBe(Number.POSITIVE_INFINITY);
        expect(contractEdgeCostSeconds(grid, 1, 0, 2)).toBe(Number.POSITIVE_INFINITY);
        expect(contractEdgeCostSeconds(grid, 2, 3, 2)).toBe(Number.POSITIVE_INFINITY);
        // 0 m to 5 m over 2 m is 68 degrees.
        const steep = createRoutingGrid({
            grid: { width: 2, height: 1, cell_size_m: 2 },
            heightmap: new Float32Array([0, 5]),
            traversal_penalty: new Float32Array([1, 1]),
            slope_degrees: new Float32Array(2),
            viewshed_rover: new Uint8Array(2).fill(1),
        });
        expect(contractEdgeCostSeconds(steep, 0, 1, 2)).toBe(Number.POSITIVE_INFINITY);
        const flat = flatGrid(2, 1, 2);
        expect(Number.isFinite(contractEdgeCostSeconds(flat, 0, 1, 2))).toBe(true);
        applyBlockedCells(flat, [1]);
        expect(contractEdgeCostSeconds(flat, 0, 1, 2)).toBe(Number.POSITIVE_INFINITY);
    });
});




describe("findPathAStar", () => {
    it("finds the octile path on flat ground with the exact contract time", () => {
        const grid = flatGrid(20, 10, 2);
        const start = 0;
        const goal = 9 * 20 + 19;
        const path = findPathAStar(grid, start, goal, "fast");
        expect(path).not.toBeNull();
        // 9 diagonal steps and 10 straight steps.
        const expected = 9 * walkingTimeSeconds(2 * Math.SQRT2, 0) + 10 * walkingTimeSeconds(2, 0);
        expect(path!.searchCost).toBeCloseTo(expected, 9);
        expect(path!.cellIndices[0]).toBe(start);
        expect(path!.cellIndices[path!.cellIndices.length - 1]).toBe(goal);
        expect(path!.cellIndices.length).toBe(20);
    });

    it("heuristic never overestimates on flat ground", () => {
        const grid = flatGrid(30, 30, 2);
        const path = findPathAStar(grid, 0, 30 * 30 - 1, "fast");
        expect(heuristicSeconds(grid, 0, 30 * 30 - 1)).toBeLessThanOrEqual(path!.searchCost + 1e-9);
    });

    it("matches a plain Dijkstra on random grids, for both route options", () => {
        for (let seed = 1; seed <= 8; seed++) {
            const grid = createSyntheticGrid({
                width: 60,
                height: 45,
                cellSizeMetres: 2,
                seed,
                impassableFraction: 0.2,
                heightAmplitudeMetres: 0.8,
            });
            const start = firstPassableCellNear(grid, 2, 2);
            const goal = firstPassableCellNear(grid, 42, 57);
            for (const routeOption of ["fast", "safe"] as const) {
                const reference = referenceDijkstraCost(grid, start, goal, routeOption);
                const path = findPathAStar(grid, start, goal, routeOption);
                if (Number.isFinite(reference)) {
                    expect(path).not.toBeNull();
                    expect(relativeDifference(path!.searchCost, reference)).toBeLessThan(1e-9);
                } else {
                    expect(path).toBeNull();
                }
            }
        }
    });

    it("returns null when the goal is walled off", () => {
        const grid = flatGrid(10, 10, 2);
        const wall: number[] = [];
        for (let row = 0; row < 10; row++) {
            wall.push(row * 10 + 5);
        }
        applyBlockedCells(grid, wall);
        expect(findPathAStar(grid, 0, 9, "fast")).toBeNull();
        applyBlockedCells(grid, wall.slice(1));
        expect(findPathAStar(grid, 0, 9, "fast")).not.toBeNull();
    });

    it("routes around runtime-blocked cells", () => {
        const grid = flatGrid(10, 10, 2);
        const before = findPathAStar(grid, 0 * 10 + 0, 0 * 10 + 9, "fast")!;
        applyBlockedCells(grid, [0 * 10 + 5, 1 * 10 + 5]);
        const after = findPathAStar(grid, 0 * 10 + 0, 0 * 10 + 9, "fast")!;
        expect(after.searchCost).toBeGreaterThan(before.searchCost);
        expect(after.cellIndices.includes(5)).toBe(false);
        expect(after.cellIndices.includes(15)).toBe(false);
    });
});




describe("route options and RoutePlan", () => {
    it("returns fast and safe plans with contract walking time, distance and positions", () => {
        const grid = createSyntheticGrid({
            width: 80,
            height: 60,
            cellSizeMetres: 2,
            seed: 42,
            impassableFraction: 0.1,
            heightAmplitudeMetres: 0.5,
        });
        const start = cellCentreFromIndex(grid, firstPassableCellNear(grid, 3, 3));
        const end = cellCentreFromIndex(grid, firstPassableCellNear(grid, 55, 75));
        const plans = computeRoutePlansOnGrid(grid, start, end);
        expect(plans.fast).toBeDefined();
        expect(plans.safe).toBeDefined();
        const fast = plans.fast!;
        const safe = plans.safe!;
        expect(fast.route_option).toBe("fast");
        expect(safe.route_option).toBe("safe");
        expect(fast.is_estimate).toBe(true);
        expect(fast.path_positions.length).toBe(fast.cell_indices.length);
        expect(fast.path_positions[0]).toEqual(start);
        expect(fast.path_positions[fast.path_positions.length - 1]).toEqual(end);

        // walking_time_s is the contract time along the path, also for "safe".
        const fastPath = findPathAStar(grid, fast.cell_indices[0], fast.cell_indices[fast.cell_indices.length - 1], "fast")!;
        expect(fast.walking_time_s).toBeCloseTo(fastPath.searchCost, 6);
        expect(safe.walking_time_s).toBeCloseTo(measurePath(grid, safe.cell_indices).walkingTimeSeconds, 9);
        // "fast" is the minimum contract time, so "safe" can only be as fast or slower.
        expect(safe.walking_time_s).toBeGreaterThanOrEqual(fast.walking_time_s - 1e-9);
    });

    it("safe weight is >= 1 and grows with slope, penalty and lost comms", () => {
        const grid = createRoutingGrid({
            grid: { width: 3, height: 1, cell_size_m: 2 },
            heightmap: new Float32Array(3),
            traversal_penalty: new Float32Array([1, 1.5, 1]),
            slope_degrees: new Float32Array([0, 12.5, 0]),
            viewshed_rover: new Uint8Array([1, 1, 0]),
        });
        expect(safeEdgeWeight(grid, 0, 0)).toBe(1);
        // Slope 12.5 of 25 degrees -> fraction 0.5, squared 0.25; penalty excess 0.5.
        expect(safeEdgeWeight(grid, 0, 1)).toBeCloseTo(1 + SAFE_SLOPE_WEIGHT * 0.25 + SAFE_PENALTY_WEIGHT * 0.5, 9);
        expect(safeEdgeWeight(grid, 0, 2)).toBeCloseTo(1 + SAFE_NO_COMMS_WEIGHT, 9);
    });

    it("snaps an impassable start to the nearest passable cell within the snap radius", () => {
        const grid = flatGrid(20, 20, 2);
        const blocked: number[] = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                blocked.push(row * 20 + col);
            }
        }
        applyBlockedCells(grid, blocked);
        const plan = computeRoutePlan(grid, "fast", { x_m: 1, z_m: 1 }, { x_m: 39, z_m: 39 });
        expect(plan).not.toBeNull();
        const snappedStart = plan!.path_positions[0];
        const snapDistance = Math.hypot(snappedStart.x_m - 1, snappedStart.z_m - 1);
        expect(snapDistance).toBeLessThanOrEqual(SNAP_RADIUS_M);
        expect(blocked.includes(plan!.cell_indices[0])).toBe(false);
    });

    it("returns null when no passable cell is within the snap radius", () => {
        const grid = flatGrid(30, 30, 2);
        const blocked: number[] = [];
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                blocked.push(row * 30 + col);
            }
        }
        applyBlockedCells(grid, blocked);
        expect(computeRoutePlan(grid, "fast", { x_m: 1, z_m: 1 }, { x_m: 59, z_m: 59 })).toBeNull();
        expect(computeRoutePlansOnGrid(grid, { x_m: 1, z_m: 1 }, { x_m: 59, z_m: 59 })).toEqual({});
    });
});
