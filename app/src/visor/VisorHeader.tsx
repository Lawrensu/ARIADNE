// Visor header (owner: Lawrence, D-032): the small line at the top of the glass: "ARIADNE VISOR",
// the replayed Local Mean Solar Time and sol, a REPLAY badge (this is replayed data, not live,
// D-014), the sync state of the two windows, a link to the tablet view and a DEMO button that opens
// a compact demo strip (run the scripted storm scenario, play or pause, simulation speed).

import { useState } from "react";

import { replaySampleAt } from "../alerts/mars24";
import { SIM_SPEED_PRESETS } from "../sim/clock";
import { runDemoScenario } from "../sim/walkDriver";
import { useAriadneStore } from "../state/store";
import { formatSpeedLabel, formatSyncLabel, nextSpeedPreset } from "./visorMath";



function SyncBadge() {
    const connectedWindowCount = useAriadneStore((state) => state.connectedWindowCount);
    const label = formatSyncLabel(connectedWindowCount);
    const isSynced = label === "SYNCED";

    let colour = "var(--ariadne-muted-green)";
    if (isSynced) {
        colour = "var(--ariadne-phosphor-green)";
    }
    return (
        <span
            className="visor-badge visor-badge-compact"
            style={{ color: colour }}
            aria-label={isSynced ? "Synced with another window" : "Solo, no other window connected"}
        >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="mr-1.5">
                {isSynced ? (
                    <circle cx="5" cy="5" r="4" fill="currentColor" />
                ) : (
                    <circle cx="5" cy="5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                )}
            </svg>
            {label}
        </span>
    );
}


function DemoStrip() {
    const isSimPlaying = useAriadneStore((state) => state.isSimPlaying);
    const simSpeedMultiplier = useAriadneStore((state) => state.simSpeedMultiplier);
    const setSimPlaying = useAriadneStore((state) => state.setSimPlaying);
    const setSimSpeedMultiplier = useAriadneStore((state) => state.setSimSpeedMultiplier);

    return (
        <div className="visor-panel visor-hit mx-auto grid w-full max-w-[640px] grid-cols-3 gap-2 p-2" role="group" aria-label="Demo controls">
            <button type="button" className="visor-button" onClick={() => void runDemoScenario()} aria-label="Run the demo scenario">
                RUN DEMO
            </button>
            <button
                type="button"
                className="visor-button"
                aria-pressed={isSimPlaying}
                aria-label={isSimPlaying ? "Pause the simulation clock" : "Play the simulation clock"}
                onClick={() => setSimPlaying(!isSimPlaying)}
            >
                {isSimPlaying ? "PAUSE" : "PLAY"}
            </button>
            <button
                type="button"
                className="visor-button"
                aria-label={`Simulation speed ${formatSpeedLabel(simSpeedMultiplier)}, tap for the next speed`}
                onClick={() => setSimSpeedMultiplier(nextSpeedPreset(simSpeedMultiplier, SIM_SPEED_PRESETS))}
            >
                {formatSpeedLabel(simSpeedMultiplier)}
            </button>
        </div>
    );
}



export function VisorHeader() {
    const processedData = useAriadneStore((state) => state.processedData);
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    const [isDemoOpen, setIsDemoOpen] = useState(false);

    let clockText = "LMST --";
    if (processedData !== null) {
        const sample = replaySampleAt(processedData.environmentTimeline, simElapsedSeconds);
        const sol = processedData.environmentTimeline.replay_source.sol;
        if (sample !== null) {
            clockText = `LMST ${sample.local_mean_solar_time} SOL ${sol}`;
        }
    }

    return (
        <>
            <header className="flex flex-col gap-1">
                {/* Row 1: wordmark, sync state, tablet link, demo. */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="visor-number truncate text-[18px] text-ariadne-accent sm:text-[28px]">ARIADNE VISOR</span>
                        <SyncBadge />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <a className="visor-chip visor-chip-compact" href="/tablet" aria-label="Open the tablet view">
                            TABLET
                        </a>
                        <button
                            type="button"
                            className="visor-chip visor-chip-compact"
                            aria-expanded={isDemoOpen}
                            aria-label="Show or hide the demo controls"
                            onClick={() => setIsDemoOpen(!isDemoOpen)}
                        >
                            DEMO
                        </button>
                    </div>
                </div>
                {/* Row 2: replayed LMST and sol, with the REPLAY badge (replayed data, not live, D-014). */}
                <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="visor-label truncate text-[16px] sm:text-[20px]" title="Replayed Local Mean Solar Time and REMS sol">
                        {clockText}
                    </span>
                    <span
                        className="visor-badge visor-badge-small shrink-0"
                        style={{ color: "var(--ariadne-parchment)" }}
                        title="Replayed historical data on the simulation clock, not live"
                    >
                        REPLAY
                    </span>
                </div>
            </header>
            {isDemoOpen && <DemoStrip />}
        </>
    );
}
