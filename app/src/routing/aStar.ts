// A* on the 8-connected walking graph (docs/system_design.md "Algorithms", routing).
// Binary heap with lazy deletion; heuristic from routingGrid.heuristicSeconds (admissible and
// consistent), so the first time the goal is popped its cost is optimal.

import type { RouteOptionId } from "../state/routeSlice";
import type { RoutingGrid } from "./routingGrid";
import {
    NEIGHBOUR_COL_OFFSETS,
    NEIGHBOUR_COUNT,
    NEIGHBOUR_ROW_OFFSETS,
    heuristicSeconds,
    isCellPassable,
    searchEdgeCost,
} from "./routingGrid";
import { MinHeap } from "./priorityQueues";




export interface GridPath {
    // Cell indices from start to goal, inclusive.
    cellIndices: number[];
    // Sum of the search edge costs (contract seconds for "fast", weighted for "safe").
    searchCost: number;
    expandedCellCount: number;
}




// Returns null when start or goal is impassable or the goal cannot be reached.
export function findPathAStar(
    routingGrid: RoutingGrid,
    startIndex: number,
    goalIndex: number,
    routeOption: RouteOptionId,
): GridPath | null {
    if (!isCellPassable(routingGrid, startIndex)) {
        return null;
    }
    if (!isCellPassable(routingGrid, goalIndex)) {
        return null;
    }
    if (startIndex === goalIndex) {
        return { cellIndices: [startIndex], searchCost: 0, expandedCellCount: 0 };
    }

    const width = routingGrid.grid.width;
    const height = routingGrid.grid.height;
    const costFromStart = new Float64Array(routingGrid.cellCount).fill(Number.POSITIVE_INFINITY);
    const parentOfCell = new Int32Array(routingGrid.cellCount).fill(-1);
    const isClosed = new Uint8Array(routingGrid.cellCount);
    const openSet = new MinHeap(4096);

    costFromStart[startIndex] = 0;
    openSet.push(startIndex, heuristicSeconds(routingGrid, startIndex, goalIndex));
    let expandedCellCount = 0;

    while (openSet.size > 0) {
        const current = openSet.pop();
        if (isClosed[current] === 1) {
            // Stale entry left by lazy deletion.
            continue;
        }
        isClosed[current] = 1;
        expandedCellCount += 1;
        if (current === goalIndex) {
            break;
        }

        const row = Math.floor(current / width);
        const col = current - row * width;
        const currentCost = costFromStart[current];
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
            if (isClosed[neighbour] === 1) {
                continue;
            }
            const edgeCost = searchEdgeCost(
                routingGrid,
                routeOption,
                current,
                neighbour,
                routingGrid.stepDistanceMetres[direction],
            );
            if (!Number.isFinite(edgeCost)) {
                continue;
            }
            const candidateCost = currentCost + edgeCost;
            if (candidateCost < costFromStart[neighbour]) {
                costFromStart[neighbour] = candidateCost;
                parentOfCell[neighbour] = current;
                openSet.push(neighbour, candidateCost + heuristicSeconds(routingGrid, neighbour, goalIndex));
            }
        }
    }

    if (isClosed[goalIndex] === 0) {
        return null;
    }

    const reversedPath: number[] = [];
    let cell = goalIndex;
    while (cell !== -1) {
        reversedPath.push(cell);
        cell = parentOfCell[cell];
    }
    reversedPath.reverse();
    return { cellIndices: reversedPath, searchCost: costFromStart[goalIndex], expandedCellCount };
}
