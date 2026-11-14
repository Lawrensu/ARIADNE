// Small synthetic grids and a plain reference Dijkstra, for the routing tests only.

import type { RouteOptionId } from "../state/routeSlice";
import type { RoutingGrid } from "./routingGrid";
import {
    NEIGHBOUR_COL_OFFSETS,
    NEIGHBOUR_COUNT,
    NEIGHBOUR_ROW_OFFSETS,
    createRoutingGrid,
    isCellPassable,
    searchEdgeCost,
} from "./routingGrid";
import { MinHeap } from "./priorityQueues";




// Deterministic pseudo-random numbers in [0, 1) (mulberry32), so test grids are reproducible.
export function createRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}


export interface SyntheticGridOptions {
    width: number;
    height: number;
    cellSizeMetres: number;
    seed: number;
    // Fraction of cells with traversal_penalty = +Infinity.
    impassableFraction: number;
    // Height noise amplitude, metres. Larger values create too-steep steps.
    heightAmplitudeMetres: number;
}


export function createSyntheticGrid(options: SyntheticGridOptions): RoutingGrid {
    const random = createRandom(options.seed);
    const cellCount = options.width * options.height;
    const heightmap = new Float32Array(cellCount);
    const penalty = new Float32Array(cellCount);
    const slope = new Float32Array(cellCount);
    const viewshed = new Uint8Array(cellCount);
    for (let row = 0; row < options.height; row++) {
        for (let col = 0; col < options.width; col++) {
            const index = row * options.width + col;
            // A smooth hill plus noise, so there are real uphill/downhill differences.
            const hill = 3 * Math.sin(col / 7) * Math.cos(row / 9);
            heightmap[index] = hill + options.heightAmplitudeMetres * random();
            if (random() < options.impassableFraction) {
                penalty[index] = Number.POSITIVE_INFINITY;
            } else {
                const roll = random();
                if (roll < 0.15) {
                    penalty[index] = 1.5;
                } else {
                    if (roll < 0.25) {
                        penalty[index] = 1.3;
                    } else {
                        penalty[index] = 1;
                    }
                }
            }
            slope[index] = 30 * random();
            if (random() < 0.3) {
                viewshed[index] = 0;
            } else {
                viewshed[index] = 1;
            }
        }
    }
    return createRoutingGrid({
        grid: { width: options.width, height: options.height, cell_size_m: options.cellSizeMetres },
        heightmap,
        traversal_penalty: penalty,
        slope_degrees: slope,
        viewshed_rover: viewshed,
    });
}


// Plain Dijkstra (no heuristic), the reference the A* and D* Lite results are checked against.
export function referenceDijkstraCost(
    routingGrid: RoutingGrid,
    startIndex: number,
    goalIndex: number,
    routeOption: RouteOptionId,
): number {
    if (!isCellPassable(routingGrid, startIndex)) {
        return Number.POSITIVE_INFINITY;
    }
    const width = routingGrid.grid.width;
    const height = routingGrid.grid.height;
    const cost = new Float64Array(routingGrid.cellCount).fill(Number.POSITIVE_INFINITY);
    const done = new Uint8Array(routingGrid.cellCount);
    const queue = new MinHeap();
    cost[startIndex] = 0;
    queue.push(startIndex, 0);
    while (queue.size > 0) {
        const current = queue.pop();
        if (done[current] === 1) {
            continue;
        }
        done[current] = 1;
        if (current === goalIndex) {
            return cost[current];
        }
        const row = Math.floor(current / width);
        const col = current - row * width;
        for (let direction = 0; direction < NEIGHBOUR_COUNT; direction++) {
            const neighbourRow = row + NEIGHBOUR_ROW_OFFSETS[direction];
            const neighbourCol = col + NEIGHBOUR_COL_OFFSETS[direction];
            if (neighbourRow < 0 || neighbourRow >= height) {
                continue;
            }
            if (neighbourCol < 0 || neighbourCol >= width) {
                continue;
            }
            const neighbour = neighbourRow * width + neighbourCol;
            const edgeCost = searchEdgeCost(routingGrid, routeOption, current, neighbour, routingGrid.stepDistanceMetres[direction]);
            if (!Number.isFinite(edgeCost)) {
                continue;
            }
            if (cost[current] + edgeCost < cost[neighbour]) {
                cost[neighbour] = cost[current] + edgeCost;
                queue.push(neighbour, cost[neighbour]);
            }
        }
    }
    return Number.POSITIVE_INFINITY;
}


// First passable cell scanning from a corner region, for picking test endpoints.
export function firstPassableCellNear(routingGrid: RoutingGrid, row: number, col: number): number {
    const width = routingGrid.grid.width;
    const height = routingGrid.grid.height;
    for (let radius = 0; radius < Math.max(width, height); radius++) {
        for (let r = row - radius; r <= row + radius; r++) {
            for (let c = col - radius; c <= col + radius; c++) {
                if (r < 0 || r >= height || c < 0 || c >= width) {
                    continue;
                }
                const index = r * width + c;
                if (isCellPassable(routingGrid, index)) {
                    return index;
                }
            }
        }
    }
    return -1;
}


export function relativeDifference(a: number, b: number): number {
    if (a === b) {
        return 0;
    }
    return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
}
