// Markers for Knots, the rover (staging point) and shelters. Each has a distinct SHAPE and a text
// label, never colour alone. Drawn as DOM through drei <Html> (no font download, works offline).

import { Html } from "@react-three/drei";
import { useMemo } from "react";

import { sampleTerrainSceneY } from "../terrain/terrainFrame";
import { useTerrain } from "../terrain/TerrainContext";
import type { MarkerKind, SceneMarker } from "./markers";
import { buildSceneMarkers } from "./markers";



export type MarkerSelectHandler = (marker: SceneMarker) => void;


const MARKER_SIZE_PX = 24;
const MARKER_FILL_COLOUR_BY_KIND: Record<MarkerKind, string> = {
    knot: "var(--color-ariadne-accent)",
    staging_point: "var(--color-ariadne-text)",
    shelter: "#7fb3c8",
};
const MARKER_OUTLINE_COLOUR = "#120c08";



function MarkerShape({ markerKind }: { markerKind: MarkerKind }) {
    const fill = MARKER_FILL_COLOUR_BY_KIND[markerKind];
    const commonProps = { fill, stroke: MARKER_OUTLINE_COLOUR, strokeWidth: 2.5, strokeLinejoin: "round" as const };
    let shape: React.ReactNode;
    if (markerKind === "knot") {
        // Diamond.
        shape = <polygon points="12,1 23,12 12,23 1,12" {...commonProps} />;
    } else if (markerKind === "staging_point") {
        // Square with a cross: the rover.
        shape = (
            <>
                <rect x="2" y="2" width="20" height="20" {...commonProps} />
                <path d="M12 6 V18 M6 12 H18" stroke={MARKER_OUTLINE_COLOUR} strokeWidth="2.5" />
            </>
        );
    } else {
        // Triangle: shelter.
        shape = <polygon points="12,2 23,22 1,22" {...commonProps} />;
    }
    return (
        <svg width={MARKER_SIZE_PX} height={MARKER_SIZE_PX} viewBox="0 0 24 24" aria-hidden="true">
            {shape}
        </svg>
    );
}


function MarkerPin({ marker, onSelect }: { marker: SceneMarker; onSelect?: MarkerSelectHandler }) {
    const { frame } = useTerrain();
    const sceneY = sampleTerrainSceneY(frame, marker.position.x_m, marker.position.z_m);

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
                onClick={() => onSelect?.(marker)}
                style={{
                    position: "relative",
                    display: "block",
                    width: MARKER_SIZE_PX,
                    height: MARKER_SIZE_PX,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    pointerEvents: "auto",
                }}
            >
                <MarkerShape markerKind={marker.marker_kind} />
                <span
                    style={{
                        position: "absolute",
                        left: MARKER_SIZE_PX + 4,
                        top: "50%",
                        transform: "translateY(-50%)",
                        whiteSpace: "nowrap",
                        padding: "2px 6px",
                        fontSize: 14,
                        lineHeight: 1.2,
                        color: "var(--color-ariadne-text)",
                        background: "rgba(18, 12, 8, 0.85)",
                        border: "1px solid var(--color-ariadne-border)",
                    }}
                >
                    {marker.label}
                </span>
            </button>
        </Html>
    );
}


export function SceneMarkers({ onMarkerSelect }: { onMarkerSelect?: MarkerSelectHandler }) {
    const { processedData } = useTerrain();
    const markers = useMemo(() => buildSceneMarkers(processedData), [processedData]);
    return (
        <>
            {markers.map((marker) => (
                <MarkerPin key={marker.marker_id} marker={marker} onSelect={onMarkerSelect} />
            ))}
        </>
    );
}
