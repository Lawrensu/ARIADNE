// Builds the terrain mesh geometry and grid overlay textures (owner: Malissa, Stage 2).
// One geometry is shared by the terrain mesh and every draped overlay, so they always line up.

import * as THREE from "three";

import type { GridDefinition } from "../data/contracts";
import type { TerrainFrame } from "./terrainFrame";
import { gridPositionToUv, sampleTerrainSceneY } from "./terrainFrame";



// Vertex spacing in cells. 1 = one vertex per 2 m cell (about 0.95 M vertices); 2 = every 4 m.
export const DEFAULT_TERRAIN_STEP_CELLS = 2;


// Terrain geometry covering the grid extent exactly, from (0, 0) to (width_m, height_m).
// Vertices are evenly spaced, about `stepCells` cells apart; heights are bilinear samples.
// UVs map the extent onto [0, 1] so a texture covering the grid (contracts.md 3.10) fits exactly.
export function buildTerrainGeometry(frame: TerrainFrame, stepCells: number = DEFAULT_TERRAIN_STEP_CELLS): THREE.BufferGeometry {
    const grid = frame.grid;
    const widthM = grid.width * grid.cell_size_m;
    const heightM = grid.height * grid.cell_size_m;
    const vertexColumns = Math.ceil(grid.width / stepCells) + 1;
    const vertexRows = Math.ceil(grid.height / stepCells) + 1;

    const positions = new Float32Array(vertexColumns * vertexRows * 3);
    const uvs = new Float32Array(vertexColumns * vertexRows * 2);
    for (let vertexRow = 0; vertexRow < vertexRows; vertexRow++) {
        const z_m = (vertexRow / (vertexRows - 1)) * heightM;
        for (let vertexCol = 0; vertexCol < vertexColumns; vertexCol++) {
            const x_m = (vertexCol / (vertexColumns - 1)) * widthM;
            const vertexIndex = vertexRow * vertexColumns + vertexCol;
            positions[vertexIndex * 3] = x_m;
            positions[vertexIndex * 3 + 1] = sampleTerrainSceneY(frame, x_m, z_m);
            positions[vertexIndex * 3 + 2] = z_m;
            const uv = gridPositionToUv(grid, x_m, z_m);
            uvs[vertexIndex * 2] = uv.u;
            uvs[vertexIndex * 2 + 1] = uv.v;
        }
    }

    // Two triangles per quad, wound counter-clockwise when seen from above (+y).
    const quadCount = (vertexColumns - 1) * (vertexRows - 1);
    const indices = new Uint32Array(quadCount * 6);
    let writeIndex = 0;
    for (let vertexRow = 0; vertexRow < vertexRows - 1; vertexRow++) {
        for (let vertexCol = 0; vertexCol < vertexColumns - 1; vertexCol++) {
            const northWest = vertexRow * vertexColumns + vertexCol;
            const northEast = northWest + 1;
            const southWest = northWest + vertexColumns;
            const southEast = southWest + 1;
            indices[writeIndex++] = northWest;
            indices[writeIndex++] = southWest;
            indices[writeIndex++] = northEast;
            indices[writeIndex++] = northEast;
            indices[writeIndex++] = southWest;
            indices[writeIndex++] = southEast;
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}



// Turns a per-cell RGBA array (row 0 = north, row-major, 4 bytes per cell, like every grid in
// contracts.md 1.2) into a texture that lines up with the terrain UVs. The rows are flipped here
// because a DataTexture puts its first row at v = 0 (south) while the terrain has north at v = 1.
export function createGridOverlayTexture(grid: GridDefinition, rgbaRowZeroNorth: Uint8Array): THREE.DataTexture {
    const expectedLength = grid.width * grid.height * 4;
    if (rgbaRowZeroNorth.length !== expectedLength) {
        throw new Error(`overlay RGBA has ${rgbaRowZeroNorth.length} bytes, expected ${expectedLength}`);
    }
    const rowBytes = grid.width * 4;
    const flipped = new Uint8Array(expectedLength);
    for (let row = 0; row < grid.height; row++) {
        const sourceStart = row * rowBytes;
        const targetStart = (grid.height - 1 - row) * rowBytes;
        flipped.set(rgbaRowZeroNorth.subarray(sourceStart, sourceStart + rowBytes), targetStart);
    }
    const texture = new THREE.DataTexture(flipped, grid.width, grid.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}
