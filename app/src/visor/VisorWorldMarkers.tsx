// Visor world markers (owner: Lawrence, D-032). Render inside <MarswalkCanvas cameraKind="first_person">.
// A floating marker over the next Knot (or the shelter while rerouted) and one over the rover, each
// with name and distance. drei <Html> keeps the label at a constant screen size, so it stays
// readable at any distance. The distance is the straight line from the simulated position (est.).
// Shapes: diamond for a Knot, triangle for a shelter, square for the rover (never colour alone).

import { Html } from "@react-three/drei";
import type { ReactNode } from "react";

import { MAP_COLOURS } from "../scene/mapStyle";
import { useAriadneStore } from "../state/store";
import { sampleTerrainSceneY } from "../terrain/terrainFrame";
import { useTerrain } from "../terrain/TerrainContext";
import type { VisorTarget } from "./useVisorState";
import { formatWorldMarkerLabel } from "./visorMath";



// How far above the ground the marker's foot sits, so the glyph does not sink into the terrain.
const FOOT_LIFT_M = 2;
const STEM_HEIGHT_PX = 26;
const GLYPH_SIZE_PX = 22;



export interface VisorWorldMarkersProps {
    target: VisorTarget | null;
}



function WorldGlyph({ shape, colour }: { shape: "knot" | "shelter" | "rover"; colour: string }) {
    let drawing: ReactNode;
    if (shape === "knot") {
        drawing = <polygon points="11,1.5 20.5,11 11,20.5 1.5,11" fill="rgba(5,10,6,0.85)" stroke={colour} strokeWidth="2" />;
    } else if (shape === "shelter") {
        drawing = <polygon points="11,2 20.5,19.5 1.5,19.5" fill="rgba(5,10,6,0.85)" stroke={colour} strokeWidth="2" />;
    } else {
        drawing = <rect x="3" y="3" width="16" height="16" fill="rgba(5,10,6,0.85)" stroke={colour} strokeWidth="2" />;
    }
    return (
        <svg width={GLYPH_SIZE_PX} height={GLYPH_SIZE_PX} viewBox="0 0 22 22" aria-hidden="true" style={{ display: "block" }}>
            {drawing}
        </svg>
    );
}


interface FloatingMarkerProps {
    shape: "knot" | "shelter" | "rover";
    name: string;
    x_m: number;
    z_m: number;
    colour: string;
    isEmphasised: boolean;
}


// One marker: plate with name and distance, a thin stem, the glyph at the foot.
function FloatingMarker({ shape, name, x_m, z_m, colour, isEmphasised }: FloatingMarkerProps) {
    const { frame } = useTerrain();
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const processedData = useAriadneStore((state) => state.processedData);

    const sceneY = sampleTerrainSceneY(frame, x_m, z_m) + FOOT_LIFT_M;
    const from = astronautPosition ?? processedData?.meta.staging_point ?? { x_m, z_m };
    const distanceM = Math.hypot(x_m - from.x_m, z_m - from.z_m);

    let plateBackground = "rgba(5, 10, 6, 0.72)";
    let plateColour: string = MAP_COLOURS.phosphor_white;
    if (isEmphasised) {
        plateBackground = colour;
        plateColour = MAP_COLOURS.screen_black;
    }

    return (
        <Html position={[x_m, sceneY, z_m]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            >
                <div
                    style={{
                        whiteSpace: "nowrap",
                        padding: "2px 8px",
                        fontFamily: "var(--ariadne-font-display)",
                        fontSize: 22,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        lineHeight: 1.1,
                        color: plateColour,
                        background: plateBackground,
                        border: `1px solid ${colour}`,
                        boxShadow: `0 0 12px ${colour}55`,
                    }}
                >
                    {formatWorldMarkerLabel(name, distanceM)}
                    <span style={{ marginLeft: 6, fontSize: 14, opacity: 0.8 }}>est.</span>
                </div>
                <div style={{ width: 1.5, height: STEM_HEIGHT_PX, background: colour }} />
                <WorldGlyph shape={shape} colour={colour} />
            </div>
        </Html>
    );
}



export function VisorWorldMarkers({ target }: VisorWorldMarkersProps) {
    const processedData = useAriadneStore((state) => state.processedData);
    const walkDetour = useAriadneStore((state) => state.walkDetour);

    if (processedData === null) {
        return null;
    }
    const rover = processedData.meta.staging_point;

    // The rover is the shelter target when rerouted to it: show one marker, not two.
    let isRoverTheTarget = false;
    if (walkDetour !== null && walkDetour.target_kind === "staging_point") {
        isRoverTheTarget = true;
    }

    return (
        <>
            {target !== null && target.kind === "knot" && (
                <FloatingMarker
                    shape="knot"
                    name={target.label}
                    x_m={target.position.x_m}
                    z_m={target.position.z_m}
                    colour={MAP_COLOURS.caution}
                    isEmphasised={true}
                />
            )}
            {target !== null && target.kind === "shelter" && (
                <FloatingMarker
                    shape={isRoverTheTarget ? "rover" : "shelter"}
                    name={target.label}
                    x_m={target.position.x_m}
                    z_m={target.position.z_m}
                    colour={MAP_COLOURS.no_go}
                    isEmphasised={true}
                />
            )}
            {!isRoverTheTarget && (
                <FloatingMarker
                    shape="rover"
                    name="Rover"
                    x_m={rover.x_m}
                    z_m={rover.z_m}
                    colour={MAP_COLOURS.phosphor_green}
                    isEmphasised={false}
                />
            )}
        </>
    );
}
