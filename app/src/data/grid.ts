// Local grid helpers (docs/contracts.md 1.1). The only coordinate system in the app.
// Origin is the north-west corner, +x east, +z south, +y up, metres.
// Row 0 is the north edge; storage is row-major, index = row * width + col.
// Never hard-code width, height or cell size: they come from meta.json.

import type { GridDefinition, LocalPosition } from "./contracts";



export interface GridCell {
    row: number;
    col: number;
}


export function cellIndex(grid: GridDefinition, cell: GridCell): number {
    return cell.row * grid.width + cell.col;
}


export function cellFromIndex(grid: GridDefinition, index: number): GridCell {
    const row = Math.floor(index / grid.width);
    const col = index - row * grid.width;
    return { row, col };
}


// Centre of a cell in metres: x = (col + 0.5) * cell_size_m, z = (row + 0.5) * cell_size_m.
export function cellCentre(grid: GridDefinition, cell: GridCell): LocalPosition {
    return {
        x_m: (cell.col + 0.5) * grid.cell_size_m,
        z_m: (cell.row + 0.5) * grid.cell_size_m,
    };
}


// The cell that contains a position. Positions outside the extent are clamped to the edge cell.
export function cellFromPosition(grid: GridDefinition, position: LocalPosition): GridCell {
    const rawCol = Math.floor(position.x_m / grid.cell_size_m);
    const rawRow = Math.floor(position.z_m / grid.cell_size_m);
    const col = Math.min(Math.max(rawCol, 0), grid.width - 1);
    const row = Math.min(Math.max(rawRow, 0), grid.height - 1);
    return { row, col };
}


export function isInsideGrid(grid: GridDefinition, cell: GridCell): boolean {
    if (cell.row < 0 || cell.row >= grid.height) {
        return false;
    }
    if (cell.col < 0 || cell.col >= grid.width) {
        return false;
    }
    return true;
}


// Extent of the grid in metres (width_m east-west, height_m north-south).
export function gridExtentMetres(grid: GridDefinition): { width_m: number; height_m: number } {
    return {
        width_m: grid.width * grid.cell_size_m,
        height_m: grid.height * grid.cell_size_m,
    };
}
