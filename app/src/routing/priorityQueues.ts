// Binary min-heaps on typed arrays for the grid searches.
// - MinHeap: (priority, cell) pairs with lazy deletion, used by A* (stale entries are skipped).
// - IndexedKeyHeap: one entry per cell with a two-part key [k1, k2] compared lexicographically and
//   update/remove by cell, as D* Lite needs (Koenig and Likhachev 2002).




export class MinHeap {
    private priorities: Float64Array;
    private cells: Int32Array;
    private count = 0;


    constructor(initialCapacity = 1024) {
        this.priorities = new Float64Array(initialCapacity);
        this.cells = new Int32Array(initialCapacity);
    }


    get size(): number {
        return this.count;
    }


    push(cell: number, priority: number): void {
        if (this.count === this.cells.length) {
            this.grow();
        }
        let position = this.count;
        this.count += 1;
        // Sift up: move parents down until the new entry fits.
        while (position > 0) {
            const parent = (position - 1) >> 1;
            if (this.priorities[parent] <= priority) {
                break;
            }
            this.priorities[position] = this.priorities[parent];
            this.cells[position] = this.cells[parent];
            position = parent;
        }
        this.priorities[position] = priority;
        this.cells[position] = cell;
    }


    peekPriority(): number {
        if (this.count === 0) {
            return Number.POSITIVE_INFINITY;
        }
        return this.priorities[0];
    }


    // Removes and returns the cell with the smallest priority. Call only when size > 0.
    pop(): number {
        const topCell = this.cells[0];
        this.count -= 1;
        if (this.count > 0) {
            const lastPriority = this.priorities[this.count];
            const lastCell = this.cells[this.count];
            let position = 0;
            // Sift down the former last entry from the root.
            while (true) {
                const left = 2 * position + 1;
                if (left >= this.count) {
                    break;
                }
                let smallerChild = left;
                const right = left + 1;
                if (right < this.count) {
                    if (this.priorities[right] < this.priorities[left]) {
                        smallerChild = right;
                    }
                }
                if (this.priorities[smallerChild] >= lastPriority) {
                    break;
                }
                this.priorities[position] = this.priorities[smallerChild];
                this.cells[position] = this.cells[smallerChild];
                position = smallerChild;
            }
            this.priorities[position] = lastPriority;
            this.cells[position] = lastCell;
        }
        return topCell;
    }


    private grow(): void {
        const newCapacity = this.cells.length * 2;
        const newPriorities = new Float64Array(newCapacity);
        const newCells = new Int32Array(newCapacity);
        newPriorities.set(this.priorities);
        newCells.set(this.cells);
        this.priorities = newPriorities;
        this.cells = newCells;
    }
}




// True when key a = [a1, a2] is lexicographically smaller than key b = [b1, b2].
export function isKeyLess(a1: number, a2: number, b1: number, b2: number): boolean {
    if (a1 < b1) {
        return true;
    }
    if (a1 > b1) {
        return false;
    }
    return a2 < b2;
}


export class IndexedKeyHeap {
    private heapCells: Int32Array;
    private heapKey1: Float64Array;
    private heapKey2: Float64Array;
    // Position of each cell in the heap arrays, -1 when the cell is not queued.
    private positionOfCell: Int32Array;
    private count = 0;


    constructor(cellCount: number) {
        this.heapCells = new Int32Array(cellCount);
        this.heapKey1 = new Float64Array(cellCount);
        this.heapKey2 = new Float64Array(cellCount);
        this.positionOfCell = new Int32Array(cellCount).fill(-1);
    }


    get size(): number {
        return this.count;
    }


    contains(cell: number): boolean {
        return this.positionOfCell[cell] !== -1;
    }


    topCell(): number {
        return this.heapCells[0];
    }


    // [+Infinity, +Infinity] when empty, as in the D* Lite paper.
    topKey1(): number {
        if (this.count === 0) {
            return Number.POSITIVE_INFINITY;
        }
        return this.heapKey1[0];
    }


    topKey2(): number {
        if (this.count === 0) {
            return Number.POSITIVE_INFINITY;
        }
        return this.heapKey2[0];
    }


    insert(cell: number, key1: number, key2: number): void {
        const position = this.count;
        this.count += 1;
        this.heapCells[position] = cell;
        this.heapKey1[position] = key1;
        this.heapKey2[position] = key2;
        this.positionOfCell[cell] = position;
        this.siftUp(position);
    }


    update(cell: number, key1: number, key2: number): void {
        const position = this.positionOfCell[cell];
        this.heapKey1[position] = key1;
        this.heapKey2[position] = key2;
        this.siftUp(position);
        this.siftDown(this.positionOfCell[cell]);
    }


    remove(cell: number): void {
        const position = this.positionOfCell[cell];
        this.positionOfCell[cell] = -1;
        this.count -= 1;
        if (position === this.count) {
            return;
        }
        // Move the last entry into the hole and restore the heap order around it.
        const movedCell = this.heapCells[this.count];
        this.heapCells[position] = movedCell;
        this.heapKey1[position] = this.heapKey1[this.count];
        this.heapKey2[position] = this.heapKey2[this.count];
        this.positionOfCell[movedCell] = position;
        this.siftUp(position);
        this.siftDown(this.positionOfCell[movedCell]);
    }


    clear(): void {
        for (let position = 0; position < this.count; position++) {
            this.positionOfCell[this.heapCells[position]] = -1;
        }
        this.count = 0;
    }


    private swap(a: number, b: number): void {
        const cellA = this.heapCells[a];
        const key1A = this.heapKey1[a];
        const key2A = this.heapKey2[a];
        this.heapCells[a] = this.heapCells[b];
        this.heapKey1[a] = this.heapKey1[b];
        this.heapKey2[a] = this.heapKey2[b];
        this.heapCells[b] = cellA;
        this.heapKey1[b] = key1A;
        this.heapKey2[b] = key2A;
        this.positionOfCell[this.heapCells[a]] = a;
        this.positionOfCell[this.heapCells[b]] = b;
    }


    private isLessAt(a: number, b: number): boolean {
        return isKeyLess(this.heapKey1[a], this.heapKey2[a], this.heapKey1[b], this.heapKey2[b]);
    }


    private siftUp(startPosition: number): void {
        let position = startPosition;
        while (position > 0) {
            const parent = (position - 1) >> 1;
            if (!this.isLessAt(position, parent)) {
                break;
            }
            this.swap(position, parent);
            position = parent;
        }
    }


    private siftDown(startPosition: number): void {
        let position = startPosition;
        while (true) {
            const left = 2 * position + 1;
            if (left >= this.count) {
                break;
            }
            let smallerChild = left;
            const right = left + 1;
            if (right < this.count) {
                if (this.isLessAt(right, left)) {
                    smallerChild = right;
                }
            }
            if (!this.isLessAt(smallerChild, position)) {
                break;
            }
            this.swap(position, smallerChild);
            position = smallerChild;
        }
    }
}
