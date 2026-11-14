import { beforeAll, describe, expect, it } from "vitest";

import { cellFromPosition, cellIndex } from "../data/grid";
import type { ProcessedData } from "../data/loadProcessed";
import { loadProcessedDataFromDisk } from "../data/loadProcessedFromDisk";
import { findPathAStar } from "./aStar";
import { computeRoutePlansOnGrid, measurePath } from "./routePlans";
import type { RoutingGrid } from "./routingGrid";
import { applyBlockedCells, contractEdgeCostSeconds, createRoutingGrid, routingGridInputFromProcessedData } from "./routingGrid";
import { RoutingSession } from "./routingSession";
import { createRandom, createSyntheticGrid, firstPassableCellNear, relativeDifference } from "./syntheticGrids";
import { findPathThetaStar, measureSegmentPath, segmentCostSeconds } from "./thetaStar";
import { walkingTimeSeconds } from "./walkingTime";




const GRID_WIDTH = 40;
const GRID_HEIGHT = 30;
const CELL_SIZE_M = 2;
const FLAT_TIME_TOLERANCE = 1e-6;
// Largest accepted excess of Theta* time over A* time on random grids.
const SYNTHETIC_TIME_TOLERANCE = 0.02;
const REAL_DATA_TIME_TOLERANCE = 0.05;


interface TestGridLayers {
    heightmap: Float32Array;
    penalty: Float32Array;
}


function flatLayers(width: number, height: number): TestGridLayers {
    const cellCount = width * height;
    return { heightmap: new Float32Array(cellCount), penalty: new Float32Array(cellCount).fill(1) };
}


function gridFromLayers(width: number, height: number, layers: TestGridLayers): RoutingGrid {
    const cellCount = width * height;
    return createRoutingGrid({
        grid: { width, height, cell_size_m: CELL_SIZE_M },
        heightmap: layers.heightmap,
        traversal_penalty: layers.penalty,
        slope_degrees: new Float32Array(cellCount),
        viewshed_rover: new Uint8Array(cellCount).fill(1),
    });
}


function indexOfCell(row: number, col: number): number {
    return row * GRID_WIDTH + col;
}


// Every cell touched by dense sample points along each straight segment of the path.
function cellsTouchedBySegments(vertices: number[], width: number): number[] {
    const touched: number[] = [];
    const samplesPerSegment = 2000;
    for (let step = 1; step < vertices.length; step++) {
        const fromRow = Math.floor(vertices[step - 1] / width);
        const fromCol = vertices[step - 1] - fromRow * width;
        const toRow = Math.floor(vertices[step] / width);
        const toCol = vertices[step] - toRow * width;
        for (let sample = 0; sample <= samplesPerSegment; sample++) {
            const fraction = sample / samplesPerSegment;
            // Cell centres are at +0.5 in cell units.
            const row = Math.floor(fromRow + 0.5 + (toRow - fromRow) * fraction);
            const col = Math.floor(fromCol + 0.5 + (toCol - fromCol) * fraction);
            touched.push(row * width + col);
        }
    }
    return touched;
}




describe("segment cost (contracts.md section 4)", () => {
    it("equals the contract edge cost for 8-neighbours, including uphill and penalties", () => {
        const layers = flatLayers(5, 5);
        layers.heightmap[7] = 0.5;
        layers.penalty[8] = 1.5;
        const grid = gridFromLayers(5, 5, layers);
        const neighbourPairs: Array<[number, number, number]> = [
            [6, 7, CELL_SIZE_M],
            [7, 6, CELL_SIZE_M],
            [6, 12, CELL_SIZE_M * Math.SQRT2],
            [7, 8, CELL_SIZE_M],
            [12, 6, CELL_SIZE_M * Math.SQRT2],
        ];
        for (const [fromIndex, toIndex, distance] of neighbourPairs) {
            const expected = contractEdgeCostSeconds(grid, fromIndex, toIndex, distance);
            expect(segmentCostSeconds(grid, fromIndex, toIndex)).toBeCloseTo(expected, 12);
        }
    });

    it("a diagonal step does not touch the two side cells", () => {
        const layers = flatLayers(5, 5);
        layers.penalty[1] = Number.POSITIVE_INFINITY;
        layers.penalty[5] = Number.POSITIVE_INFINITY;
        const grid = gridFromLayers(5, 5, layers);
        expect(Number.isFinite(segmentCostSeconds(grid, 0, 6))).toBe(true);
    });

    it("is blocked by an impassable cell the segment crosses", () => {
        const layers = flatLayers(GRID_WIDTH, GRID_HEIGHT);
        layers.penalty[indexOfCell(5, 10)] = Number.POSITIVE_INFINITY;
        const grid = gridFromLayers(GRID_WIDTH, GRID_HEIGHT, layers);
        expect(segmentCostSeconds(grid, indexOfCell(5, 2), indexOfCell(5, 20))).toBe(Number.POSITIVE_INFINITY);
        expect(Number.isFinite(segmentCostSeconds(grid, indexOfCell(6, 2), indexOfCell(6, 20)))).toBe(true);
    });
});




describe("Theta* on an open flat grid", () => {
    it("finds a straight line whose time is the walking time over the Euclidean distance", () => {
        const grid = gridFromLayers(GRID_WIDTH, GRID_HEIGHT, flatLayers(GRID_WIDTH, GRID_HEIGHT));
        const endpoints: Array<[number, number, number, number]> = [
            [2, 2, 25, 33],
            [2, 2, 2, 36],
            [3, 4, 27, 4],
            [1, 1, 28, 28],
            [20, 5, 4, 31],
        ];
        for (const [startRow, startCol, goalRow, goalCol] of endpoints) {
            const start = indexOfCell(startRow, startCol);
            const goal = indexOfCell(goalRow, goalCol);
            const path = findPathThetaStar(grid, start, goal);
            expect(path).not.toBeNull();
            expect(path!.cellIndices).toEqual([start, goal]);

            const euclideanMetres = Math.hypot(goalRow - startRow, goalCol - startCol) * CELL_SIZE_M;
            const expectedSeconds = walkingTimeSeconds(euclideanMetres, 0);
            expect(Math.abs(path!.searchCost - expectedSeconds)).toBeLessThan(FLAT_TIME_TOLERANCE);
            const measures = measureSegmentPath(grid, path!.cellIndices);
            expect(Math.abs(measures.walkingTimeSeconds - expectedSeconds)).toBeLessThan(FLAT_TIME_TOLERANCE);
            expect(Math.abs(measures.horizontalDistanceMetres - euclideanMetres)).toBeLessThan(FLAT_TIME_TOLERANCE);
        }
    });
});




describe("Theta* around obstacles", () => {
    it("never crosses an impassable cell: a wall with a gap", () => {
        const layers = flatLayers(GRID_WIDTH, GRID_HEIGHT);
        const wallCol = 20;
        const gapRow = 24;
        for (let row = 0; row < GRID_HEIGHT; row++) {
            if (row !== gapRow) {
                layers.penalty[indexOfCell(row, wallCol)] = Number.POSITIVE_INFINITY;
            }
        }
        const grid = gridFromLayers(GRID_WIDTH, GRID_HEIGHT, layers);
        const start = indexOfCell(3, 3);
        const goal = indexOfCell(4, 36);
        const path = findPathThetaStar(grid, start, goal);
        expect(path).not.toBeNull();
        expect(path!.cellIndices.length).toBeGreaterThan(2);

        for (const cell of cellsTouchedBySegments(path!.cellIndices, GRID_WIDTH)) {
            expect(grid.traversalPenalty[cell]).not.toBe(Number.POSITIVE_INFINITY);
        }
        expect(Number.isFinite(measureSegmentPath(grid, path!.cellIndices).walkingTimeSeconds)).toBe(true);
        // It goes through the gap, and is shorter than the grid-edge route.
        const crossesWallAtGap = path!.cellIndices.some((cell) => {
            return cell === indexOfCell(gapRow, wallCol);
        });
        const touchesGap = cellsTouchedBySegments(path!.cellIndices, GRID_WIDTH).includes(indexOfCell(gapRow, wallCol));
        expect(crossesWallAtGap || touchesGap).toBe(true);
        const aStarPath = findPathAStar(grid, start, goal, "fast");
        expect(path!.searchCost).toBeLessThanOrEqual(aStarPath!.searchCost + 1e-9);
    });

    it("returns null when the goal is walled off", () => {
        const layers = flatLayers(GRID_WIDTH, GRID_HEIGHT);
        for (let row = 0; row < GRID_HEIGHT; row++) {
            layers.penalty[indexOfCell(row, 20)] = Number.POSITIVE_INFINITY;
        }
        const grid = gridFromLayers(GRID_WIDTH, GRID_HEIGHT, layers);
        expect(findPathThetaStar(grid, indexOfCell(3, 3), indexOfCell(4, 36))).toBeNull();
    });

    it("avoids a steep ridge (steps steeper than the walkable slope) and uses the pass", () => {
        const layers = flatLayers(GRID_WIDTH, GRID_HEIGHT);
        const ridgeCol = 20;
        const passRow = 25;
        // A 6 m high ridge one cell wide: every step onto it is about 70 degrees.
        for (let row = 0; row < GRID_HEIGHT; row++) {
            if (row !== passRow) {
                layers.heightmap[indexOfCell(row, ridgeCol)] = 6;
            }
        }
        const grid = gridFromLayers(GRID_WIDTH, GRID_HEIGHT, layers);
        const start = indexOfCell(4, 3);
        const goal = indexOfCell(4, 36);
        expect(segmentCostSeconds(grid, start, goal)).toBe(Number.POSITIVE_INFINITY);

        const path = findPathThetaStar(grid, start, goal);
        expect(path).not.toBeNull();
        const measures = measureSegmentPath(grid, path!.cellIndices);
        expect(Number.isFinite(measures.walkingTimeSeconds)).toBe(true);
        for (const cell of cellsTouchedBySegments(path!.cellIndices, GRID_WIDTH)) {
            const row = Math.floor(cell / GRID_WIDTH);
            const col = cell - row * GRID_WIDTH;
            if (col === ridgeCol) {
                expect(row).toBe(passRow);
            }
        }
    });

    it("respects runtime-blocked cells", () => {
        const grid = gridFromLayers(GRID_WIDTH, GRID_HEIGHT, flatLayers(GRID_WIDTH, GRID_HEIGHT));
        const blocked: number[] = [];
        for (let row = 0; row < 20; row++) {
            blocked.push(indexOfCell(row, 20));
        }
        applyBlockedCells(grid, blocked);
        const path = findPathThetaStar(grid, indexOfCell(4, 3), indexOfCell(4, 36));
        expect(path).not.toBeNull();
        for (const cell of cellsTouchedBySegments(path!.cellIndices, GRID_WIDTH)) {
            expect(grid.blockedCells[cell]).toBe(0);
        }
    });
});




describe("Theta* against A* on random grids", () => {
    it("is never more than 2% slower than A* on rough random grids (random heights, penalties, obstacles)", () => {
        let comparedCount = 0;
        for (let seed = 1; seed <= 12; seed++) {
            const grid = createSyntheticGrid({
                width: 70,
                height: 50,
                cellSizeMetres: CELL_SIZE_M,
                seed,
                impassableFraction: 0.15,
                heightAmplitudeMetres: 0.3,
            });
            const start = firstPassableCellNear(grid, 2, 2);
            const goal = firstPassableCellNear(grid, 46, 66);
            const aStarPath = findPathAStar(grid, start, goal, "fast");
            const thetaPath = findPathThetaStar(grid, start, goal);
            if (aStarPath === null) {
                expect(thetaPath).toBeNull();
                continue;
            }
            expect(thetaPath).not.toBeNull();
            comparedCount += 1;

            const aStarMeasures = measurePath(grid, aStarPath.cellIndices);
            const thetaMeasures = measureSegmentPath(grid, thetaPath!.cellIndices);
            expect(Number.isFinite(thetaMeasures.walkingTimeSeconds)).toBe(true);
            expect(relativeDifference(thetaMeasures.walkingTimeSeconds, thetaPath!.searchCost)).toBeLessThan(1e-9);
            expect(thetaMeasures.walkingTimeSeconds).toBeLessThanOrEqual(aStarMeasures.walkingTimeSeconds * (1 + SYNTHETIC_TIME_TOLERANCE));
        }
        expect(comparedCount).toBeGreaterThan(6);
    });

    // On rough ground Theta* minimises time, and a slightly longer route can be faster (for example
    // to ride gentle downhill steps), so "never longer" is only a valid check where time is
    // proportional to distance: flat ground with random obstacles.
    it("is never longer in distance than A* on flat random obstacle grids, and never slower", () => {
        let comparedCount = 0;
        for (let seed = 1; seed <= 12; seed++) {
            const layers = flatLayers(70, 50);
            const random = createRandom(seed);
            for (let index = 0; index < layers.penalty.length; index++) {
                if (random() < 0.2) {
                    layers.penalty[index] = Number.POSITIVE_INFINITY;
                }
            }
            const grid = gridFromLayers(70, 50, layers);
            const start = firstPassableCellNear(grid, 2, 2);
            const goal = firstPassableCellNear(grid, 46, 66);
            const aStarPath = findPathAStar(grid, start, goal, "fast");
            const thetaPath = findPathThetaStar(grid, start, goal);
            if (aStarPath === null) {
                expect(thetaPath).toBeNull();
                continue;
            }
            expect(thetaPath).not.toBeNull();
            comparedCount += 1;
            const aStarMeasures = measurePath(grid, aStarPath.cellIndices);
            const thetaMeasures = measureSegmentPath(grid, thetaPath!.cellIndices);
            expect(thetaMeasures.horizontalDistanceMetres).toBeLessThanOrEqual(aStarMeasures.horizontalDistanceMetres + 1e-9);
            expect(thetaMeasures.walkingTimeSeconds).toBeLessThanOrEqual(aStarMeasures.walkingTimeSeconds * (1 + SYNTHETIC_TIME_TOLERANCE));
        }
        expect(comparedCount).toBeGreaterThan(6);
    });

    it("computeRoutePlansOnGrid adds a smooth plan next to fast and safe", () => {
        const grid = createSyntheticGrid({
            width: 80,
            height: 60,
            cellSizeMetres: CELL_SIZE_M,
            seed: 42,
            impassableFraction: 0.1,
            heightAmplitudeMetres: 0.3,
        });
        const start = firstPassableCellNear(grid, 3, 3);
        const end = firstPassableCellNear(grid, 55, 75);
        const startPosition = { x_m: (start % 80) * CELL_SIZE_M + 1, z_m: Math.floor(start / 80) * CELL_SIZE_M + 1 };
        const endPosition = { x_m: (end % 80) * CELL_SIZE_M + 1, z_m: Math.floor(end / 80) * CELL_SIZE_M + 1 };
        const plans = computeRoutePlansOnGrid(grid, startPosition, endPosition);
        expect(plans.fast).toBeDefined();
        expect(plans.safe).toBeDefined();
        expect(plans.smooth).toBeDefined();
        expect(plans.smooth!.route_option).toBe("smooth");
        expect(plans.smooth!.is_estimate).toBe(true);
        expect(plans.smooth!.path_positions.length).toBe(plans.smooth!.cell_indices.length);
        expect(plans.smooth!.path_positions.length).toBeLessThan(plans.fast!.path_positions.length);
        expect(plans.smooth!.horizontal_distance_m).toBeLessThanOrEqual(plans.fast!.horizontal_distance_m + 1e-9);
    });
});




describe("real data: Theta* from the rover to each Knot", () => {
    let data: ProcessedData;
    let routingGrid: RoutingGrid;

    beforeAll(async () => {
        data = await loadProcessedDataFromDisk();
        routingGrid = createRoutingGrid(routingGridInputFromProcessedData(data));
    });

    it("is finite and within 5% of A* fast for every Knot", () => {
        const grid = data.meta.grid;
        const stagingIndex = cellIndex(grid, cellFromPosition(grid, data.meta.staging_point));
        expect(data.knots.length).toBeGreaterThan(0);
        console.log("knot_id | A* s | A* m | A* ms | Theta* s | Theta* m | Theta* ms | vertices | time ratio");
        for (const knot of data.knots) {
            const knotIndex = cellIndex(grid, cellFromPosition(grid, knot));

            let startedAt = performance.now();
            const aStarPath = findPathAStar(routingGrid, stagingIndex, knotIndex, "fast");
            const aStarMs = performance.now() - startedAt;
            expect(aStarPath).not.toBeNull();
            const aStarMeasures = measurePath(routingGrid, aStarPath!.cellIndices);

            startedAt = performance.now();
            const thetaPath = findPathThetaStar(routingGrid, stagingIndex, knotIndex);
            const thetaMs = performance.now() - startedAt;
            expect(thetaPath).not.toBeNull();
            const thetaMeasures = measureSegmentPath(routingGrid, thetaPath!.cellIndices);

            const ratio = thetaMeasures.walkingTimeSeconds / aStarMeasures.walkingTimeSeconds;
            console.log(
                `${knot.knot_id} | ${aStarMeasures.walkingTimeSeconds.toFixed(1)} | ${aStarMeasures.horizontalDistanceMetres.toFixed(1)} | ${aStarMs.toFixed(0)} | ` +
                    `${thetaMeasures.walkingTimeSeconds.toFixed(1)} | ${thetaMeasures.horizontalDistanceMetres.toFixed(1)} | ${thetaMs.toFixed(0)} | ` +
                    `${thetaPath!.cellIndices.length} | ${ratio.toFixed(4)}`,
            );
            expect(Number.isFinite(thetaMeasures.walkingTimeSeconds)).toBe(true);
            expect(Number.isFinite(thetaMeasures.horizontalDistanceMetres)).toBe(true);
            expect(relativeDifference(thetaMeasures.walkingTimeSeconds, thetaPath!.searchCost)).toBeLessThan(1e-9);
            expect(ratio).toBeLessThanOrEqual(1 + REAL_DATA_TIME_TOLERANCE);
        }
    });

    it("RoutingSession returns a smooth plan, also after a reroute", () => {
        const session = new RoutingSession(routingGridInputFromProcessedData(data));
        const knot = data.knots[2];
        const plans = session.computeRoutePlans(data.meta.staging_point, knot, []);
        expect(plans.smooth).toBeDefined();
        expect(Number.isFinite(plans.smooth!.walking_time_s)).toBe(true);
        session.prepareReplanners(data.meta.staging_point);
        const fastCells = plans.fast!.cell_indices;
        const blocked = fastCells.slice(Math.floor(fastCells.length / 2), Math.floor(fastCells.length / 2) + 15);
        const rerouted = session.rerouteFrom(plans.fast!.path_positions[30], blocked);
        expect(rerouted.smooth).toBeDefined();
        for (const vertex of rerouted.smooth!.cell_indices) {
            expect(blocked).not.toContain(vertex);
        }
    });
});
