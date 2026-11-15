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



// Planned paths step from 2 m cell centre to cell centre, so on a diagonal they zigzag about a metre
// sideways every few cells. The simulated astronaut walks a smoothed copy (a moving average of the
// path points, ends kept), so the marker, the chase camera and the visor do not shake. Leg times are
// unchanged; only the drawn line on the map keeps the exact cell path.
export const WALK_PATH_SMOOTHING_RADIUS_POINTS = 3;


export function smoothWalkPath(path: LocalPosition[], radiusPoints: number = WALK_PATH_SMOOTHING_RADIUS_POINTS): LocalPosition[] {
    if (path.length < 3 || radiusPoints < 1) {
        return path;
    }
    const smoothed: LocalPosition[] = [];
    const lastIndex = path.length - 1;
    for (let index = 0; index <= lastIndex; index++) {
        // Near the ends the window shrinks symmetrically, so the first and last points stay exact.
        const radius = Math.min(radiusPoints, index, lastIndex - index);
        let sumX = 0;
        let sumZ = 0;
        for (let offset = -radius; offset <= radius; offset++) {
            sumX += path[index + offset].x_m;
            sumZ += path[index + offset].z_m;
        }
        const count = radius * 2 + 1;
        smoothed.push({ x_m: sumX / count, z_m: sumZ / count });
    }
    return smoothed;
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
            path = smoothWalkPath(leg.path_positions);
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



// The heading points at a spot this far ahead on the path still to walk, like car navigation. It
// turns early and smoothly into corners, and at a Knot or the rover it already faces the next leg,
// so the compass, the chase camera and the visor never lag behind a sharp turn.
export const HEADING_LOOK_AHEAD_M = 10;


interface PathAhead {
    path: LocalPosition[];
    cumulative: number[];
    // Distance along this path where the walk currently is (0 for paths still to come).
    fromDistanceM: number;
}


// The point aheadM along the given paths in order, starting at the first one's fromDistanceM; the
// last point when the paths end sooner. Null when there is no path at all.
function pointAhead(paths: PathAhead[], aheadM: number): LocalPosition | null {
    let remaining = aheadM;
    let lastPoint: LocalPosition | null = null;
    for (const entry of paths) {
        if (entry.path.length === 0) {
            continue;
        }
        const total = entry.cumulative[entry.cumulative.length - 1];
        const available = total - entry.fromDistanceM;
        lastPoint = entry.path[entry.path.length - 1];
        if (available >= remaining && total > 0) {
            const fraction = (entry.fromDistanceM + remaining) / total;
            return pointAlongPath(entry.path, entry.cumulative, fraction).position;
        }
        remaining -= Math.max(available, 0);
    }
    return lastPoint;
}


// Look-ahead heading from position, or null when nothing is ahead (end of the walk).
function headingTowardsAhead(position: LocalPosition, paths: PathAhead[]): number | null {
    const ahead = pointAhead(paths, HEADING_LOOK_AHEAD_M);
    if (ahead === null) {
        return null;
    }
    if (distanceMetres(position, ahead) < 0.5) {
        return null;
    }
    return bearingBetween(position, ahead);
}


// The walking legs from segment index startIndex on (tasks skipped), the first from fromDistanceM.
function legsAhead(timeline: WalkTimeline, startIndex: number, fromDistanceM: number): PathAhead[] {
    const paths: PathAhead[] = [];
    for (let index = startIndex; index < timeline.segments.length; index++) {
        const segment = timeline.segments[index];
        if (segment.segment_kind !== "walk_leg") {
            continue;
        }
        let from = 0;
        if (index === startIndex) {
            from = fromDistanceM;
        }
        paths.push({ path: segment.path_positions, cumulative: segment.cumulative_distance_m, fromDistanceM: from });
    }
    return paths;
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
    if (timeline.segments.length === 0) {
        return atRover;
    }
    if (simSeconds < timeline.started_at_sim_seconds) {
        // Waiting at the rover: already facing the first leg.
        return { ...atRover, heading_deg: headingTowardsAhead(atRover.position, legsAhead(timeline, 0, 0)) };
    }
    if (simSeconds >= timeline.end_s) {
        const lastSegment = timeline.segments[timeline.segments.length - 1];
        const lastPath = lastSegment.path_positions;
        return { ...atRover, position: lastPath[lastPath.length - 1] };
    }

    for (let segmentIndex = 0; segmentIndex < timeline.segments.length; segmentIndex++) {
        const segment = timeline.segments[segmentIndex];
        if (simSeconds >= segment.end_s) {
            continue;
        }
        if (segment.segment_kind === "science_task") {
            // At a Knot the astronaut turns to face the next leg before setting off.
            const knotPosition = segment.path_positions[0];
            return {
                position: knotPosition,
                heading_deg: headingTowardsAhead(knotPosition, legsAhead(timeline, segmentIndex + 1, 0)),
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
        const totalLength = segment.cumulative_distance_m[segment.cumulative_distance_m.length - 1] ?? 0;
        const walkedM = Math.min(Math.max(fraction, 0), 1) * totalLength;
        const aheadHeading = headingTowardsAhead(point.position, legsAhead(timeline, segmentIndex, walkedM));
        return {
            position: point.position,
            heading_deg: aheadHeading ?? point.heading_deg,
            phase: "walking",
            knot_id: segment.knot_id,
            task_id: null,
            is_on_detour: false,
        };
    }
    return atRover;
}



// End time of the stay at a Knot: the end of the last of the consecutive science_task segments at
// knotId that contain simSeconds. Null when simSeconds is not inside a stay at that Knot.
// Used to leave a Knot early once the crew has ticked off every task there.
export function knotStayEndSeconds(timeline: WalkTimeline, knotId: string, simSeconds: number): number | null {
    const segments = timeline.segments;
    for (let index = 0; index < segments.length; index++) {
        const segment = segments[index];
        const isTaskAtKnot = segment.segment_kind === "science_task" && segment.knot_id === knotId;
        if (!isTaskAtKnot) {
            continue;
        }
        if (simSeconds < segment.start_s || simSeconds >= segment.end_s) {
            continue;
        }
        // Inside this task: walk forward over the following tasks at the same Knot.
        let stayEnd = segment.end_s;
        let next = index + 1;
        while (next < segments.length) {
            const nextSegment = segments[next];
            if (nextSegment.segment_kind !== "science_task") {
                break;
            }
            if (nextSegment.knot_id !== knotId) {
                break;
            }
            stayEnd = nextSegment.end_s;
            next += 1;
        }
        return stayEnd;
    }
    return null;
}



// How many seconds of the current Knot stay to skip because the crew already ticked off every
// planned task there (by hand, earlier than planned). The walk driver moves the walk start earlier by
// this amount, so the astronaut leaves the Knot now and the rest of the plan keeps its planned
// durations. 0 when the astronaut is not at a plan Knot, is on a detour, or a task is still open.
// Without early ticks it is always 0, so the scripted demo stays exactly as planned.
export function earlyDepartureShiftSeconds(
    timeline: WalkTimeline | null,
    detour: WalkDetour | null,
    plan: SciencePlan | null,
    completedTaskIds: string[],
    stagingPoint: LocalPosition,
    simSeconds: number,
): number {
    if (timeline === null || plan === null) {
        return 0;
    }
    const walk = walkStateAt(timeline, detour, stagingPoint, simSeconds);
    if (walk.is_on_detour || walk.phase !== "at_knot" || walk.knot_id === null) {
        return 0;
    }
    const knotId = walk.knot_id;
    const taskIdsAtKnot = plan.tasks.filter((task) => task.knot_id === knotId).map((task) => task.task_id);
    if (taskIdsAtKnot.length === 0) {
        return 0;
    }
    for (const taskId of taskIdsAtKnot) {
        if (!completedTaskIds.includes(taskId)) {
            return 0;
        }
    }
    const stayEnd = knotStayEndSeconds(timeline, knotId, simSeconds);
    if (stayEnd === null) {
        return 0;
    }
    const remaining = stayEnd - simSeconds;
    if (remaining > 0) {
        return remaining;
    }
    return 0;
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
        const cumulative = cumulativeDistances(path);
        const point = pointAlongPath(path, cumulative, fraction);
        const walkedM = Math.min(Math.max(fraction, 0), 1) * (cumulative[cumulative.length - 1] ?? 0);
        const aheadHeading = headingTowardsAhead(point.position, [{ path, cumulative, fromDistanceM: walkedM }]);
        return {
            position: point.position,
            heading_deg: aheadHeading ?? point.heading_deg,
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




// Where the pressurised rover is (D-033).
// "parked": at the staging point. "driving": on its way to meet the astronaut. "with_crew": at the
// meeting point with the astronaut on board.
export type RoverPhase = "parked" | "driving" | "with_crew";


export interface RoverState {
    position: LocalPosition;
    phase: RoverPhase;
    heading_deg: number | null;
}


// Without a rover drive the rover stays parked. With one it leaves at depart_at_sim_seconds, drives
// the path at constant speed (heading looks ahead like the walker's) and stays at the meeting point.
export function roverStateAt(detour: WalkDetour | null, stagingPoint: LocalPosition, simSeconds: number): RoverState {
    const parked: RoverState = {
        position: { x_m: stagingPoint.x_m, z_m: stagingPoint.z_m },
        phase: "parked",
        heading_deg: null,
    };
    if (detour === null || detour.rover_drive === undefined || detour.rover_drive === null) {
        return parked;
    }
    const drive = detour.rover_drive;
    const path = drive.path_positions;
    if (path.length === 0 || simSeconds < drive.depart_at_sim_seconds) {
        return parked;
    }

    if (simSeconds >= drive.arrive_at_sim_seconds) {
        // Keep facing the way it arrived.
        let arrivedHeading: number | null = null;
        if (path.length >= 2) {
            arrivedHeading = bearingBetween(path[path.length - 2], path[path.length - 1]);
        }
        return {
            position: { x_m: drive.meet_position.x_m, z_m: drive.meet_position.z_m },
            phase: "with_crew",
            heading_deg: arrivedHeading,
        };
    }

    const duration = drive.arrive_at_sim_seconds - drive.depart_at_sim_seconds;
    const fraction = (simSeconds - drive.depart_at_sim_seconds) / duration;
    const cumulative = cumulativeDistances(path);
    const point = pointAlongPath(path, cumulative, fraction);
    const drivenM = Math.min(Math.max(fraction, 0), 1) * (cumulative[cumulative.length - 1] ?? 0);
    const aheadHeading = headingTowardsAhead(point.position, [{ path, cumulative, fromDistanceM: drivenM }]);
    return {
        position: point.position,
        phase: "driving",
        heading_deg: aheadHeading ?? point.heading_deg,
    };
}
