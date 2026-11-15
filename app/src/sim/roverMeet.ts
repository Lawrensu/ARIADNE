// Rover meet point (D-033). Pure: no React, no store. When a storm alert sends the astronaut back to
// the pressurised rover, the rover drives out along the same route (reversed) and the two meet on
// the way, so the astronaut boards sooner than by walking all the way home. Local grid metres only (D-005).
//
// Both move at constant speed along the one path. The astronaut walks it in its walking time (walking
// model x load factor, est.). The rover leaves after a dispatch delay and drives from the other end.
// The meeting point is where both arrive at the same moment. If the rover cannot leave before the
// astronaut would reach it anyway, they meet at the rover.

import type { LocalPosition } from "../data/contracts";
import { pointAlongPath } from "./walkTimeline";



// Pressurised rover concepts drive about 5 to 10 km/h over rough ground; 7 km/h is about 2.0 m/s.
// Estimate, not a measured value (est.).
export const ROVER_DRIVE_SPEED_M_PER_S = 2.0;

// Time from the alert until the rover starts moving (crew or remote start, est.), seconds.
export const ROVER_DISPATCH_DELAY_S = 120;


export interface RoverMeetPlan {
    // Metres along the input path from the astronaut where the two meet (0 to path length).
    meet_distance_m: number;
    // Simulation time of the meeting.
    meet_at_sim_seconds: number;
    meet_position: LocalPosition;
    // The astronaut's path from the astronaut to the meeting point (at least one point).
    astronaut_path: LocalPosition[];
    // The rover's path from where it is parked to the meeting point (one point when they meet at the rover).
    rover_path: LocalPosition[];
    rover_depart_at_sim_seconds: number;
    rover_arrive_at_sim_seconds: number;
    // Metres the rover drives.
    rover_drive_distance_m: number;
    // Seconds the astronaut walks to the meeting point.
    astronaut_walk_time_s: number;
    is_estimate: true;
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


// pathToRover runs from the astronaut (first point) to the rover (last point); it is already smoothed.
// totalWalkTimeS is the astronaut's walking time along the whole path (with load). startAtSimSeconds is
// when the astronaut leaves the plan (the alert reroute time).
export function computeRoverMeet(
    pathToRover: LocalPosition[],
    totalWalkTimeS: number,
    startAtSimSeconds: number,
    driveSpeedMPerS: number = ROVER_DRIVE_SPEED_M_PER_S,
    dispatchDelayS: number = ROVER_DISPATCH_DELAY_S,
): RoverMeetPlan {
    if (pathToRover.length === 0) {
        const origin: LocalPosition = { x_m: 0, z_m: 0 };
        return {
            meet_distance_m: 0,
            meet_at_sim_seconds: startAtSimSeconds,
            meet_position: origin,
            astronaut_path: [origin],
            rover_path: [origin],
            rover_depart_at_sim_seconds: startAtSimSeconds,
            rover_arrive_at_sim_seconds: startAtSimSeconds,
            rover_drive_distance_m: 0,
            astronaut_walk_time_s: 0,
            is_estimate: true,
        };
    }

    const cumulative = cumulativeDistances(pathToRover);
    const totalLengthM = cumulative[cumulative.length - 1];
    const walkTimeS = Math.max(totalWalkTimeS, 0);
    const delayS = Math.max(dispatchDelayS, 0);

    // Seconds after the start when the two meet.
    let meetAfterS = walkTimeS;
    let meetDistanceM = totalLengthM;

    if (totalLengthM <= 0 || walkTimeS <= 0) {
        // Nothing to walk: the astronaut is already at the rover.
        meetAfterS = 0;
    } else if (delayS < walkTimeS && driveSpeedMPerS > 0) {
        // Astronaut walked walkSpeed * t, rover drove driveSpeed * (t - delay); together they cover the path.
        const walkSpeedMPerS = totalLengthM / walkTimeS;
        const candidateS = (totalLengthM + driveSpeedMPerS * delayS) / (walkSpeedMPerS + driveSpeedMPerS);
        meetAfterS = Math.min(Math.max(candidateS, delayS), walkTimeS);
        meetDistanceM = meetAfterS * walkSpeedMPerS;
    }

    // Split the path at the meeting distance.
    const fraction = totalLengthM > 0 ? meetDistanceM / totalLengthM : 1;
    const meetPoint = pointAlongPath(pathToRover, cumulative, fraction).position;
    const meetPosition: LocalPosition = { x_m: meetPoint.x_m, z_m: meetPoint.z_m };

    const astronautPath: LocalPosition[] = [];
    for (let index = 0; index < pathToRover.length; index++) {
        if (cumulative[index] < meetDistanceM) {
            astronautPath.push(pathToRover[index]);
        }
    }
    astronautPath.push(meetPosition);

    const roverPathReversed: LocalPosition[] = [meetPosition];
    for (let index = 0; index < pathToRover.length; index++) {
        if (cumulative[index] > meetDistanceM) {
            roverPathReversed.push(pathToRover[index]);
        }
    }
    const roverPath = roverPathReversed.reverse();
    const roverDriveDistanceM = Math.max(totalLengthM - meetDistanceM, 0);

    const meetAtSimSeconds = startAtSimSeconds + meetAfterS;
    let roverDepartAt = startAtSimSeconds + delayS;
    let roverArriveAt = roverDepartAt;
    if (roverDriveDistanceM > 0 && driveSpeedMPerS > 0) {
        roverArriveAt = roverDepartAt + roverDriveDistanceM / driveSpeedMPerS;
    } else {
        // The rover never leaves: it waits where it is until the astronaut arrives.
        roverDepartAt = meetAtSimSeconds;
        roverArriveAt = meetAtSimSeconds;
    }

    return {
        meet_distance_m: meetDistanceM,
        meet_at_sim_seconds: meetAtSimSeconds,
        meet_position: meetPosition,
        astronaut_path: astronautPath,
        rover_path: roverPath,
        rover_depart_at_sim_seconds: roverDepartAt,
        rover_arrive_at_sim_seconds: roverArriveAt,
        rover_drive_distance_m: roverDriveDistanceM,
        astronaut_walk_time_s: meetAfterS,
        is_estimate: true,
    };
}
