// Draws the science plan legs on the terrain (D-027). Owner: Malissa, Stage 2.
// Render inside the scene's TerrainProvider. Walking-out legs are solid, the walk back is dashed.
// Numbered stop markers use drei <Html> (no network font needed).

import { Html, Line } from "@react-three/drei";
import { useMemo } from "react";

import { useAriadneStore } from "../../state/store";
import type { SciencePlanLeg } from "../../state/scienceSlice";
import { useTerrain } from "../../terrain/TerrainContext";
import { sampleTerrainSceneY } from "../../terrain/terrainFrame";
import { isLegDashed } from "./planDisplay";



// Placeholder colour until the Stage 3 palette: distinct from fast #ffb347, safe #7fd1ff and the Thread #ffd23f.
export const SCIENCE_PLAN_LINE_COLOUR = "#c77dff";

const PLAN_LIFT_ABOVE_TERRAIN_M = 2.5;
const MARKER_LIFT_ABOVE_TERRAIN_M = 6;



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

    const isDashed = isLegDashed(leg);

    return (
        <Line
            points={points}
            color={SCIENCE_PLAN_LINE_COLOUR}
            lineWidth={4}
            dashed={isDashed}
            dashSize={10}
            gapSize={6}
            depthTest={false}
            renderOrder={33}
            transparent
            opacity={0.95}
        />
    );
}


function StopMarker({ stopNumber, x_m, z_m }: { stopNumber: number; x_m: number; z_m: number }) {
    const { frame } = useTerrain();
    const y = sampleTerrainSceneY(frame, x_m, z_m) + MARKER_LIFT_ABOVE_TERRAIN_M;

    return (
        <Html position={[x_m, y, z_m]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <div
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold"
                style={{ background: "#1f150e", borderColor: SCIENCE_PLAN_LINE_COLOUR, color: SCIENCE_PLAN_LINE_COLOUR }}
            >
                {stopNumber}
            </div>
        </Html>
    );
}



export function SciencePlanLines() {
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const processedData = useAriadneStore((state) => state.processedData);

    if (sciencePlan === null || processedData === null) {
        return null;
    }

    return (
        <group>
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
