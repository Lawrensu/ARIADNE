// Simulated walk timeline (owner: Lawrence, Stage 3 takeover, D-030). Pure: no React, no store.
//
// Mars has no GPS, so the demo simulates the astronaut's position: it walks a frozen copy of the
// science plan on the simulation clock. Each planned leg is walked in its planned time (walking
// model x load factor, contracts.md 4.6, est.), at constant speed along the leg's path; at each Knot
// the astronaut stays for the planned task durations. A reroute (WalkDetour) leaves the plan at a
// given time and walks the detour path to its target. Local grid metres only (D-005).

import type { Knot, LocalPosition } from "../data/contracts";
import type { WalkDetour, WalkPhase } from "../state/walkSlice";
import type { SciencePlan } from "../state/scienceSlice";



// "walk_leg": moving along a planned leg. "science_task": standing at a Knot doing one task.
export type WalkSegmentKind = "walk_leg" | "science_task";


export interface WalkSegment {
    segment_kind: WalkSegmentKind;
    start_s: number;
    end_s: number;
    // walk_leg: the path walked, at least two points. science_task: one point (the Knot).
    path_positions: LocalPosition[];
    // Distance from the path start to each path point, metres (same length as path_positions).
    cumulative_distance_m: number[];
    // walk_leg: the Knot the leg ends at, null for the walk back to the rover. science_task: the Knot.
    knot_id: string | null;
    // science_task only.
    task_id: string | null;
}


export interface WalkTimeline {
    started_at_sim_seconds: number;
    segments: WalkSegment[];
    // Simulation time when the astronaut is back at the rover.
    end_s: number;
    start_position: LocalPosition;
}


export interface WalkState {
    position: LocalPosition;
    heading_deg: number | null;
    phase: WalkPhase;
    // The Knot the astronaut is at (at_knot) or walking to (walking on the plan); null otherwise.
    knot_id: string | null;
    task_id: string | null;
    is_on_detour: boolean;
}



function distanceMetres(a: LocalPosition, b: LocalPosition): number {
    return Math.hypot(b.x_m - a.x_m, b.z_m - a.z_m);
}


function cumulativeDistances(path: LocalPosition[]): number[] {
    const distances: number[] = [];
    let total = 0;
    for (let index = 0; index < path.length; index++) {
        if (index > 0) {
            total += distanceMetres(path[index - 1], path[index]);
        }
        distances.push(total);
    }
    return distances;
}


// Compass bearing from a to b: 0 = north (local -z), 90 = east (+x), clockwise. Null when a equals b.
export function bearingBetween(a: LocalPosition, b: LocalPosition): number | null {
    const dx = b.x_m - a.x_m;
    const dz = b.z_m - a.z_m;
    if (dx === 0 && dz === 0) {
        return null;
    }
    const degrees = (Math.atan2(dx, -dz) * 180) / Math.PI;
    return (degrees + 360) % 360;
}


export interface PathPoint {
    position: LocalPosition;
    heading_deg: number | null;
}


// The point at a fraction (0 to 1) of the path length, and the heading of the path piece it is on.
export function pointAlongPath(path: LocalPosition[], cumulative: number[], fraction: number): PathPoint {
    if (path.length === 0) {
        return { position: { x_m: Number.NaN, z_m: Number.NaN }, heading_deg: null };
    }
    if (path.length === 1) {
        return { position: path[0], heading_deg: null };
    }
    let clampedFraction = fraction;
    if (!(clampedFraction > 0)) {
        clampedFraction = 0;
    }
    if (clampedFraction > 1) {
        clampedFraction = 1;
    }
    const totalLength = cumulative[cumulative.length - 1];
    if (totalLength === 0) {
        return { position: path[path.length - 1], heading_deg: null };
    }
    const targetDistance = clampedFraction * totalLength;

    // First path point at or beyond the target distance; the walker is on the piece ending there.
    let endIndex = 1;
    while (endIndex < path.length - 1 && cumulative[endIndex] < targetDistance) {
        endIndex += 1;
    }
    const pieceStart = path[endIndex - 1];
    const pieceEnd = path[endIndex];
    const pieceLength = cumulative[endIndex] - cumulative[endIndex - 1];
    let pieceFraction = 0;
    if (pieceLength > 0) {
        pieceFraction = (targetDistance - cumulative[endIndex - 1]) / pieceLength;
    }
    const position = {
        x_m: pieceStart.x_m + (pieceEnd.x_m - pieceStart.x_m) * pieceFraction,
        z_m: pieceStart.z_m + (pieceEnd.z_m - pieceStart.z_m) * pieceFraction,
    };
    return { position, heading_deg: bearingBetween(pieceStart, pieceEnd) };
}



// Build the timeline of a plan walked from startedAtSimSeconds. Legs with no stored path are walked
// in a straight line between their ends (the planner leaves the path empty only for legs timed from
// return_field).
export function buildWalkTimeline(
    plan: SciencePlan,
    knots: Knot[],
    stagingPoint: LocalPosition,
    startedAtSimSeconds: number,
): WalkTimeline {
    const knotsById = new Map<string, Knot>();
    for (const knot of knots) {
        knotsById.set(knot.knot_id, knot);
    }
    const rover: LocalPosition = { x_m: stagingPoint.x_m, z_m: stagingPoint.z_m };

    const segments: WalkSegment[] = [];
    let clock = startedAtSimSeconds;
    let previousEnd: LocalPosition = rover;

    for (const leg of plan.legs) {
        let legEnd: LocalPosition = rover;
        if (leg.to_knot_id !== null) {
            const knot = knotsById.get(leg.to_knot_id);
            if (knot !== undefined) {
                legEnd = { x_m: knot.x_m, z_m: knot.z_m };
            }
        }

        let path: LocalPosition[];
        if (leg.path_positions.length >= 2) {
            path = leg.path_positions;
        } else {
            path = [previousEnd, legEnd];
        }

        const legDuration = Math.max(leg.walking_time_s, 0);
        segments.push({
            segment_kind: "walk_leg",
            start_s: clock,
            end_s: clock + legDuration,
            path_positions: path,
            cumulative_distance_m: cumulativeDistances(path),
            knot_id: leg.to_knot_id,
            task_id: null,
        });
        clock += legDuration;
        previousEnd = path[path.length - 1];

        if (leg.to_knot_id === null) {
            continue;
        }
        // The tasks at this Knot, in plan order.
        for (const task of plan.tasks) {
            if (task.knot_id !== leg.to_knot_id) {
                continue;
            }
            const taskDuration = Math.max(task.duration_s, 0);
            segments.push({
                segment_kind: "science_task",
                start_s: clock,
                end_s: clock + taskDuration,
                path_positions: [previousEnd],
                cumulative_distance_m: [0],
                knot_id: task.knot_id,
                task_id: task.task_id,
            });
            clock += taskDuration;
        }
    }

    return { started_at_sim_seconds: startedAtSimSeconds, segments, end_s: clock, start_position: rover };
}



function planStateAt(timeline: WalkTimeline, simSeconds: number): WalkState {
    const atRover: WalkState = {
        position: timeline.start_position,
        heading_deg: null,
        phase: "at_rover",
        knot_id: null,
        task_id: null,
        is_on_detour: false,
    };
    if (simSeconds < timeline.started_at_sim_seconds || timeline.segments.length === 0) {
        return atRover;
    }
    if (simSeconds >= timeline.end_s) {
        const lastSegment = timeline.segments[timeline.segments.length - 1];
        const lastPath = lastSegment.path_positions;
        return { ...atRover, position: lastPath[lastPath.length - 1] };
    }

    for (const segment of timeline.segments) {
        if (simSeconds >= segment.end_s) {
            continue;
        }
        if (segment.segment_kind === "science_task") {
            return {
                position: segment.path_positions[0],
                heading_deg: null,
                phase: "at_knot",
                knot_id: segment.knot_id,
                task_id: segment.task_id,
                is_on_detour: false,
            };
        }
        const duration = segment.end_s - segment.start_s;
        let fraction = 1;
        if (duration > 0) {
            fraction = (simSeconds - segment.start_s) / duration;
        }
        const point = pointAlongPath(segment.path_positions, segment.cumulative_distance_m, fraction);
        return {
            position: point.position,
            heading_deg: point.heading_deg,
            phase: "walking",
            knot_id: segment.knot_id,
            task_id: null,
            is_on_detour: false,
        };
    }
    return atRover;
}



// Where the astronaut is at simSeconds. Without a timeline the astronaut waits at the rover. A detour
// takes over from its start time.
export function walkStateAt(
    timeline: WalkTimeline | null,
    detour: WalkDetour | null,
    stagingPoint: LocalPosition,
    simSeconds: number,
): WalkState {
    if (detour !== null && simSeconds >= detour.started_at_sim_seconds && detour.path_positions.length > 0) {
        const path = detour.path_positions;
        const elapsed = simSeconds - detour.started_at_sim_seconds;
        if (elapsed >= detour.walking_time_s) {
            let knotId: string | null = null;
            if (detour.target_kind === "knot") {
                knotId = detour.target_id;
            }
            return {
                position: path[path.length - 1],
                heading_deg: null,
                phase: detour.phase_on_arrival,
                knot_id: knotId,
                task_id: null,
                is_on_detour: true,
            };
        }
        let fraction = 1;
        if (detour.walking_time_s > 0) {
            fraction = elapsed / detour.walking_time_s;
        }
        const point = pointAlongPath(path, cumulativeDistances(path), fraction);
        return {
            position: point.position,
            heading_deg: point.heading_deg,
            phase: "walking",
            knot_id: null,
            task_id: null,
            is_on_detour: true,
        };
    }

    if (timeline === null) {
        return {
            position: { x_m: stagingPoint.x_m, z_m: stagingPoint.z_m },
            heading_deg: null,
            phase: "at_rover",
            knot_id: null,
            task_id: null,
            is_on_detour: false,
        };
    }
    return planStateAt(timeline, simSeconds);
}



// Task ids whose planned end falls in (fromSeconds, toSeconds], in order. Tasks still running when a
// detour starts are never completed (the astronaut left the Knot).
export function tasksFinishedBetween(
    timeline: WalkTimeline,
    detour: WalkDetour | null,
    fromSeconds: number,
    toSeconds: number,
): string[] {
    const finished: string[] = [];
    for (const segment of timeline.segments) {
        if (segment.segment_kind !== "science_task" || segment.task_id === null) {
            continue;
        }
        if (detour !== null && segment.end_s > detour.started_at_sim_seconds) {
            continue;
        }
        if (segment.end_s > fromSeconds && segment.end_s <= toSeconds) {
            finished.push(segment.task_id);
        }
    }
    return finished;
}
