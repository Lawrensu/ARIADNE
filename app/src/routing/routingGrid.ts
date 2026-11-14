// The 8-connected walking graph on the local grid (docs/contracts.md 1.1 and 4.2).
// The graph is implicit: edges are computed on demand from the heightmap and traversal_penalty,
// so nothing of size cells x 8 is stored. Sizes always come from meta.json (never hard-coded).
//
// Cell index = row * width + col, row 0 = north (contracts.md 1.1).

import type { GridDefinition, LocalPosition, WalkingParameters } from "../data/contracts";
import { cellCentre, cellFromIndex, cellFromPosition, cellIndex } from "../data/grid";
import type { ProcessedData } from "../data/loadProcessed";
import type { RouteOptionId } from "../state/routeSlice";
import type { WalkingTimeParameters } from "./walkingTime";
import { DEFAULT_WALKING_PARAMETERS, peakWalkingSpeedMetresPerSecond, walkingTimeSeconds } from "./walkingTime";




// Everything the routing needs, as plain data so it can be sent to the Web Worker.
export interface RoutingGridInput {
    grid: GridDefinition;
    heightmap: Float32Array;
    traversal_penalty: Float32Array;
    slope_degrees: Float32Array;
    viewshed_rover: Uint8Array;
    parameters?: WalkingParameters;
}


export interface RoutingGrid {
    grid: GridDefinition;
    cellCount: number;
    heightmap: Float32Array;
    traversalPenalty: Float32Array;
    slopeDegrees: Float32Array;
    viewshedRover: Uint8Array;
    walkingParameters: WalkingTimeParameters;
    // 1 = blocked at runtime (for example a hazard). Treated as traversal_penalty = +Infinity.
    blockedCells: Uint8Array;
    // Per neighbour direction (same order as NEIGHBOUR_ROW_OFFSETS): horizontal step length, metres.
    stepDistanceMetres: Float64Array;
    peakSpeedMetresPerSecond: number;
}




// 8-connected neighbours (contracts.md 4.2), same order as the pipeline's NEIGHBOUR_OFFSETS.
export const NEIGHBOUR_ROW_OFFSETS = [-1, -1, -1, 0, 0, 1, 1, 1];
export const NEIGHBOUR_COL_OFFSETS = [-1, 0, 1, -1, 1, -1, 0, 1];
export const NEIGHBOUR_COUNT = 8;




export function createRoutingGrid(input: RoutingGridInput): RoutingGrid {
    const cellCount = input.grid.width * input.grid.height;
    const layers: Array<[string, ArrayLike<number>]> = [
        ["heightmap", input.heightmap],
        ["traversal_penalty", input.traversal_penalty],
        ["slope_degrees", input.slope_degrees],
        ["viewshed_rover", input.viewshed_rover],
    ];
    for (const [layerId, values] of layers) {
        if (values.length !== cellCount) {
            throw new Error(`Routing grid: ${layerId} has ${values.length} values, expected ${cellCount}`);
        }
    }

    let walkingParameters: WalkingTimeParameters = DEFAULT_WALKING_PARAMETERS;
    if (input.parameters !== undefined) {
        walkingParameters = {
            suit_speed_factor: input.parameters.suit_speed_factor,
            gravity_adjustment: input.parameters.gravity_adjustment,
            max_walkable_slope_deg: input.parameters.max_walkable_slope_deg,
        };
    }

    const stepDistanceMetres = new Float64Array(NEIGHBOUR_COUNT);
    for (let direction = 0; direction < NEIGHBOUR_COUNT; direction++) {
        const isDiagonal = NEIGHBOUR_ROW_OFFSETS[direction] !== 0 && NEIGHBOUR_COL_OFFSETS[direction] !== 0;
        if (isDiagonal) {
            stepDistanceMetres[direction] = input.grid.cell_size_m * Math.SQRT2;
        } else {
            stepDistanceMetres[direction] = input.grid.cell_size_m;
        }
    }

    return {
        grid: input.grid,
        cellCount,
        heightmap: input.heightmap,
        traversalPenalty: input.traversal_penalty,
        slopeDegrees: input.slope_degrees,
        viewshedRover: input.viewshed_rover,
        walkingParameters,
        blockedCells: new Uint8Array(cellCount),
        stepDistanceMetres,
        peakSpeedMetresPerSecond: peakWalkingSpeedMetresPerSecond(walkingParameters),
    };
}


// Input for createRoutingGrid from the loaded data. The arrays are shared, not copied.
export function routingGridInputFromProcessedData(data: ProcessedData): RoutingGridInput {
    return {
        grid: data.meta.grid,
        heightmap: data.float32Layers.heightmap,
        traversal_penalty: data.float32Layers.traversal_penalty,
        slope_degrees: data.float32Layers.slope_degrees,
        viewshed_rover: data.uint8Layers.viewshed_rover,
        parameters: data.meta.parameters,
    };
}




// Replaces the runtime-blocked set. Returns the cells whose blocked state changed, which the
// incremental replanner needs (every edge touching such a cell changed cost).
export function applyBlockedCells(routingGrid: RoutingGrid, blockedCellIndices: number[]): number[] {
    const wanted = new Uint8Array(routingGrid.cellCount);
    for (const index of blockedCellIndices) {
        if (Number.isInteger(index) && index >= 0 && index < routingGrid.cellCount) {
            wanted[index] = 1;
        }
    }

    const changedCells: number[] = [];
    for (let index = 0; index < routingGrid.cellCount; index++) {
        if (wanted[index] !== routingGrid.blockedCells[index]) {
            changedCells.push(index);
            routingGrid.blockedCells[index] = wanted[index];
        }
    }
    return changedCells;
}


// Effective penalty of a cell: +Infinity when blocked at runtime, else traversal_penalty.
export function effectivePenalty(routingGrid: RoutingGrid, index: number): number {
    if (routingGrid.blockedCells[index] === 1) {
        return Number.POSITIVE_INFINITY;
    }
    return routingGrid.traversalPenalty[index];
}


// A cell can be stood on when its penalty is finite, it is not blocked and its height is known.
export function isCellPassable(routingGrid: RoutingGrid, index: number): boolean {
    const penalty = effectivePenalty(routingGrid, index);
    if (!Number.isFinite(penalty)) {
        return false;
    }
    if (Number.isNaN(routingGrid.heightmap[index])) {
        return false;
    }
    return true;
}




// Contract edge cost in seconds (contracts.md 4.2):
// walking_time_seconds(horizontal distance, height[to] - height[from]) * max(penalty[from], penalty[to]).
// Returns +Infinity when the edge does not exist: either penalty +Infinity (or blocked), a NaN
// height, or a step steeper than max_walkable_slope_deg. Direction-dependent.
export function contractEdgeCostSeconds(
    routingGrid: RoutingGrid,
    fromIndex: number,
    toIndex: number,
    horizontalDistanceMetres: number,
): number {
    const fromPenalty = effectivePenalty(routingGrid, fromIndex);
    const toPenalty = effectivePenalty(routingGrid, toIndex);
    if (!Number.isFinite(fromPenalty)) {
        return Number.POSITIVE_INFINITY;
    }
    if (!Number.isFinite(toPenalty)) {
        return Number.POSITIVE_INFINITY;
    }

    const fromHeight = routingGrid.heightmap[fromIndex];
    const toHeight = routingGrid.heightmap[toIndex];
    if (Number.isNaN(fromHeight)) {
        return Number.POSITIVE_INFINITY;
    }
    if (Number.isNaN(toHeight)) {
        return Number.POSITIVE_INFINITY;
    }

    const seconds = walkingTimeSeconds(horizontalDistanceMetres, toHeight - fromHeight, routingGrid.walkingParameters);
    if (!Number.isFinite(seconds)) {
        return Number.POSITIVE_INFINITY;
    }
    return seconds * Math.max(fromPenalty, toPenalty);
}




// "safe" route option weighting (estimate, not a contract value).
// The safe search multiplies each contract edge cost by a weight >= 1, so it still finds a real
// path and the A* heuristic stays admissible. Each term uses the harder end of the step, like the
// max penalty rule in contracts.md 4.2:
//   weight = 1
//          + SAFE_SLOPE_WEIGHT     * (max slope of the two cells / max_walkable_slope_deg)^2, fraction capped at 1
//          + SAFE_PENALTY_WEIGHT   * (max traversal_penalty of the two cells - 1)
//          + SAFE_NO_COMMS_WEIGHT  if either cell has no line of sight to the rover (viewshed_rover = 0)
// With the v1.0.0 penalty rules (max finite penalty 1.5 * 1.3 = 1.95) the weight is between 1 and ~7.
// The slope term is squared so gentle ground (under ~10 degrees) is barely affected while steep
// ground near the limit is strongly avoided. Main agent raised the weights from 1.0 / 0.5 / 0.5 so the
// safe option visibly differs from the fast one on the real patch.

// A step at the 25 degree limit costs 5 times as much as on flat ground; 10 degrees about 1.6 times.
export const SAFE_SLOPE_WEIGHT = 4.0;
// Rough or sandy ground (penalty 1.5) costs another 50 percent.
export const SAFE_PENALTY_WEIGHT = 1.0;
// A step in a comms dead zone costs twice as much (contracts.md 3.16).
export const SAFE_NO_COMMS_WEIGHT = 1.0;


export function safeEdgeWeight(routingGrid: RoutingGrid, fromIndex: number, toIndex: number): number {
    let maxSlopeDegrees = Math.max(routingGrid.slopeDegrees[fromIndex], routingGrid.slopeDegrees[toIndex]);
    if (Number.isNaN(maxSlopeDegrees)) {
        maxSlopeDegrees = routingGrid.walkingParameters.max_walkable_slope_deg;
    }
    let slopeFraction = maxSlopeDegrees / routingGrid.walkingParameters.max_walkable_slope_deg;
    if (slopeFraction > 1) {
        slopeFraction = 1;
    }
    if (slopeFraction < 0) {
        slopeFraction = 0;
    }

    const maxPenalty = Math.max(routingGrid.traversalPenalty[fromIndex], routingGrid.traversalPenalty[toIndex]);
    let penaltyExcess = maxPenalty - 1;
    if (penaltyExcess < 0) {
        penaltyExcess = 0;
    }

    let noCommsTerm = 0;
    if (routingGrid.viewshedRover[fromIndex] === 0) {
        noCommsTerm = SAFE_NO_COMMS_WEIGHT;
    } else {
        if (routingGrid.viewshedRover[toIndex] === 0) {
            noCommsTerm = SAFE_NO_COMMS_WEIGHT;
        }
    }

    return 1 + SAFE_SLOPE_WEIGHT * slopeFraction * slopeFraction + SAFE_PENALTY_WEIGHT * penaltyExcess + noCommsTerm;
}


// The cost a search minimises for a route option. "fast": the contract edge cost.
// "safe": the contract edge cost times safeEdgeWeight.
export function searchEdgeCost(
    routingGrid: RoutingGrid,
    routeOption: RouteOptionId,
    fromIndex: number,
    toIndex: number,
    horizontalDistanceMetres: number,
): number {
    const contractCost = contractEdgeCostSeconds(routingGrid, fromIndex, toIndex, horizontalDistanceMetres);
    if (!Number.isFinite(contractCost)) {
        return Number.POSITIVE_INFINITY;
    }
    if (routeOption === "safe") {
        return contractCost * safeEdgeWeight(routingGrid, fromIndex, toIndex);
    }
    return contractCost;
}




// Admissible, consistent heuristic: octile distance in metres divided by the peak walking speed.
// Octile distance is the shortest 8-connected length, every edge costs at least its length divided
// by the peak speed, and both search weights are >= 1, so it never overestimates.
export function heuristicSeconds(routingGrid: RoutingGrid, fromIndex: number, toIndex: number): number {
    const width = routingGrid.grid.width;
    const fromRow = Math.floor(fromIndex / width);
    const fromCol = fromIndex - fromRow * width;
    const toRow = Math.floor(toIndex / width);
    const toCol = toIndex - toRow * width;
    const rowSteps = Math.abs(fromRow - toRow);
    const colSteps = Math.abs(fromCol - toCol);
    const diagonalSteps = Math.min(rowSteps, colSteps);
    const straightSteps = Math.max(rowSteps, colSteps) - diagonalSteps;
    const octileMetres = routingGrid.grid.cell_size_m * (straightSteps + diagonalSteps * Math.SQRT2);
    return octileMetres / routingGrid.peakSpeedMetresPerSecond;
}




// Direction index (0 to 7) of the step from one cell to an 8-neighbour, or -1 if not neighbours.
export function neighbourDirection(routingGrid: RoutingGrid, fromIndex: number, toIndex: number): number {
    const width = routingGrid.grid.width;
    const fromRow = Math.floor(fromIndex / width);
    const fromCol = fromIndex - fromRow * width;
    const toRow = Math.floor(toIndex / width);
    const toCol = toIndex - toRow * width;
    for (let direction = 0; direction < NEIGHBOUR_COUNT; direction++) {
        if (fromRow + NEIGHBOUR_ROW_OFFSETS[direction] === toRow) {
            if (fromCol + NEIGHBOUR_COL_OFFSETS[direction] === toCol) {
                return direction;
            }
        }
    }
    return -1;
}




// Nearest passable cell to a position (contracts.md 1.1), searching the square of cells within
// SNAP_RADIUS_M around the containing cell. Used when a picked start or end lies on impassable
// ground (a rock, a steep wall, a blocked hazard). Returns -1 when nothing passable is that close.
// 10 m (5 cells at 2 m) is a few strides: far enough to step off a rock or wall edge, close
// enough that the route still starts or ends where the astronaut meant.
export const SNAP_RADIUS_M = 10;


export function snapToPassableCell(routingGrid: RoutingGrid, position: LocalPosition): number {
    const grid = routingGrid.grid;
    const centreCell = cellFromPosition(grid, position);
    const centreIndex = cellIndex(grid, centreCell);
    if (isCellPassable(routingGrid, centreIndex)) {
        return centreIndex;
    }

    const radiusCells = Math.ceil(SNAP_RADIUS_M / grid.cell_size_m);
    let bestIndex = -1;
    let bestDistanceMetres = Number.POSITIVE_INFINITY;
    for (let row = centreCell.row - radiusCells; row <= centreCell.row + radiusCells; row++) {
        if (row < 0 || row >= grid.height) {
            continue;
        }
        for (let col = centreCell.col - radiusCells; col <= centreCell.col + radiusCells; col++) {
            if (col < 0 || col >= grid.width) {
                continue;
            }
            const index = row * grid.width + col;
            if (!isCellPassable(routingGrid, index)) {
                continue;
            }
            const centre = cellCentre(grid, { row, col });
            const distanceMetres = Math.hypot(centre.x_m - position.x_m, centre.z_m - position.z_m);
            if (distanceMetres > SNAP_RADIUS_M) {
                continue;
            }
            if (distanceMetres < bestDistanceMetres) {
                bestDistanceMetres = distanceMetres;
                bestIndex = index;
            }
        }
    }
    return bestIndex;
}


export function cellCentreFromIndex(routingGrid: RoutingGrid, index: number): LocalPosition {
    return cellCentre(routingGrid.grid, cellFromIndex(routingGrid.grid, index));
}
