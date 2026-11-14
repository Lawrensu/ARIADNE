// Theta* any-angle routing on the same routing grid as A* (docs/system_design.md "Algorithms").
// Basic Theta*: when a neighbour is relaxed, the parent of the current node is tried first. If
// there is line of sight from that parent to the neighbour, the neighbour is reached by one
// straight segment, so routes are smooth lines across open ground instead of 8-direction zig-zags.
//
// The segment cost stays faithful to the contract walking model (contracts.md section 4):
//   - the segment is walked through every grid cell it crosses (integer supercover traversal in
//     cell coordinates, x east, z south, no floating point decisions);
//   - the segment is blocked if any crossed cell has effective penalty +Infinity or an unknown height;
//   - consecutive crossed cells are always 8-neighbours, so the segment is a chain of contract edges
//     between cell centres: each one is walking_time_seconds(centre to centre distance, height
//     difference) times the max penalty of the two cells (walkingTime.ts, not re-implemented here);
//     if any of them is steeper than max_walkable_slope_deg, the segment is blocked;
//   - the segment is charged for the progress it makes along its own line, not for the zig-zag of
//     centres: each edge counts for (distance its cell centre advances along the segment) /
//     (centre to centre distance) of its cost. Over a flat open grid the total is exactly
//     walking_time_seconds(straight-line distance), and for two 8-neighbours it is exactly the
//     contract edge cost.
//
// Objective: contract seconds only (the "fast" cost), the same number the route plan reports.

import type { GridPath } from "./aStar";
import type { RoutingGrid } from "./routingGrid";
import {
    NEIGHBOUR_COL_OFFSETS,
    NEIGHBOUR_COUNT,
    NEIGHBOUR_ROW_OFFSETS,
    contractEdgeCostSeconds,
    isCellPassable,
} from "./routingGrid";
import { MinHeap } from "./priorityQueues";




// Path 2 (straight from the parent) wins a tie with path 1 (the grid step). The tolerance absorbs
// floating point rounding, so a straight line over open ground is one segment and not a chain of
// collinear vertices whose costs differ only in the 13th digit.
const TIE_TOLERANCE_SECONDS = 1e-9;




// Contract seconds to walk the straight segment between two cell centres, or +Infinity when the
// segment is blocked. For two 8-neighbours this equals contractEdgeCostSeconds exactly.
// Direction-dependent, like the contract edge cost.
export function segmentCostSeconds(routingGrid: RoutingGrid, fromIndex: number, toIndex: number): number {
    if (!isCellPassable(routingGrid, fromIndex)) {
        return Number.POSITIVE_INFINITY;
    }
    if (!isCellPassable(routingGrid, toIndex)) {
        return Number.POSITIVE_INFINITY;
    }
    if (fromIndex === toIndex) {
        return 0;
    }

    const width = routingGrid.grid.width;
    const cellSizeMetres = routingGrid.grid.cell_size_m;
    const fromRow = Math.floor(fromIndex / width);
    const fromCol = fromIndex - fromRow * width;
    const toRow = Math.floor(toIndex / width);
    const toCol = toIndex - toRow * width;

    const colSteps = Math.abs(toCol - fromCol);
    const rowSteps = Math.abs(toRow - fromRow);
    let colDirection = 1;
    if (toCol < fromCol) {
        colDirection = -1;
    }
    let rowDirection = 1;
    if (toRow < fromRow) {
        rowDirection = -1;
    }
    const segmentLengthCells = Math.hypot(colSteps, rowSteps);

    let colsDone = 0;
    let rowsDone = 0;
    let previousCellIndex = fromIndex;
    let previousDistanceMetres = 0;
    let totalSeconds = 0;

    while (colsDone < colSteps || rowsDone < rowSteps) {
        // Which cell boundary does the segment cross next? Compare (colsDone + 0.5) / colSteps with
        // (rowsDone + 0.5) / rowSteps using integers. A tie is the segment passing exactly through a
        // cell corner: it moves diagonally and does not touch the two side cells, so a diagonal
        // neighbour step is the same edge as in A*.
        let stepsColumn: boolean;
        let stepsRow: boolean;
        if (colsDone >= colSteps) {
            stepsColumn = false;
            stepsRow = true;
        } else {
            if (rowsDone >= rowSteps) {
                stepsColumn = true;
                stepsRow = false;
            } else {
                const decision = (2 * colsDone + 1) * rowSteps - (2 * rowsDone + 1) * colSteps;
                stepsColumn = decision <= 0;
                stepsRow = decision >= 0;
            }
        }
        let edgeLengthMetres = cellSizeMetres;
        if (stepsColumn) {
            colsDone += 1;
        }
        if (stepsRow) {
            rowsDone += 1;
        }
        if (stepsColumn && stepsRow) {
            edgeLengthMetres = cellSizeMetres * Math.SQRT2;
        }

        const cellIndexHere = (fromRow + rowsDone * rowDirection) * width + (fromCol + colsDone * colDirection);
        const edgeSeconds = contractEdgeCostSeconds(routingGrid, previousCellIndex, cellIndexHere, edgeLengthMetres);
        if (!Number.isFinite(edgeSeconds)) {
            return Number.POSITIVE_INFINITY;
        }

        // Distance of this cell centre along the segment (projection onto it).
        const distanceMetres = ((colsDone * colSteps + rowsDone * rowSteps) / segmentLengthCells) * cellSizeMetres;
        totalSeconds += edgeSeconds * ((distanceMetres - previousDistanceMetres) / edgeLengthMetres);
        previousCellIndex = cellIndexHere;
        previousDistanceMetres = distanceMetres;
    }
    return totalSeconds;
}




// Straight-line distance divided by the peak walking speed. Admissible for any-angle paths
// (the octile heuristic of A* is not: a straight segment can be shorter than the octile distance).
function straightLineHeuristicSeconds(routingGrid: RoutingGrid, fromIndex: number, toIndex: number): number {
    const width = routingGrid.grid.width;
    const fromRow = Math.floor(fromIndex / width);
    const fromCol = fromIndex - fromRow * width;
    const toRow = Math.floor(toIndex / width);
    const toCol = toIndex - toRow * width;
    const distanceMetres = Math.hypot(toRow - fromRow, toCol - fromCol) * routingGrid.grid.cell_size_m;
    return distanceMetres / routingGrid.peakSpeedMetresPerSecond;
}


// Returns the vertices of the route (cell indices, start to goal, joined by straight segments) in
// GridPath.cellIndices, or null when start or goal is impassable or the goal cannot be reached.
export function findPathThetaStar(routingGrid: RoutingGrid, startIndex: number, goalIndex: number): GridPath | null {
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
    // The start is its own parent, so "try the parent first" has nothing to try for its neighbours.
    parentOfCell[startIndex] = startIndex;
    openSet.push(startIndex, straightLineHeuristicSeconds(routingGrid, startIndex, goalIndex));
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
        const currentParent = parentOfCell[current];
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

            // Path 1 (as in A*): the contract edge from the current node.
            let candidateParent = current;
            let candidateCost = Number.POSITIVE_INFINITY;
            const edgeCost = contractEdgeCostSeconds(
                routingGrid,
                current,
                neighbour,
                routingGrid.stepDistanceMetres[direction],
            );
            if (Number.isFinite(edgeCost)) {
                candidateCost = costFromStart[current] + edgeCost;
            }

            // Path 2 of Theta*: straight from the parent of the current node, if there is line of
            // sight. Taken whenever it is not more expensive than path 1 (on uneven or rough ground
            // a straight segment can cost more than the short grid step, and then path 1 is kept).
            if (currentParent !== current) {
                const segmentCost = segmentCostSeconds(routingGrid, currentParent, neighbour);
                if (Number.isFinite(segmentCost)) {
                    const parentCost = costFromStart[currentParent] + segmentCost;
                    if (parentCost <= candidateCost + TIE_TOLERANCE_SECONDS) {
                        candidateParent = currentParent;
                        candidateCost = parentCost;
                    }
                }
            }

            if (!Number.isFinite(candidateCost)) {
                continue;
            }

            if (candidateCost < costFromStart[neighbour]) {
                costFromStart[neighbour] = candidateCost;
                parentOfCell[neighbour] = candidateParent;
                openSet.push(neighbour, candidateCost + straightLineHeuristicSeconds(routingGrid, neighbour, goalIndex));
            }
        }
    }

    if (isClosed[goalIndex] === 0) {
        return null;
    }

    const reversedVertices: number[] = [];
    let cell = goalIndex;
    while (cell !== startIndex) {
        reversedVertices.push(cell);
        cell = parentOfCell[cell];
    }
    reversedVertices.push(startIndex);
    reversedVertices.reverse();
    return { cellIndices: reversedVertices, searchCost: costFromStart[goalIndex], expandedCellCount };
}




export interface SegmentPathMeasures {
    walkingTimeSeconds: number;
    horizontalDistanceMetres: number;
}


// Contract walking time and straight-line length along consecutive vertices joined by segments.
// Returns +Infinity time if a segment is blocked (should not happen for search output).
export function measureSegmentPath(routingGrid: RoutingGrid, vertexIndices: number[]): SegmentPathMeasures {
    const width = routingGrid.grid.width;
    let totalSeconds = 0;
    let horizontalDistanceMetres = 0;
    for (let step = 1; step < vertexIndices.length; step++) {
        const fromIndex = vertexIndices[step - 1];
        const toIndex = vertexIndices[step];
        const segmentSeconds = segmentCostSeconds(routingGrid, fromIndex, toIndex);
        if (!Number.isFinite(segmentSeconds)) {
            return { walkingTimeSeconds: Number.POSITIVE_INFINITY, horizontalDistanceMetres: Number.NaN };
        }
        totalSeconds += segmentSeconds;
        const fromRow = Math.floor(fromIndex / width);
        const fromCol = fromIndex - fromRow * width;
        const toRow = Math.floor(toIndex / width);
        const toCol = toIndex - toRow * width;
        horizontalDistanceMetres += Math.hypot(toRow - fromRow, toCol - fromCol) * routingGrid.grid.cell_size_m;
    }
    return { walkingTimeSeconds: totalSeconds, horizontalDistanceMetres };
}
