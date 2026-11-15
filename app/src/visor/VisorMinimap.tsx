// Visor minimap (owner: Lawrence, D-032): a small north-up SVG circle in the corner of the glass.
// About 300 m around the astronaut (MINIMAP_RADIUS_M): the plan legs, the detour, the trail, Knots
// (diamond), rover (square), shelters (triangle) and the astronaut (arrow turned to the heading).
// The target is always shown: if it lies outside the circle it is pinned to the rim at its bearing.
// Local grid only. The astronaut position is simulated, so the map is labelled "sim.".

import { useMemo } from "react";

import type { LocalPosition } from "../data/contracts";
import { MAP_COLOURS } from "../scene/mapStyle";
import { isRoverAway, useRoverState } from "../scene/RoverMarker";
import { useAriadneStore } from "../state/store";
import type { VisorTarget } from "./useVisorState";
import {
    isInsideMinimap,
    MINIMAP_RADIUS_M,
    minimapPolylinePoints,
    projectToMinimap,
    projectToMinimapClamped,
} from "./visorMath";
import type { MinimapView } from "./visorMath";



const VIEWBOX_UNITS = 200;
const CLIP_ID = "visor-minimap-clip";
const RIM_MARGIN_UNITS = 9;



export interface VisorMinimapProps {
    target: VisorTarget | null;
}



function KnotGlyph({ x, y, isTarget }: { x: number; y: number; isTarget: boolean }) {
    const size = isTarget ? 8 : 5.5;
    const colour = isTarget ? MAP_COLOURS.phosphor_white : MAP_COLOURS.phosphor_green;
    const points = `${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`;
    return <polygon points={points} fill="rgba(5,10,6,0.85)" stroke={colour} strokeWidth={isTarget ? 2 : 1.4} />;
}


function RoverGlyph({ x, y }: { x: number; y: number }) {
    return (
        <rect
            x={x - 5}
            y={y - 5}
            width={10}
            height={10}
            fill="rgba(5,10,6,0.85)"
            stroke={MAP_COLOURS.phosphor_green}
            strokeWidth={1.4}
        />
    );
}


function ShelterGlyph({ x, y, isTarget }: { x: number; y: number; isTarget: boolean }) {
    const size = isTarget ? 8 : 5.5;
    const colour = isTarget ? MAP_COLOURS.no_go : MAP_COLOURS.phosphor_green;
    const points = `${x},${y - size} ${x + size},${y + size} ${x - size},${y + size}`;
    return <polygon points={points} fill="rgba(5,10,6,0.85)" stroke={colour} strokeWidth={isTarget ? 2 : 1.4} />;
}



export function VisorMinimap({ target }: VisorMinimapProps) {
    const processedData = useAriadneStore((state) => state.processedData);
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const astronautHeadingDeg = useAriadneStore((state) => state.astronautHeadingDeg);
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const walkPlanSnapshot = useAriadneStore((state) => state.walkPlanSnapshot);
    const walkDetour = useAriadneStore((state) => state.walkDetour);
    const walkTrail = useAriadneStore((state) => state.walkTrail);
    const roverState = useRoverState();

    const centre: LocalPosition | null = astronautPosition ?? processedData?.meta.staging_point ?? null;

    const view = useMemo<MinimapView | null>(() => {
        if (centre === null) {
            return null;
        }
        return { centre, radiusM: MINIMAP_RADIUS_M, sizeUnits: VIEWBOX_UNITS };
    }, [centre]);

    if (processedData === null || view === null) {
        return null;
    }

    const plan = walkPlanSnapshot ?? sciencePlan;
    const half = VIEWBOX_UNITS / 2;
    // The rover is drawn at its live position (D-033); a faint square stays where it was parked.
    const roverPosition = roverState === null ? processedData.meta.staging_point : roverState.position;
    const rover = projectToMinimap(roverPosition, view);
    const parked = projectToMinimap(processedData.meta.staging_point, view);
    const isAway = isRoverAway(roverState);
    const roverDrive = walkDetour === null ? null : (walkDetour.rover_drive ?? null);
    let driveLinePoints: string | null = null;
    if (roverState !== null && roverState.phase === "driving" && roverDrive !== null) {
        driveLinePoints = minimapPolylinePoints([roverState.position, roverDrive.meet_position], view);
    }

    let heading = 0;
    if (Number.isFinite(astronautHeadingDeg)) {
        heading = astronautHeadingDeg;
    }

    const knotsInRange = processedData.knots.filter((knot) => {
        if (target !== null && target.kind === "knot" && target.id === knot.knot_id) {
            return false;
        }
        return isInsideMinimap({ x_m: knot.x_m, z_m: knot.z_m }, view);
    });
    const sheltersInRange = processedData.shelters.filter((shelter) => {
        if (target !== null && target.kind === "shelter" && target.position.x_m === shelter.x_m && target.position.z_m === shelter.z_m) {
            return false;
        }
        return isInsideMinimap({ x_m: shelter.x_m, z_m: shelter.z_m }, view);
    });

    let targetPoint: { x: number; y: number } | null = null;
    if (target !== null) {
        targetPoint = projectToMinimapClamped(target.position, view, RIM_MARGIN_UNITS);
    }

    return (
        <div
            className="visor-hit relative shrink-0"
            style={{ width: "clamp(112px, 16vw, 200px)" }}
            role="img"
            aria-label={`Minimap, north up, about ${MINIMAP_RADIUS_M} metres around you, local grid, simulated position`}
        >
            <svg viewBox={`0 0 ${VIEWBOX_UNITS} ${VIEWBOX_UNITS}`} className="block h-auto w-full" aria-hidden="true">
                <defs>
                    <clipPath id={CLIP_ID}>
                        <circle cx={half} cy={half} r={half - 1} />
                    </clipPath>
                </defs>
                <circle cx={half} cy={half} r={half - 1} fill="rgba(5,10,6,0.42)" />

                <g clipPath={`url(#${CLIP_ID})`}>
                    <circle cx={half} cy={half} r={half / 2} fill="none" stroke="rgba(92,232,127,0.3)" strokeWidth={1} strokeDasharray="2 4" />

                    {plan !== null &&
                        plan.legs.map((leg, index) => (
                            <polyline
                                key={`plan_leg_${index}`}
                                points={minimapPolylinePoints(leg.path_positions, view)}
                                fill="none"
                                stroke={MAP_COLOURS.parchment}
                                strokeWidth={2}
                                strokeDasharray={leg.leg_kind === "walk_back_to_rover" ? "1 4" : "6 3"}
                                strokeLinecap="round"
                                opacity={0.9}
                            />
                        ))}

                    {walkTrail.length > 1 && (
                        <polyline
                            points={minimapPolylinePoints(walkTrail, view)}
                            fill="none"
                            stroke={MAP_COLOURS.signal_green}
                            strokeWidth={1.6}
                            opacity={0.8}
                        />
                    )}

                    {walkDetour !== null && (
                        <polyline
                            points={minimapPolylinePoints(walkDetour.path_positions, view)}
                            fill="none"
                            stroke={MAP_COLOURS.no_go}
                            strokeWidth={2.6}
                        />
                    )}

                    {isAway && isInsideMinimap(processedData.meta.staging_point, view) && (
                        <rect
                            x={parked.x - 5}
                            y={parked.y - 5}
                            width={10}
                            height={10}
                            fill="none"
                            stroke={MAP_COLOURS.phosphor_green}
                            strokeWidth={1}
                            opacity={0.4}
                        />
                    )}
                    {driveLinePoints !== null && (
                        <polyline
                            points={driveLinePoints}
                            fill="none"
                            stroke={MAP_COLOURS.phosphor_green}
                            strokeWidth={1.6}
                            strokeDasharray="4 3"
                        />
                    )}
                    {isInsideMinimap(roverPosition, view) && <RoverGlyph x={rover.x} y={rover.y} />}
                    {sheltersInRange.map((shelter) => {
                        const point = projectToMinimap({ x_m: shelter.x_m, z_m: shelter.z_m }, view);
                        return <ShelterGlyph key={shelter.shelter_id} x={point.x} y={point.y} isTarget={false} />;
                    })}
                    {knotsInRange.map((knot) => {
                        const point = projectToMinimap({ x_m: knot.x_m, z_m: knot.z_m }, view);
                        return <KnotGlyph key={knot.knot_id} x={point.x} y={point.y} isTarget={false} />;
                    })}
                </g>

                {targetPoint !== null && target !== null && target.kind === "knot" && (
                    <KnotGlyph x={targetPoint.x} y={targetPoint.y} isTarget={true} />
                )}
                {targetPoint !== null && target !== null && target.kind === "shelter" && (
                    <ShelterGlyph x={targetPoint.x} y={targetPoint.y} isTarget={true} />
                )}

                <circle cx={half} cy={half} r={half - 1} fill="none" stroke="rgba(92,232,127,0.55)" strokeWidth={1.2} />
                <text
                    x={half}
                    y={15}
                    textAnchor="middle"
                    fill={MAP_COLOURS.phosphor_white}
                    fontSize={13}
                    fontFamily="var(--ariadne-font-display)"
                >
                    N
                </text>

                <g transform={`translate(${half} ${half}) rotate(${heading})`}>
                    <polygon
                        points="0,-10 7,8 0,4 -7,8"
                        fill={MAP_COLOURS.phosphor_green}
                        stroke={MAP_COLOURS.screen_black}
                        strokeWidth={1}
                    />
                </g>
            </svg>
            <div className="visor-label pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center gap-2 text-[14px]">
                <span>{MINIMAP_RADIUS_M} m</span>
                <span>sim.</span>
            </div>
        </div>
    );
}
