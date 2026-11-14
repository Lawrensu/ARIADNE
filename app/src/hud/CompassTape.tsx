// Compass tape for the Suit HUD (owner: Letta, Stage 3, built by the HUD sub-agent).
// Local grid only: x is east, z is south, bearing 0 = north, clockwise (contracts.md 1.1).
// Shows cardinal ticks, the current heading, the next Knot bearing and the sun azimuth.

import { normalizeBearing } from "./hudMath";



const TAPE_HALF_SPAN_DEG = 60;
const TAPE_TICK_STEP_DEG = 15;



export interface CompassTapeProps {
    // Current suit heading, degrees clockwise from north.
    headingDeg: number;
    // Bearing to the next Knot, or null when there is none.
    nextKnotBearingDeg: number | null;
    // Sun azimuth from meta.json, or null when the data is not loaded.
    sunAzimuthDeg: number | null;
}



// Signed shortest difference from the heading to a target, in [-180, 180).
function signedDeltaDegrees(targetDeg: number, headingDeg: number): number {
    return ((targetDeg - headingDeg + 540) % 360) - 180;
}


// Cardinal label for a tick: only N, E, S and W get a word, the rest are bare ticks.
function cardinalLabel(bearingDeg: number): string | null {
    const bearing = normalizeBearing(bearingDeg);
    if (Math.abs(bearing) < 1e-6) {
        return "N";
    }
    if (Math.abs(bearing - 90) < 1e-6) {
        return "E";
    }
    if (Math.abs(bearing - 180) < 1e-6) {
        return "S";
    }
    if (Math.abs(bearing - 270) < 1e-6) {
        return "W";
    }
    return null;
}


// Position on the tape in percent, clamped to its edges. Null when the bearing is outside the window.
function markerLeftPercent(bearingDeg: number | null, headingDeg: number): number | null {
    if (bearingDeg === null || !Number.isFinite(bearingDeg)) {
        return null;
    }
    const delta = signedDeltaDegrees(bearingDeg, headingDeg);
    if (delta < -TAPE_HALF_SPAN_DEG || delta > TAPE_HALF_SPAN_DEG) {
        return null;
    }
    const percent = 50 + (delta / TAPE_HALF_SPAN_DEG) * 50;
    return Math.min(Math.max(percent, 2), 98);
}


function formatBearing(bearingDeg: number | null): string {
    if (bearingDeg === null || !Number.isFinite(bearingDeg)) {
        return "--";
    }
    return `${Math.round(normalizeBearing(bearingDeg))}°`;
}



export function CompassTape({ headingDeg, nextKnotBearingDeg, sunAzimuthDeg }: CompassTapeProps) {
    let safeHeading = 0;
    if (Number.isFinite(headingDeg)) {
        safeHeading = normalizeBearing(headingDeg);
    }

    const ticks: number[] = [];
    const firstTick = Math.ceil((safeHeading - TAPE_HALF_SPAN_DEG) / TAPE_TICK_STEP_DEG) * TAPE_TICK_STEP_DEG;
    for (let tick = firstTick; tick <= safeHeading + TAPE_HALF_SPAN_DEG; tick += TAPE_TICK_STEP_DEG) {
        ticks.push(tick);
    }

    const knotLeft = markerLeftPercent(nextKnotBearingDeg, safeHeading);
    const sunLeft = markerLeftPercent(sunAzimuthDeg, safeHeading);

    let tapeLabel = `Compass, heading ${formatBearing(safeHeading)}`;
    tapeLabel += `, next Knot ${formatBearing(nextKnotBearingDeg)}`;
    tapeLabel += `, sun ${formatBearing(sunAzimuthDeg)}`;

    return (
        <section className="flex min-w-0 flex-col gap-1" aria-label={tapeLabel}>
            <div className="flex min-w-0 items-center justify-between gap-2 text-[length:var(--ariadne-text-xs)] uppercase tracking-widest text-ariadne-muted">
                <span>HDG {formatBearing(safeHeading)}</span>
                <span>KNOT {formatBearing(nextKnotBearingDeg)}</span>
                <span>SUN {formatBearing(sunAzimuthDeg)}</span>
            </div>

            <div className="relative h-16 min-w-0 overflow-hidden border border-ariadne-border bg-ariadne-panel" role="img" aria-label={tapeLabel}>
                {ticks.map((tick) => {
                    const left = 50 + (signedDeltaDegrees(tick, safeHeading) / TAPE_HALF_SPAN_DEG) * 50;
                    const word = cardinalLabel(tick);
                    const isCardinal = word !== null;
                    const tickHeight = isCardinal ? 14 : 7;
                    return (
                        <div
                            key={tick}
                            className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                            style={{ left: `${left}%` }}
                            aria-hidden="true"
                        >
                            {isCardinal && (
                                <span className="mb-0.5 text-[length:var(--ariadne-text-xs)] text-ariadne-muted">{word}</span>
                            )}
                            <span
                                className="w-px"
                                style={{ height: tickHeight, background: "var(--ariadne-grid-green)" }}
                            />
                        </div>
                    );
                })}

                {knotLeft !== null && (
                    <div
                        className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                        style={{ left: `${knotLeft}%` }}
                        aria-hidden="true"
                    >
                        <span className="text-[length:var(--ariadne-text-xs)] font-bold text-ariadne-caution">K</span>
                        <span className="h-2 w-0.5" style={{ background: "var(--ariadne-caution)" }} />
                    </div>
                )}

                {sunLeft !== null && (
                    <div
                        className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                        style={{ left: `${sunLeft}%` }}
                        aria-hidden="true"
                    >
                        <span className="text-[length:var(--ariadne-text-xs)] text-ariadne-data">SUN</span>
                        <span className="h-2 w-0.5" style={{ background: "var(--ariadne-data)" }} />
                    </div>
                )}

                <div
                    className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
                    style={{ background: "var(--ariadne-accent)" }}
                    aria-hidden="true"
                />
                <div
                    className="absolute left-1/2 top-0 -translate-x-1/2"
                    style={{
                        width: 0,
                        height: 0,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderTop: "8px solid var(--ariadne-accent)",
                    }}
                    aria-hidden="true"
                />
            </div>
        </section>
    );
}
