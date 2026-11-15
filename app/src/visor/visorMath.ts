// Visor maths and label text (owner: Lawrence, D-032). Pure functions only: no React, no store, so
// Vitest runs them in Node. Local grid only (contracts.md 1.1): x is east, z is south, bearing 0 is
// north, clockwise. The visor never does latitude or longitude maths.

import type { LocalPosition } from "../data/contracts";
import { formatDistanceMetres, formatMinutesEstimate, normalizeBearing } from "../hud/hudMath";



// Distance from the astronaut to the edge of the minimap, in local grid metres (display choice).
export const MINIMAP_RADIUS_M = 300;

// Half width of the compass strip window in degrees (the strip shows heading plus or minus this).
export const COMPASS_HALF_SPAN_DEG = 60;

// Relative bearing words use these limits, in degrees away from straight ahead.
const AHEAD_LIMIT_DEG = 15;
const BEHIND_LIMIT_DEG = 150;



export interface MinimapView {
    // The astronaut, at the centre of the minimap.
    centre: LocalPosition;
    // Local grid metres from the centre to the edge of the circle.
    radiusM: number;
    // Side of the square SVG viewBox, in SVG units.
    sizeUnits: number;
}


export interface MinimapPoint {
    x: number;
    y: number;
}



// Signed shortest difference from a heading to a target bearing, in [-180, 180). Positive means the
// target is to the right (clockwise) of the heading.
export function signedDeltaDegrees(targetDeg: number, headingDeg: number): number {
    return ((targetDeg - headingDeg + 540) % 360) - 180;
}


// Where a local grid point lands on a north-up minimap: east is right, south is down.
export function projectToMinimap(point: LocalPosition, view: MinimapView): MinimapPoint {
    const unitsPerMetre = view.sizeUnits / 2 / view.radiusM;
    return {
        x: view.sizeUnits / 2 + (point.x_m - view.centre.x_m) * unitsPerMetre,
        y: view.sizeUnits / 2 + (point.z_m - view.centre.z_m) * unitsPerMetre,
    };
}


export function isInsideMinimap(point: LocalPosition, view: MinimapView): boolean {
    const distanceM = Math.hypot(point.x_m - view.centre.x_m, point.z_m - view.centre.z_m);
    return distanceM <= view.radiusM;
}


// A point outside the circle is pulled onto the rim along the line to the centre, so a far target
// still shows as a marker at its bearing. marginUnits keeps the marker fully inside the rim.
export function projectToMinimapClamped(point: LocalPosition, view: MinimapView, marginUnits: number): MinimapPoint {
    const projected = projectToMinimap(point, view);
    const half = view.sizeUnits / 2;
    const dx = projected.x - half;
    const dy = projected.y - half;
    const distanceUnits = Math.hypot(dx, dy);
    const limitUnits = half - marginUnits;
    if (distanceUnits <= limitUnits || distanceUnits === 0) {
        return projected;
    }
    const scale = limitUnits / distanceUnits;
    return { x: half + dx * scale, y: half + dy * scale };
}


// SVG polyline "points" text for a path. Points are rounded to one decimal; the SVG clip circle
// cuts what lies outside, so the path needs no clipping here.
export function minimapPolylinePoints(path: LocalPosition[], view: MinimapView): string {
    const parts: string[] = [];
    for (const position of path) {
        const projected = projectToMinimap(position, view);
        parts.push(`${projected.x.toFixed(1)},${projected.y.toFixed(1)}`);
    }
    return parts.join(" ");
}



export interface CompassPlacement {
    // Percent from the left edge of the strip, clamped to 0..100.
    leftPercent: number;
    // "inside": within the window. "left" and "right": off the window, pinned to that edge.
    edge: "inside" | "left" | "right";
}


// Where a bearing sits on the compass strip for the current heading.
export function compassPlacement(bearingDeg: number, headingDeg: number): CompassPlacement {
    const delta = signedDeltaDegrees(bearingDeg, headingDeg);
    if (delta < -COMPASS_HALF_SPAN_DEG) {
        return { leftPercent: 0, edge: "left" };
    }
    if (delta > COMPASS_HALF_SPAN_DEG) {
        return { leftPercent: 100, edge: "right" };
    }
    return { leftPercent: 50 + (delta / COMPASS_HALF_SPAN_DEG) * 50, edge: "inside" };
}


// Words for where a target is relative to where the astronaut faces: "AHEAD", "RIGHT 40°",
// "LEFT 95°", "BEHIND". Non-finite input reads "UNKNOWN".
export function relativeBearingWord(targetDeg: number, headingDeg: number): string {
    if (!Number.isFinite(targetDeg) || !Number.isFinite(headingDeg)) {
        return "UNKNOWN";
    }
    const delta = signedDeltaDegrees(targetDeg, headingDeg);
    const size = Math.abs(delta);
    if (size <= AHEAD_LIMIT_DEG) {
        return "AHEAD";
    }
    if (size >= BEHIND_LIMIT_DEG) {
        return "BEHIND";
    }
    const side = delta > 0 ? "RIGHT" : "LEFT";
    return `${side} ${Math.round(size)}°`;
}


// "270°" for a bearing; "--" when unknown.
export function formatBearingDegrees(bearingDeg: number | null): string {
    if (bearingDeg === null || !Number.isFinite(bearingDeg)) {
        return "--";
    }
    return `${Math.round(normalizeBearing(bearingDeg)) % 360}°`;
}



// Text over a world marker: the name and how far away it is, for example "Boxwork ridge 240 m".
export function formatWorldMarkerLabel(name: string, distanceM: number): string {
    return `${name} ${formatDistanceMetres(distanceM)}`;
}


export type VisorTargetKind = "knot" | "shelter";


export interface NextStepInput {
    kind: VisorTargetKind;
    label: string;
    distanceM: number;
    walkSeconds: number;
}


// The small next-step line: "NEXT: Boxwork ridge, 240 m, est. 6 min" or "SHELTER: Rover shelter,
// 340 m, est. 6 min". The walk time is a model value, so "est." always sits in front of it.
export function formatNextStepLine(input: NextStepInput): string {
    let prefix = "NEXT";
    if (input.kind === "shelter") {
        prefix = "SHELTER";
    }
    return `${prefix}: ${input.label}, ${formatDistanceMetres(input.distanceM)}, est. ${formatMinutesEstimate(input.walkSeconds)}`;
}


// "TASK: Collect sample" at a Knot; the label comes from the science task.
export function formatTaskLine(taskLabel: string): string {
    return `TASK: ${taskLabel}`;
}


// Session sync badge text. connectedWindowCount is the number of OTHER windows heard from.
export function formatSyncLabel(connectedWindowCount: number): "SYNCED" | "SOLO" {
    if (connectedWindowCount > 0) {
        return "SYNCED";
    }
    return "SOLO";
}


// Next speed in the preset list after the current one; wraps to the first. An unknown current speed
// also gives the first preset.
export function nextSpeedPreset(currentSpeed: number, presets: number[]): number {
    if (presets.length === 0) {
        return currentSpeed;
    }
    const index = presets.indexOf(currentSpeed);
    if (index === -1) {
        return presets[0];
    }
    return presets[(index + 1) % presets.length];
}


// "x60" for a speed multiplier.
export function formatSpeedLabel(speed: number): string {
    return `x${speed}`;
}
