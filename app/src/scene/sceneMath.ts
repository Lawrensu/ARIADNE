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



// Screen pixels per metre at the camera target, for screen-space line dashes.
// Orthographic: the zoom is pixels per metre (the frustum is the viewport size in pixels).
// Perspective: pixels per metre at the distance from the camera to the target.
export interface CameraScaleInput {
    is_orthographic: boolean;
    zoom: number;
    fov_deg: number;
    camera_position: Vector3Like;
    target_position: Vector3Like | null;
}


export const FALLBACK_PIXELS_PER_METRE = 1;


export function pixelsPerMetreAtTarget(input: CameraScaleInput, viewportHeightPx: number): number {
    if (input.is_orthographic) {
        if (input.zoom > 0) {
            return input.zoom;
        }
        return FALLBACK_PIXELS_PER_METRE;
    }
    if (input.target_position === null) {
        return FALLBACK_PIXELS_PER_METRE;
    }
    const distance = Math.hypot(
        input.camera_position.x - input.target_position.x,
        input.camera_position.y - input.target_position.y,
        input.camera_position.z - input.target_position.z,
    );
    const halfFovRad = (input.fov_deg * Math.PI) / 360;
    const visibleHeightM = 2 * distance * Math.tan(halfFovRad);
    if (!(visibleHeightM > 0) || !(viewportHeightPx > 0)) {
        return FALLBACK_PIXELS_PER_METRE;
    }
    return viewportHeightPx / visibleHeightM;
}



// Camera button maths (control legend: zoom in, zoom out, Center on me). Pure, no Three.js.

// One button tap zooms by this factor (a few wheel ticks).
export const ZOOM_STEP_FACTOR = 1.5;
export const CAMERA_ANIMATION_DURATION_S = 0.35;


export function clampNumber(value: number, low: number, high: number): number {
    return Math.min(Math.max(value, low), high);
}


// Orthographic zoom after one step: direction +1 zooms in (bigger zoom), -1 zooms out.
// Clamped to the same limits as the mouse wheel (the controls' minZoom and maxZoom).
export function orthographicZoomStep(currentZoom: number, direction: number, minZoom: number, maxZoom: number): number {
    let factor = ZOOM_STEP_FACTOR;
    if (direction < 0) {
        factor = 1 / ZOOM_STEP_FACTOR;
    }
    return clampNumber(currentZoom * factor, minZoom, maxZoom);
}


// Perspective camera distance to its target after one step: zooming in moves closer.
// Clamped to the controls' minDistance and maxDistance, like the wheel.
export function perspectiveDistanceStep(currentDistance: number, direction: number, minDistance: number, maxDistance: number): number {
    let factor = 1 / ZOOM_STEP_FACTOR;
    if (direction < 0) {
        factor = ZOOM_STEP_FACTOR;
    }
    return clampNumber(currentDistance * factor, minDistance, maxDistance);
}


// Ease-out cubic on 0..1: quick start, soft landing.
export function easeOutCubic(t: number): number {
    const clamped = clampNumber(t, 0, 1);
    return 1 - Math.pow(1 - clamped, 3);
}


export function lerpNumber(from: number, to: number, weight: number): number {
    return from + (to - from) * weight;
}
