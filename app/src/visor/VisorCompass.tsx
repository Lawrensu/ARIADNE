// Visor compass strip (owner: Lawrence, D-032): a slim tape across the top of the glass. Shows the
// heading in big numbers, tick marks, N E S W, the next target (diamond for a Knot, triangle for a
// shelter) and the sun. A marker outside the window is pinned to the edge with a chevron.
// Local grid only: bearing 0 is north, clockwise. Heading is the simulated heading (sim.).

import { normalizeBearing } from "../hud/hudMath";
import { COMPASS_HALF_SPAN_DEG, compassPlacement, formatBearingDegrees, signedDeltaDegrees } from "./visorMath";
import type { VisorTarget } from "./useVisorState";



const TICK_STEP_DEG = 10;
const CARDINAL_BEARINGS: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W" };
// Markers whose centres are closer than this (percent of the strip width) would print over each other,
// so the second one moves down a lane. Lane 1 sits under lane 0 and above the cardinal letters.
const MARKER_COLLISION_PERCENT = 30;
const MARKER_LANE_PX = 24;



export interface VisorCompassProps {
    headingDeg: number;
    target: VisorTarget | null;
    sunAzimuthDeg: number | null;
}



function MarkerShape({ kind }: { kind: "knot" | "shelter" | "sun" }) {
    if (kind === "knot") {
        return (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <polygon points="7,1 13,7 7,13 1,7" fill="rgba(5,10,6,0.8)" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        );
    }
    if (kind === "shelter") {
        return (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <polygon points="7,1 13,13 1,13" fill="rgba(5,10,6,0.8)" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        );
    }
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="7" cy="7" r="1.6" fill="currentColor" />
        </svg>
    );
}


interface TapeMarkerProps {
    bearingDeg: number;
    headingDeg: number;
    word: string;
    shape: "knot" | "shelter" | "sun";
    colour: string;
    lane: 0 | 1;
}


function TapeMarker({ bearingDeg, headingDeg, word, shape, colour, lane }: TapeMarkerProps) {
    const placement = compassPlacement(bearingDeg, headingDeg);
    let transform = "translateX(-50%)";
    if (placement.edge === "left") {
        transform = "translateX(0)";
    } else if (placement.edge === "right") {
        transform = "translateX(-100%)";
    }
    return (
        <div
            className="absolute flex items-center gap-1 whitespace-nowrap"
            style={{ top: `${lane * MARKER_LANE_PX}px`, left: `${placement.leftPercent}%`, transform, color: colour }}
            aria-hidden="true"
        >
            {placement.edge === "left" && <span className="visor-label text-[20px]">&lt;</span>}
            <MarkerShape kind={shape} />
            <span className="visor-label text-[20px]" style={{ color: colour }}>
                {word}
            </span>
            {placement.edge === "right" && <span className="visor-label text-[20px]">&gt;</span>}
        </div>
    );
}



export function VisorCompass({ headingDeg, target, sunAzimuthDeg }: VisorCompassProps) {
    let safeHeading = 0;
    if (Number.isFinite(headingDeg)) {
        safeHeading = normalizeBearing(headingDeg);
    }

    const ticks: number[] = [];
    const firstTick = Math.ceil((safeHeading - COMPASS_HALF_SPAN_DEG) / TICK_STEP_DEG) * TICK_STEP_DEG;
    for (let tick = firstTick; tick <= safeHeading + COMPASS_HALF_SPAN_DEG; tick += TICK_STEP_DEG) {
        ticks.push(tick);
    }

    let targetWord = "KNOT";
    let targetShape: "knot" | "shelter" = "knot";
    let targetColour = "var(--ariadne-caution)";
    if (target !== null && target.kind === "shelter") {
        targetWord = "SHELTER";
        targetShape = "shelter";
        targetColour = "var(--ariadne-no-go)";
    }

    // Sun goes to the lower lane when it would print over the target label (same edge, or close together).
    const hasTargetBearing = target !== null && Number.isFinite(target.bearingDeg);
    const targetLeftPercent = hasTargetBearing ? compassPlacement(target.bearingDeg, safeHeading).leftPercent : NaN;
    const sunLeftPercent = sunAzimuthDeg !== null ? compassPlacement(sunAzimuthDeg, safeHeading).leftPercent : NaN;
    let sunLane: 0 | 1 = 0;
    if (Math.abs(targetLeftPercent - sunLeftPercent) < MARKER_COLLISION_PERCENT) {
        sunLane = 1;
    }

    let label = `Compass, heading ${formatBearingDegrees(safeHeading)} (sim.)`;
    if (target !== null) {
        label += `, ${targetWord.toLowerCase()} ${formatBearingDegrees(target.bearingDeg)}`;
    }
    if (sunAzimuthDeg !== null) {
        label += `, sun ${formatBearingDegrees(sunAzimuthDeg)}`;
    }

    return (
        <section className="mx-auto w-full max-w-[640px]" role="img" aria-label={label}>
            <div className="flex items-baseline justify-center gap-2">
                <span className="visor-number text-[30px] text-ariadne-text sm:text-[40px]">{formatBearingDegrees(safeHeading)}</span>
                <span className="visor-label text-[18px]">HDG sim.</span>
            </div>

            <div className="relative mt-1 h-[80px] overflow-hidden border-y border-[rgba(92,232,127,0.4)]">
                {ticks.map((tick) => {
                    const normalizedTick = ((tick % 360) + 360) % 360;
                    const cardinal = CARDINAL_BEARINGS[normalizedTick];
                    const left = 50 + (signedDeltaDegrees(tick, safeHeading) / COMPASS_HALF_SPAN_DEG) * 50;
                    return (
                        <div
                            key={tick}
                            className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                            style={{ left: `${left}%` }}
                            aria-hidden="true"
                        >
                            {cardinal !== undefined && (
                                <span className="visor-label text-[24px] text-ariadne-text">{cardinal}</span>
                            )}
                            <span
                                className="w-px"
                                style={{
                                    height: cardinal !== undefined ? 10 : 6,
                                    background: "rgba(92, 232, 127, 0.7)",
                                }}
                            />
                        </div>
                    );
                })}

                {target !== null && Number.isFinite(target.bearingDeg) && (
                    <TapeMarker
                        bearingDeg={target.bearingDeg}
                        headingDeg={safeHeading}
                        word={targetWord}
                        shape={targetShape}
                        colour={targetColour}
                        lane={0}
                    />
                )}
                {sunAzimuthDeg !== null && (
                    <div className="absolute inset-0 opacity-90">
                        <TapeMarker
                            bearingDeg={sunAzimuthDeg}
                            headingDeg={safeHeading}
                            word="SUN"
                            shape="sun"
                            colour="var(--ariadne-parchment)"
                            lane={sunLane}
                        />
                    </div>
                )}

                <div
                    className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
                    style={{ background: "var(--ariadne-phosphor-green)" }}
                    aria-hidden="true"
                />
            </div>
        </section>
    );
}
