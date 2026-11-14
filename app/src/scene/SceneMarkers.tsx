// Markers for Knots, the rover (staging point) and shelters on the phosphor map (D-031). Each is a
// glyph with a distinct SHAPE, never colour alone: diamond Knot, square rover, triangle shelter
// (the astronaut, circle with arrow, is AstronautMarker.tsx). Glyphs are crisp 1.5 px phosphor
// outlines with a dark fill. Labels follow the rules in markers.ts (shouldShowMarkerLabel).
// Drawn as DOM through drei <Html> (no font download, works offline). Only the glyph button takes
// pointer events; labels never do, so dragging the map still works over them.

import { Html } from "@react-three/drei";
import { useMemo, useState } from "react";

import { useAriadneStore } from "../state/store";
import { sampleTerrainSceneY } from "../terrain/terrainFrame";
import { useTerrain } from "../terrain/TerrainContext";
import { MapLabel } from "./MapLabel";
import { MAP_COLOURS } from "./mapStyle";
import type { MarkerKind, MarkerLabelContext, SceneMarker } from "./markers";
import {
    alertTargetMarkerIds,
    buildSceneMarkers,
    currentObjectiveMarkerId,
    isMarkerEmphasised,
    markerIdForTarget,
    shouldShowMarkerLabel,
} from "./markers";



export type MarkerSelectHandler = (marker: SceneMarker) => void;


const GLYPH_SIZE_PX = 22;
// Glove-sized hit area around the glyph (visual_direction.md 6.1 rule 6).
const HIT_AREA_PX = 48;
const LABEL_GAP_PX = 4;
const GLYPH_STROKE_PX = 1.5;
const GLYPH_STROKE_EMPHASIS_PX = 2;
const GLYPH_FILL = "rgba(5, 10, 6, 0.9)";



// One glyph per marker kind, in a 22 x 22 box. Strokes sit on half pixels so 1.5 px stays crisp.
function MarkerGlyph({ markerKind, isEmphasised, isHovered }: { markerKind: MarkerKind; isEmphasised: boolean; isHovered: boolean }) {
    let stroke: string = MAP_COLOURS.phosphor_green;
    let strokeWidth = GLYPH_STROKE_PX;
    if (isEmphasised) {
        stroke = MAP_COLOURS.phosphor_white;
        strokeWidth = GLYPH_STROKE_EMPHASIS_PX;
    } else if (isHovered) {
        stroke = MAP_COLOURS.phosphor_white;
    }
    const outline = { fill: GLYPH_FILL, stroke, strokeWidth, strokeLinejoin: "miter" as const };

    let shape: React.ReactNode;
    if (markerKind === "knot") {
        // Diamond with a centre point: a place to study.
        shape = (
            <>
                <polygon points="11,1.75 20.25,11 11,20.25 1.75,11" {...outline} />
                <rect x="9.5" y="9.5" width="3" height="3" fill={stroke} />
            </>
        );
    } else if (markerKind === "staging_point") {
        // Square with an inner square: the rover.
        shape = (
            <>
                <rect x="2.75" y="2.75" width="16.5" height="16.5" {...outline} shapeRendering="crispEdges" />
                <rect x="8" y="8" width="6" height="6" fill={stroke} shapeRendering="crispEdges" />
            </>
        );
    } else {
        // Triangle: a shelter.
        shape = <polygon points="11,2 20.5,19.5 1.5,19.5" {...outline} />;
    }
    return (
        <svg width={GLYPH_SIZE_PX} height={GLYPH_SIZE_PX} viewBox="0 0 22 22" aria-hidden="true" style={{ display: "block" }}>
            {shape}
        </svg>
    );
}


function MarkerPin({
    marker,
    labelContext,
    onSelect,
    onHoverChange,
}: {
    marker: SceneMarker;
    labelContext: MarkerLabelContext;
    onSelect?: MarkerSelectHandler;
    onHoverChange: (markerId: string | null) => void;
}) {
    const { frame } = useTerrain();
    const sceneY = sampleTerrainSceneY(frame, marker.position.x_m, marker.position.z_m);
    const isHovered = labelContext.hoveredMarkerId === marker.marker_id;
    const isEmphasised = isMarkerEmphasised(marker, labelContext);
    const showLabel = shouldShowMarkerLabel(marker, labelContext);

    let labelEmphasis: "normal" | "emphasis" = "normal";
    if (isEmphasised) {
        labelEmphasis = "emphasis";
    }

    return (
        <Html
            position={[marker.position.x_m, sceneY, marker.position.z_m]}
            center
            zIndexRange={[20, 0]}
            style={{ pointerEvents: "none" }}
        >
            <button
                type="button"
                title={marker.label}
                aria-label={marker.label}
                onClick={() => onSelect?.(marker)}
                onPointerEnter={() => onHoverChange(marker.marker_id)}
                onPointerLeave={() => onHoverChange(null)}
                onFocus={() => onHoverChange(marker.marker_id)}
                onBlur={() => onHoverChange(null)}
                style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: HIT_AREA_PX,
                    height: HIT_AREA_PX,
                    padding: 0,
                    border: "none",
                    borderRadius: 0,
                    background: "transparent",
                    cursor: "pointer",
                    pointerEvents: "auto",
                }}
            >
                <MarkerGlyph markerKind={marker.marker_kind} isEmphasised={isEmphasised} isHovered={isHovered} />
                {showLabel ? (
                    <MapLabel
                        emphasis={labelEmphasis}
                        style={{
                            position: "absolute",
                            left: HIT_AREA_PX / 2 + GLYPH_SIZE_PX / 2 + LABEL_GAP_PX,
                            top: "50%",
                            transform: "translateY(-50%)",
                        }}
                    >
                        {marker.label}
                    </MapLabel>
                ) : null}
            </button>
        </Html>
    );
}



export function SceneMarkers({ onMarkerSelect }: { onMarkerSelect?: MarkerSelectHandler }) {
    const { processedData } = useTerrain();
    const markers = useMemo(() => buildSceneMarkers(processedData), [processedData]);
    const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

    const walkDetour = useAriadneStore((state) => state.walkDetour);
    const walkPlanSnapshot = useAriadneStore((state) => state.walkPlanSnapshot);
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const alerts = useAriadneStore((state) => state.alerts);
    const dismissedAlertIds = useAriadneStore((state) => state.dismissedAlertIds);
    const selectedKnotId = useAriadneStore((state) => state.selectedKnotId);
    const routeStart = useAriadneStore((state) => state.routeStart);
    const routeEnd = useAriadneStore((state) => state.routeEnd);

    const labelContext = useMemo<MarkerLabelContext>(() => {
        let plan = sciencePlan;
        if (walkPlanSnapshot !== null) {
            plan = walkPlanSnapshot;
        }
        const selectedMarkerIds = new Set<string>();
        if (selectedKnotId !== null) {
            selectedMarkerIds.add(selectedKnotId);
        }
        if (routeStart !== null) {
            selectedMarkerIds.add(markerIdForTarget(routeStart.endpoint_id));
        }
        if (routeEnd !== null) {
            selectedMarkerIds.add(markerIdForTarget(routeEnd.endpoint_id));
        }
        return {
            objectiveMarkerId: currentObjectiveMarkerId({ detour: walkDetour, plan, completedTaskIds }),
            hoveredMarkerId,
            selectedMarkerIds,
            alertTargetMarkerIds: alertTargetMarkerIds(alerts, dismissedAlertIds),
        };
    }, [walkDetour, walkPlanSnapshot, sciencePlan, completedTaskIds, alerts, dismissedAlertIds, selectedKnotId, routeStart, routeEnd, hoveredMarkerId]);

    return (
        <>
            {markers.map((marker) => (
                <MarkerPin
                    key={marker.marker_id}
                    marker={marker}
                    labelContext={labelContext}
                    onSelect={onMarkerSelect}
                    onHoverChange={setHoveredMarkerId}
                />
            ))}
        </>
    );
}
