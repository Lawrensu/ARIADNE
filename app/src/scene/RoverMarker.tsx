// The live rover on the tablet map (D-033). The rover marker itself is drawn by SceneMarkers (same
// glyph and label rules as the other markers) at the position from roverStateAt; this file adds the
// pieces around it:
//   - useRoverState(): the rover's live state, shared by the tablet map, the visor world markers and
//     the visor minimap. Parked at the staging point until the simulation says otherwise.
//   - RoverParkedMarker: a faint square where the rover was parked, while it is away.
//   - RoverDriveLine: a short dashed line from the rover to the meeting point while it drives.
// Nothing here takes pointer events, so dragging the map still works.

import { Html, Line } from "@react-three/drei";
import { useMemo } from "react";

import type { LocalPosition } from "../data/contracts";
import { roverStateAt } from "../sim/walkTimeline";
import type { RoverState } from "../sim/walkTimeline";
import { useAriadneStore } from "../state/store";
import { sampleTerrainSceneY } from "../terrain/terrainFrame";
import { useTerrain } from "../terrain/TerrainContext";
import { LINE_CASING_COLOUR, LINE_CASING_EXTRA_WIDTH_PX, LINE_CASING_OPACITY, LINE_RENDER_ORDER, MAP_COLOURS } from "./mapStyle";
import { lineLiftM, useSceneLineStyle } from "./sceneLineStyle";
import { useScreenSpaceDashes } from "./useScreenSpaceDashes";



const DRIVE_LINE_LIFT_M = 2.0;
const DRIVE_LINE_WIDTH_PX = 2.5;
const DRIVE_DASH_PX = 8;
const DRIVE_GAP_PX = 6;
const PARKED_SQUARE_PX = 18;



// The rover's live state, or null while the Marswalk data is not loaded. With no rover drive the
// clock is not read, so the hook does not re-render on every clock tick (today's behaviour).
export function useRoverState(): RoverState | null {
    const processedData = useAriadneStore((state) => state.processedData);
    const walkDetour = useAriadneStore((state) => state.walkDetour);
    const clockSeconds = useAriadneStore((state) => {
        const drive = state.walkDetour?.rover_drive;
        if (drive === undefined || drive === null) {
            return 0;
        }
        return state.simElapsedSeconds;
    });

    return useMemo(() => {
        if (processedData === null) {
            return null;
        }
        return roverStateAt(walkDetour, processedData.meta.staging_point, clockSeconds);
    }, [processedData, walkDetour, clockSeconds]);
}


// True when the rover is somewhere other than its parking place.
export function isRoverAway(rover: RoverState | null): boolean {
    return rover !== null && rover.phase !== "parked";
}



// Faint square at the staging point while the rover is away, so the place stays recognisable.
export function RoverParkedMarker() {
    const { frame, processedData } = useTerrain();
    const rover = useRoverState();

    if (!isRoverAway(rover)) {
        return null;
    }
    const staging = processedData.meta.staging_point;
    const sceneY = sampleTerrainSceneY(frame, staging.x_m, staging.z_m);

    return (
        <Html position={[staging.x_m, sceneY, staging.z_m]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
            <div
                aria-hidden="true"
                style={{
                    width: PARKED_SQUARE_PX,
                    height: PARKED_SQUARE_PX,
                    boxSizing: "border-box",
                    border: `1px solid ${MAP_COLOURS.phosphor_green}`,
                    opacity: 0.4,
                    pointerEvents: "none",
                }}
            />
        </Html>
    );
}


function driveLinePoints(
    from: LocalPosition,
    to: LocalPosition,
    sampleY: (position: LocalPosition) => number,
): [number, number, number][] {
    return [
        [from.x_m, sampleY(from), from.z_m],
        [to.x_m, sampleY(to), to.z_m],
    ];
}


// Dashed line from the driving rover to where it will meet the astronaut.
export function RoverDriveLine() {
    const { frame } = useTerrain();
    const rover = useRoverState();
    const walkDetour = useAriadneStore((state) => state.walkDetour);
    const lineStyle = useSceneLineStyle();
    const groupRef = useScreenSpaceDashes();
    const liftM = lineLiftM(DRIVE_LINE_LIFT_M, lineStyle);

    const drive = walkDetour?.rover_drive;
    if (rover === null || rover.phase !== "driving" || drive === undefined || drive === null) {
        return null;
    }

    const sampleY = (position: LocalPosition) => sampleTerrainSceneY(frame, position.x_m, position.z_m) + liftM;
    const points = driveLinePoints(rover.position, drive.meet_position, sampleY);

    return (
        <group ref={groupRef} name="rover_drive_line">
            <Line
                points={points}
                color={LINE_CASING_COLOUR}
                lineWidth={DRIVE_LINE_WIDTH_PX + LINE_CASING_EXTRA_WIDTH_PX}
                depthTest={lineStyle.depth_test}
                depthWrite={false}
                renderOrder={LINE_RENDER_ORDER.route_casing}
                transparent
                opacity={LINE_CASING_OPACITY}
                toneMapped={false}
            />
            <Line
                points={points}
                color={MAP_COLOURS.phosphor_green}
                lineWidth={DRIVE_LINE_WIDTH_PX}
                dashed
                dashSize={DRIVE_DASH_PX}
                gapSize={DRIVE_GAP_PX}
                depthTest={lineStyle.depth_test}
                depthWrite={false}
                renderOrder={LINE_RENDER_ORDER.route_line}
                transparent
                opacity={1}
                toneMapped={false}
            />
        </group>
    );
}
