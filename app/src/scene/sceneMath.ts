// Pure helpers for the 3D scene: sun direction, camera framing, Gale context rectangle.
// No React, no Three.js: plain functions, so they are easy to test.
// Local grid only (contracts.md 1.1): x east, z south, y up, metres. No lat/lon maths.

import type { GridDefinition, PixelRect } from "../data/contracts";



export interface Vector3Like {
    x: number;
    y: number;
    z: number;
}



// Unit vector pointing from the terrain TOWARDS the sun.
// Azimuth is clockwise from north (north = -z, east = +x). Incidence is measured from the zenith (+y).
export function sunDirectionVector(sunAzimuthDeg: number, sunIncidenceDeg: number): Vector3Like {
    const azimuthRad = (sunAzimuthDeg * Math.PI) / 180;
    const incidenceRad = (sunIncidenceDeg * Math.PI) / 180;
    const horizontal = Math.sin(incidenceRad);
    return {
        x: horizontal * Math.sin(azimuthRad),
        y: Math.cos(incidenceRad),
        z: -horizontal * Math.cos(azimuthRad),
    };
}



export interface PatchFraming {
    centre_x_m: number;
    centre_z_m: number;
    width_m: number;
    height_m: number;
}


export function patchFraming(grid: GridDefinition): PatchFraming {
    const width_m = grid.width * grid.cell_size_m;
    const height_m = grid.height * grid.cell_size_m;
    return {
        centre_x_m: width_m / 2,
        centre_z_m: height_m / 2,
        width_m,
        height_m,
    };
}


// Orthographic zoom (pixels per metre) so the whole patch fits the viewport with a margin.
// marginFraction 0.08 leaves 8 percent of free space around the patch.
export function orthographicZoomToFit(
    framing: PatchFraming,
    viewportWidthPx: number,
    viewportHeightPx: number,
    marginFraction: number = 0.08,
): number {
    const usableFraction = 1 - marginFraction;
    const zoomForWidth = (viewportWidthPx * usableFraction) / framing.width_m;
    const zoomForHeight = (viewportHeightPx * usableFraction) / framing.height_m;
    return Math.min(zoomForWidth, zoomForHeight);
}


// Starting camera position for the Labyrinth view: south of the patch centre, raised, looking north.
export function labyrinthStartPosition(framing: PatchFraming, targetY: number): Vector3Like {
    const longestSide = Math.max(framing.width_m, framing.height_m);
    return {
        x: framing.centre_x_m,
        y: targetY + longestSide * 0.8,
        z: framing.centre_z_m + longestSide * 1.25,
    };
}



export interface PlaneRect {
    centre_x: number;
    centre_y: number;
    width: number;
    height: number;
}


// Gale context image pixels to plane units where 1 plane unit = 1 image pixel, the image centre is
// the origin, +x is east and +y is north. Pixel (0, 0) is the image top-left (north-west).
export function imagePixelToPlane(
    imageWidthPx: number,
    imageHeightPx: number,
    pixelX: number,
    pixelY: number,
): { x: number; y: number } {
    return {
        x: pixelX - imageWidthPx / 2,
        y: imageHeightPx / 2 - pixelY,
    };
}


export function pixelRectToPlaneRect(imageWidthPx: number, imageHeightPx: number, rect: PixelRect): PlaneRect {
    const centrePixelX = rect.x + rect.width / 2;
    const centrePixelY = rect.y + rect.height / 2;
    const centre = imagePixelToPlane(imageWidthPx, imageHeightPx, centrePixelX, centrePixelY);
    return {
        centre_x: centre.x,
        centre_y: centre.y,
        width: rect.width,
        height: rect.height,
    };
}
