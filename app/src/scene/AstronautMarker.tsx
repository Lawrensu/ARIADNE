// The simulated astronaut ("you are here"): a circle marker with a heading arrow plus a dotted
// breadcrumb trail of where they have walked. Owner: Lawrence, Stage 3 takeover, D-030; phosphor map
// look, D-031. The short label always says the position is simulated ("YOU (SIM.)").
// The position is simulated (Mars has no GPS); it comes from the walk driver through the walk slice.
// Local grid only: x_m east, z_m south. Render inside the scene's TerrainProvider.

import { Html, Line } from "@react-three/drei";
import { useMemo } from "react";

import type { LocalPosition } from "../data/contracts";
import type { WalkPhase } from "../state/walkSlice";
import { useAriadneStore } from "../state/store";
import { useTerrain } from "../terrain/TerrainContext";
import { sampleTerrainSceneY } from "../terrain/terrainFrame";
import { MapLabel } from "./MapLabel";
import { LINE_RENDER_ORDER, MAP_COLOURS } from "./mapStyle";
import { useScreenSpaceDashes } from "./useScreenSpaceDashes";



const MARKER_SIZE_PX = 30;
const MARKER_LIFT_ABOVE_TERRAIN_M = 2;
const TRAIL_LIFT_ABOVE_TERRAIN_M = 3;
// Where you have walked: a thin dotted muted-green line, quieter than routes and the plan.
const TRAIL_COLOUR = MAP_COLOURS.muted_green;
const TRAIL_WIDTH_PX = 2;
const TRAIL_DASH_PX = 2;
const TRAIL_GAP_PX = 4;
const LABEL_GAP_PX = 4;

const PHASE_WORDS: Record<WalkPhase, string> = {
    walking: "walking",
    at_knot: "at Knot",
    sheltering: "sheltering",
    at_rover: "at rover",
};



function AstronautShape({ headingDeg }: { headingDeg: number }) {
    // Circle with a heading arrow (phosphor outline, dark fill, phosphor white arrow). The arrow points
    // up the screen at heading 0 (north) and is rotated clockwise by the heading.
    return (
        <svg
            width={MARKER_SIZE_PX}
            height={MARKER_SIZE_PX}
            viewBox="0 0 30 30"
            aria-hidden="true"
            style={{ display: "block", transform: `rotate(${headingDeg}deg)` }}
        >
            <circle cx="15" cy="15" r="11.25" fill="rgba(5, 10, 6, 0.9)" stroke={MAP_COLOURS.phosphor_green} strokeWidth="1.5" />
            <circle cx="15" cy="15" r="13.75" fill="none" stroke={MAP_COLOURS.phosphor_green} strokeWidth="1" strokeOpacity="0.45" />
            <path d="M15 6.5 L20.5 19 L15 15.75 L9.5 19 Z" fill={MAP_COLOURS.phosphor_white} strokeLinejoin="miter" />
        </svg>
    );
}



export function AstronautMarker() {
    const { frame, processedData } = useTerrain();
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const headingDeg = useAriadneStore((state) => state.astronautHeadingDeg);
    const walkPhase = useAriadneStore((state) => state.walkPhase);
    const walkStartedAtSimSeconds = useAriadneStore((state) => state.walkStartedAtSimSeconds);
    const walkTrail = useAriadneStore((state) => state.walkTrail);

    const position: LocalPosition = astronautPosition ?? processedData.meta.staging_point;
    const trailGroupRef = useScreenSpaceDashes();

    const trailPoints = useMemo(() => {
        const trailAndCurrent = [...walkTrail, position];
        return trailAndCurrent.map((point) => {
            const y = sampleTerrainSceneY(frame, point.x_m, point.z_m) + TRAIL_LIFT_ABOVE_TERRAIN_M;
            return [point.x_m, y, point.z_m] as [number, number, number];
        });
    }, [walkTrail, position, frame]);

    // Still waiting at the rover: the rover marker already shows there.
    if (walkStartedAtSimSeconds === null && walkPhase === "at_rover") {
        return null;
    }

    const markerY = sampleTerrainSceneY(frame, position.x_m, position.z_m) + MARKER_LIFT_ABOVE_TERRAIN_M;

    return (
        <group ref={trailGroupRef}>
            {trailPoints.length >= 2 ? (
                <Line
                    points={trailPoints}
                    color={TRAIL_COLOUR}
                    lineWidth={TRAIL_WIDTH_PX}
                    dashed
                    dashSize={TRAIL_DASH_PX}
                    gapSize={TRAIL_GAP_PX}
                    depthTest={false}
                    renderOrder={LINE_RENDER_ORDER.walk_trail}
                    transparent
                    opacity={1}
                    toneMapped={false}
                />
            ) : null}
            <Html
                position={[position.x_m, markerY, position.z_m]}
                center
                zIndexRange={[30, 0]}
                style={{ pointerEvents: "none" }}
            >
                <div
                    title={`You (simulated position), ${PHASE_WORDS[walkPhase]}`}
                    style={{ position: "relative", width: MARKER_SIZE_PX, height: MARKER_SIZE_PX, pointerEvents: "none" }}
                >
                    <AstronautShape headingDeg={headingDeg} />
                    <MapLabel
                        emphasis="emphasis"
                        style={{
                            position: "absolute",
                            left: MARKER_SIZE_PX + LABEL_GAP_PX,
                            top: "50%",
                            transform: "translateY(-50%)",
                        }}
                    >
                        {`You (sim.) ${PHASE_WORDS[walkPhase]}`}
                    </MapLabel>
                </div>
            </Html>
        </group>
    );
}
