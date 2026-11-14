// D* Lite incremental replanner (Koenig and Likhachev, "D* Lite", AAAI 2002, optimised version,
// Figure 4), on the same 8-connected walking graph as A* (docs/contracts.md 4.2).
//
// D* Lite searches backwards from the goal: g(s) and rhs(s) estimate the cost from s to the goal.
// After cells are blocked or unblocked, or the start moves (the astronaut walks), only the part of
// the search that changed is repaired, so a reroute is much cheaper than a fresh search.
//
// Two simplifications of Figure 4, both still correct:
// - When edge costs change, rhs of every affected source cell is recomputed from all its
//   successors (the "basic" UpdateVertex rule of Figure 3), instead of the c_old comparison.
// - When a cell becomes underconsistent, rhs of the cell and every predecessor is recomputed from
//   all successors, instead of only those whose rhs came through that cell. This avoids exact
//   floating-point equality tests.

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
import { IndexedKeyHeap, isKeyLess } from "./priorityQueues";
import type { GridPath } from "./aStar";




export class DStarLitePlanner {
    readonly routeOption: RouteOptionId;
    private readonly routingGrid: RoutingGrid;
    private readonly costToGoal: Float64Array;
    private readonly rhs: Float64Array;
    private readonly queue: IndexedKeyHeap;
    private startIndex = -1;
    private goalIndex = -1;
    private lastStartIndex = -1;
    // Key modifier: grows by h(last start, new start) each time the start moves.
    private keyModifier = 0;
    private expandedCellCount = 0;


    constructor(routingGrid: RoutingGrid, routeOption: RouteOptionId) {
        this.routingGrid = routingGrid;
        this.routeOption = routeOption;
        this.costToGoal = new Float64Array(routingGrid.cellCount);
        this.rhs = new Float64Array(routingGrid.cellCount);
        this.queue = new IndexedKeyHeap(routingGrid.cellCount);
    }


    get currentGoalIndex(): number {
        return this.goalIndex;
    }


    get currentStartIndex(): number {
        return this.startIndex;
    }


    get isInitialised(): boolean {
        return this.goalIndex !== -1;
    }


    // Cells expanded by the last call to replan().
    get lastExpandedCellCount(): number {
        return this.expandedCellCount;
    }


    // Forgets the search; the next use must call initialise() again.
    reset(): void {
        this.queue.clear();
        this.startIndex = -1;
        this.lastStartIndex = -1;
        this.goalIndex = -1;
        this.keyModifier = 0;
    }


    // Starts a new search towards goalIndex. Call replan() afterwards.
    initialise(startIndex: number, goalIndex: number): void {
        this.costToGoal.fill(Number.POSITIVE_INFINITY);
        this.rhs.fill(Number.POSITIVE_INFINITY);
        this.queue.clear();
        this.startIndex = startIndex;
        this.lastStartIndex = startIndex;
        this.goalIndex = goalIndex;
        this.keyModifier = 0;
        this.rhs[goalIndex] = 0;
        this.queue.insert(goalIndex, heuristicSeconds(this.routingGrid, startIndex, goalIndex), 0);
    }


    // The astronaut has moved. Keeps the keys in the queue valid lower bounds (km in the paper).
    moveStart(newStartIndex: number): void {
        if (newStartIndex === this.startIndex) {
            return;
        }
        this.startIndex = newStartIndex;
        this.keyModifier += heuristicSeconds(this.routingGrid, this.lastStartIndex, newStartIndex);
        this.lastStartIndex = newStartIndex;
    }


    // Cells whose blocked state (or penalty) changed. Every edge into and out of such a cell changed,
    // so the sources of those edges (the cell and its 8 neighbours) get their rhs recomputed.
    notifyCellsChanged(changedCells: number[]): void {
        const affected = new Set<number>();
        const width = this.routingGrid.grid.width;
        const height = this.routingGrid.grid.height;
        for (const cell of changedCells) {
            affected.add(cell);
            const row = Math.floor(cell / width);
            const col = cell - row * width;
            for (let direction = 0; direction < NEIGHBOUR_COUNT; direction++) {
                const neighbourRow = row + NEIGHBOUR_ROW_OFFSETS[direction];
                const neighbourCol = col + NEIGHBOUR_COL_OFFSETS[direction];
                if (neighbourRow < 0 || neighbourRow >= height) {
                    continue;
                }
                if (neighbourCol < 0 || neighbourCol >= width) {
                    continue;
                }
                affected.add(neighbourRow * width + neighbourCol);
            }
        }
        for (const cell of affected) {
            if (cell !== this.goalIndex) {
                this.rhs[cell] = this.minimumOverSuccessors(cell);
            }
            this.updateVertex(cell);
        }
    }


    // ComputeShortestPath (Figure 4). Afterwards g(start) is the optimal cost to the goal.
    replan(): void {
        this.expandedCellCount = 0;
        const width = this.routingGrid.grid.width;
        const height = this.routingGrid.grid.height;

        while (this.queue.size > 0) {
            const startKey1 = this.calculateKey1(this.startIndex);
            const startKey2 = this.calculateKey2(this.startIndex);
            const topIsBelowStart = isKeyLess(this.queue.topKey1(), this.queue.topKey2(), startKey1, startKey2);
            // The basic loop condition (Figure 3, rhs != g) rather than Figure 4's rhs > g: it also
            // settles an overconsistent start, so g(start) itself is the optimal cost afterwards.
            let startIsInconsistent = false;
            if (this.rhs[this.startIndex] !== this.costToGoal[this.startIndex]) {
                startIsInconsistent = true;
            }
            if (!topIsBelowStart) {
                if (!startIsInconsistent) {
                    break;
                }
            }

            const cell = this.queue.topCell();
            const oldKey1 = this.queue.topKey1();
            const oldKey2 = this.queue.topKey2();
            const newKey1 = this.calculateKey1(cell);
            const newKey2 = this.calculateKey2(cell);
            this.expandedCellCount += 1;

            if (isKeyLess(oldKey1, oldKey2, newKey1, newKey2)) {
                // The key is out of date because the start moved: requeue with the new key.
                this.queue.update(cell, newKey1, newKey2);
                continue;
            }

            const row = Math.floor(cell / width);
            const col = cell - row * width;

            if (this.costToGoal[cell] > this.rhs[cell]) {
                // Overconsistent: settle g and improve the predecessors through this cell.
                this.costToGoal[cell] = this.rhs[cell];
                this.queue.remove(cell);
                for (let direction = 0; direction < NEIGHBOUR_COUNT; direction++) {
                    const predecessorRow = row + NEIGHBOUR_ROW_OFFSETS[direction];
                    const predecessorCol = col + NEIGHBOUR_COL_OFFSETS[direction];
                    if (predecessorRow < 0 || predecessorRow >= height) {
                        continue;
                    }
                    if (predecessorCol < 0 || predecessorCol >= width) {
                        continue;
                    }
                    const predecessor = predecessorRow * width + predecessorCol;
                    if (predecessor === this.goalIndex) {
                        continue;
                    }
                    // Edge predecessor -> cell. The direction from predecessor to cell is the
                    // opposite of `direction`, but the step length is the same.
                    const edgeCost = searchEdgeCost(
                        this.routingGrid,
                        this.routeOption,
                        predecessor,
                        cell,
                        this.routingGrid.stepDistanceMetres[direction],
                    );
                    if (!Number.isFinite(edgeCost)) {
                        continue;
                    }
                    const candidate = edgeCost + this.costToGoal[cell];
                    if (candidate < this.rhs[predecessor]) {
                        this.rhs[predecessor] = candidate;
                    }
                    this.updateVertex(predecessor);
                }
            } else {
                // Underconsistent: g was too low (an edge got worse). Reset g and repair around it.
                this.costToGoal[cell] = Number.POSITIVE_INFINITY;
                if (cell !== this.goalIndex) {
                    this.rhs[cell] = this.minimumOverSuccessors(cell);
                }
                this.updateVertex(cell);
                for (let direction = 0; direction < NEIGHBOUR_COUNT; direction++) {
                    const predecessorRow = row + NEIGHBOUR_ROW_OFFSETS[direction];
                    const predecessorCol = col + NEIGHBOUR_COL_OFFSETS[direction];
                    if (predecessorRow < 0 || predecessorRow >= height) {
                        continue;
                    }
                    if (predecessorCol < 0 || predecessorCol >= width) {
                        continue;
                    }
                    const predecessor = predecessorRow * width + predecessorCol;
                    if (predecessor !== this.goalIndex) {
                        this.rhs[predecessor] = this.minimumOverSuccessors(predecessor);
                    }
                    this.updateVertex(predecessor);
                }
            }
        }
    }


    // Optimal search cost from the current start to the goal (+Infinity when unreachable).
    costFromStart(): number {
        return this.costToGoal[this.startIndex];
    }


    // Follows the cheapest successor (edge cost + g) from the start to the goal.
    // Returns null when the goal is unreachable or the walk does not reach it.
    extractPath(): GridPath | null {
        if (this.startIndex === -1 || this.goalIndex === -1) {
            return null;
        }
        if (!isCellPassable(this.routingGrid, this.startIndex)) {
            return null;
        }
        if (!Number.isFinite(this.costToGoal[this.startIndex])) {
            return null;
        }

        const width = this.routingGrid.grid.width;
        const height = this.routingGrid.grid.height;
        const cellIndices: number[] = [this.startIndex];
        const visited = new Set<number>([this.startIndex]);
        let searchCost = 0;
        let cell = this.startIndex;
        while (cell !== this.goalIndex) {
            const row = Math.floor(cell / width);
            const col = cell - row * width;
            let bestNeighbour = -1;
            let bestTotal = Number.POSITIVE_INFINITY;
            let bestEdgeCost = Number.POSITIVE_INFINITY;
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
                const edgeCost = searchEdgeCost(
                    this.routingGrid,
                    this.routeOption,
                    cell,
                    neighbour,
                    this.routingGrid.stepDistanceMetres[direction],
                );
                if (!Number.isFinite(edgeCost)) {
                    continue;
                }
                const total = edgeCost + this.costToGoal[neighbour];
                if (total < bestTotal) {
                    bestTotal = total;
                    bestNeighbour = neighbour;
                    bestEdgeCost = edgeCost;
                }
            }
            if (bestNeighbour === -1) {
                return null;
            }
            if (visited.has(bestNeighbour)) {
                // A loop means the g values are not settled along this walk; never return it.
                return null;
            }
            visited.add(bestNeighbour);
            cellIndices.push(bestNeighbour);
            searchCost += bestEdgeCost;
            cell = bestNeighbour;
        }
        return { cellIndices, searchCost, expandedCellCount: this.expandedCellCount };
    }



    private calculateKey1(cell: number): number {
        const best = Math.min(this.costToGoal[cell], this.rhs[cell]);
        return best + heuristicSeconds(this.routingGrid, this.startIndex, cell) + this.keyModifier;
    }


    private calculateKey2(cell: number): number {
        return Math.min(this.costToGoal[cell], this.rhs[cell]);
    }


    // rhs(s) = min over successors s' of c(s, s') + g(s').
    private minimumOverSuccessors(cell: number): number {
        const width = this.routingGrid.grid.width;
        const height = this.routingGrid.grid.height;
        const row = Math.floor(cell / width);
        const col = cell - row * width;
        let best = Number.POSITIVE_INFINITY;
        for (let direction = 0; direction < NEIGHBOUR_COUNT; direction++) {
            const successorRow = row + NEIGHBOUR_ROW_OFFSETS[direction];
            const successorCol = col + NEIGHBOUR_COL_OFFSETS[direction];
            if (successorRow < 0 || successorRow >= height) {
                continue;
            }
            if (successorCol < 0 || successorCol >= width) {
                continue;
            }
            const successor = successorRow * width + successorCol;
            const successorCost = this.costToGoal[successor];
            if (!Number.isFinite(successorCost)) {
                continue;
            }
            const edgeCost = searchEdgeCost(
                this.routingGrid,
                this.routeOption,
                cell,
                successor,
                this.routingGrid.stepDistanceMetres[direction],
            );
            if (!Number.isFinite(edgeCost)) {
                continue;
            }
            const candidate = edgeCost + successorCost;
            if (candidate < best) {
                best = candidate;
            }
        }
        return best;
    }


    // UpdateVertex (Figure 4): queue the cell exactly when it is locally inconsistent.
    private updateVertex(cell: number): void {
        const isConsistent = this.costToGoal[cell] === this.rhs[cell];
        const isQueued = this.queue.contains(cell);
        if (isConsistent) {
            if (isQueued) {
                this.queue.remove(cell);
            }
        } else {
            const key1 = this.calculateKey1(cell);
            const key2 = this.calculateKey2(cell);
            if (isQueued) {
                this.queue.update(cell, key1, key2);
            } else {
                this.queue.insert(cell, key1, key2);
            }
        }
    }
}
