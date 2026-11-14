// Draws the science plan legs on the terrain (D-027; phosphor map look, D-031). Owner: Malissa, Stage 2.
// Render inside the scene's TerrainProvider. The plan is parchment and dashed: walking-out legs in
// dashes, the walk back to the rover in dots (isLegDashed marks the walk back). Every leg sits on a
// dark casing so it reads on the green terrain. Numbered stop markers use the map label style,
// drawn through drei <Html> (no network font needed).

import { Html, Line } from "@react-three/drei";
import { useMemo } from "react";

import { LINE_CASING_COLOUR, LINE_CASING_EXTRA_WIDTH_PX, LINE_CASING_OPACITY, LINE_RENDER_ORDER, MAP_COLOURS } from "../../scene/mapStyle";
import { MapLabel } from "../../scene/MapLabel";
import { useScreenSpaceDashes } from "../../scene/useScreenSpaceDashes";
import { useAriadneStore } from "../../state/store";
import type { SciencePlanLeg } from "../../state/scienceSlice";
import { useTerrain } from "../../terrain/TerrainContext";
import { sampleTerrainSceneY } from "../../terrain/terrainFrame";
import { isLegDashed } from "./planDisplay";



// Parchment: the science plan is data, not a control (visual_direction.md 6.1 rule 4).
export const SCIENCE_PLAN_LINE_COLOUR = MAP_COLOURS.parchment;

// Screen-pixel dash patterns (useScreenSpaceDashes).
const WALK_OUT_DASH_PX = 10;
const WALK_OUT_GAP_PX = 5;
const WALK_BACK_DASH_PX = 2;
const WALK_BACK_GAP_PX = 5;
const PLAN_LINE_WIDTH_PX = 3;

const PLAN_LIFT_ABOVE_TERRAIN_M = 2.5;
const MARKER_LIFT_ABOVE_TERRAIN_M = 6;
// The stop number sits up and to the left of the Knot glyph, so the Knot label on the right stays free.
const STOP_NUMBER_OFFSET_PX = 16;



function SciencePlanLeg3D({ leg }: { leg: SciencePlanLeg }) {
    const { frame } = useTerrain();

    const points = useMemo(() => {
        return leg.path_positions.map((position) => {
            const y = sampleTerrainSceneY(frame, position.x_m, position.z_m) + PLAN_LIFT_ABOVE_TERRAIN_M;
            return [position.x_m, y, position.z_m] as [number, number, number];
        });
    }, [leg, frame]);

    if (points.length < 2) {
        return null;
    }

    let dashSize: number;
    let gapSize: number;
    if (isLegDashed(leg)) {
        dashSize = WALK_BACK_DASH_PX;
        gapSize = WALK_BACK_GAP_PX;
    } else {
        dashSize = WALK_OUT_DASH_PX;
        gapSize = WALK_OUT_GAP_PX;
    }

    return (
        <group>
            <Line
                points={points}
                color={LINE_CASING_COLOUR}
                lineWidth={PLAN_LINE_WIDTH_PX + LINE_CASING_EXTRA_WIDTH_PX}
                depthTest={false}
                renderOrder={LINE_RENDER_ORDER.science_plan_casing}
                transparent
                opacity={LINE_CASING_OPACITY}
                toneMapped={false}
            />
            <Line
                points={points}
                color={SCIENCE_PLAN_LINE_COLOUR}
                lineWidth={PLAN_LINE_WIDTH_PX}
                dashed
                dashSize={dashSize}
                gapSize={gapSize}
                depthTest={false}
                renderOrder={LINE_RENDER_ORDER.science_plan_line}
                transparent
                opacity={1}
                toneMapped={false}
            />
        </group>
    );
}


function StopMarker({ stopNumber, x_m, z_m }: { stopNumber: number; x_m: number; z_m: number }) {
    const { frame } = useTerrain();
    const y = sampleTerrainSceneY(frame, x_m, z_m) + MARKER_LIFT_ABOVE_TERRAIN_M;

    return (
        <Html position={[x_m, y, z_m]} zIndexRange={[18, 0]} style={{ pointerEvents: "none" }}>
            <div
                style={{
                    position: "absolute",
                    right: STOP_NUMBER_OFFSET_PX - 6,
                    bottom: STOP_NUMBER_OFFSET_PX - 6,
                    pointerEvents: "none",
                }}
            >
                <MapLabel tone="parchment" style={{ minWidth: 18, textAlign: "center", color: SCIENCE_PLAN_LINE_COLOUR }}>
                    {stopNumber}
                </MapLabel>
            </div>
        </Html>
    );
}



export function SciencePlanLines() {
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const processedData = useAriadneStore((state) => state.processedData);
    const groupRef = useScreenSpaceDashes();

    if (sciencePlan === null || processedData === null) {
        return null;
    }

    return (
        <group ref={groupRef}>
            {sciencePlan.legs.map((leg, index) => (
                <SciencePlanLeg3D key={`${leg.leg_kind}-${index}`} leg={leg} />
            ))}
            {sciencePlan.stops.map((stop, index) => {
                const knot = processedData.knots.find((candidate) => candidate.knot_id === stop.knot_id);
                if (knot === undefined) {
                    return null;
                }
                return <StopMarker key={stop.knot_id} stopNumber={index + 1} x_m={knot.x_m} z_m={knot.z_m} />;
            })}
        </group>
    );
}
