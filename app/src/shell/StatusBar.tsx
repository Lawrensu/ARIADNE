// Status bar across the bottom (owner: Lawrence, redesign D-031, app/design/visual_direction.md 6.2):
// replayed sol and LMST, the sim clock with play/pause and speed, O2 left and the Thread margin.
// Every reading carries its state as colour, shape and word, and "est." where it is a model value.
// Phone keeps the clock with play, O2 and the Thread only.
//
// Thread margin = time left - walk back from here (contracts.md 4.6, D-027), from the same pure
// maths as the Suit HUD (hud/hudMath.ts computeHudNumbers). The time left is
// computeConsumablesState().planned_time_left_s, which is exactly computeThreadInfo().time_left_s;
// the expensive reachable-area scan in computeThreadInfo is not needed for this number.

import { useMemo } from "react";

import { computeHudNumbers, formatDurationHm } from "../hud/hudMath";
import type { HudState } from "../hud/hudMath";
import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { computeConsumablesState, SIM_SPEED_PRESETS } from "../sim/clock";
import { environmentSampleAt, formatMarsLocalTime } from "../sim/environment";
import { useAriadneStore } from "../state/store";
import { HAZARD_STATE_LABELS, hazardStateColour, StateShape } from "../theme/StateBadge";



const SIM_MINUTE_SECONDS = 60;
const CELL_CLASS = "flex min-w-0 items-center border-r border-ariadne-border px-2 last:border-r-0 lg:px-3";



// The next preset after the current speed, wrapping to the slowest.
export function nextSimSpeed(currentSpeed: number): number {
    for (const preset of SIM_SPEED_PRESETS) {
        if (preset > currentSpeed) {
            return preset;
        }
    }
    return SIM_SPEED_PRESETS[0];
}



function PlayPauseIcon({ isPlaying }: { isPlaying: boolean }) {
    if (isPlaying) {
        return (
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <rect x="3" y="2" width="4" height="14" fill="currentColor" />
                <rect x="11" y="2" width="4" height="14" fill="currentColor" />
            </svg>
        );
    }
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <polygon points="4,2 16,9 4,16" fill="currentColor" />
        </svg>
    );
}



interface ReadingProps {
    label: string;
    value: string;
    state: HudState;
    isEstimate: boolean;
    ariaLabel: string;
}


// Label on top and value below on narrow screens; one line from 1024 px.
function Reading({ label, value, state, isEstimate, ariaLabel }: ReadingProps) {
    const colour = hazardStateColour(state);
    return (
        <div className={`${CELL_CLASS} flex-1 lg:flex-none`} role="group" aria-label={ariaLabel}>
            <div className="flex min-w-0 flex-col leading-tight lg:flex-row lg:items-center lg:gap-2">
                <span className="truncate text-xs uppercase tracking-wider text-ariadne-dim">
                    {label}
                    {isEstimate && <span className="ml-1 normal-case tracking-normal">est.</span>}
                </span>
                <span className="flex min-w-0 items-center gap-1 whitespace-nowrap" style={{ color: colour }}>
                    <span className="text-sm font-bold tabular-nums lg:text-base">{value}</span>
                    <StateShape state={state} sizePx={14} />
                    <span className="text-xs font-bold uppercase">{HAZARD_STATE_LABELS[state]}</span>
                </span>
            </div>
        </div>
    );
}



function MarsTimeCell() {
    const processedData = useAriadneStore((state) => state.processedData);
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    const simMinuteIndex = Math.floor(simElapsedSeconds / SIM_MINUTE_SECONDS);

    const sample = useMemo(() => {
        if (processedData === null) {
            return null;
        }
        return environmentSampleAt(processedData.environmentTimeline, simMinuteIndex * SIM_MINUTE_SECONDS);
    }, [processedData, simMinuteIndex]);

    let solText = "SOL ?";
    if (processedData !== null) {
        solText = `SOL ${processedData.environmentTimeline.replay_source.sol}`;
    }
    let lmstText = "no data";
    if (sample !== null) {
        // "HH:MM:SS" from the REMS sample; minutes are enough on the bar.
        lmstText = formatMarsLocalTime(sample.local_mean_solar_time).slice(0, 5);
    }

    return (
        <div
            className={`${CELL_CLASS} hidden shrink-0 md:flex`}
            role="group"
            aria-label={`Replayed Mars time: ${solText}, local mean solar time ${lmstText}`}
            title="REMS weather replayed on the sim clock, not live."
        >
            <div className="flex flex-col leading-tight lg:flex-row lg:items-center lg:gap-2">
                <span className="text-xs uppercase tracking-wider text-ariadne-dim">{solText}</span>
                <span className="whitespace-nowrap text-sm tabular-nums text-ariadne-data lg:text-base">
                    <span className="text-xs text-ariadne-dim">LMST </span>
                    {lmstText}
                </span>
            </div>
        </div>
    );
}



function ClockCell() {
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    const isSimPlaying = useAriadneStore((state) => state.isSimPlaying);
    const simSpeedMultiplier = useAriadneStore((state) => state.simSpeedMultiplier);
    const setSimPlaying = useAriadneStore((state) => state.setSimPlaying);
    const setSimSpeedMultiplier = useAriadneStore((state) => state.setSimSpeedMultiplier);

    let playClass = "flex h-full w-12 shrink-0 items-center justify-center border-r border-ariadne-border ";
    if (isSimPlaying) {
        playClass += "bg-ariadne-accent text-ariadne-background";
    } else {
        playClass += "text-ariadne-accent hover:bg-ariadne-panel-raised";
    }

    return (
        <div className="flex shrink-0 items-stretch border-r border-ariadne-border" role="group" aria-label="Simulation clock">
            <button
                type="button"
                className={playClass}
                aria-label={isSimPlaying ? "Pause the simulation clock" : "Play the simulation clock"}
                aria-pressed={isSimPlaying}
                onClick={() => setSimPlaying(!isSimPlaying)}
            >
                <PlayPauseIcon isPlaying={isSimPlaying} />
            </button>
            <div className="flex flex-col justify-center px-2 leading-tight lg:flex-row lg:items-center lg:gap-2 lg:px-3">
                <span className="text-xs uppercase tracking-wider text-ariadne-dim">Sim</span>
                <span className="whitespace-nowrap text-sm tabular-nums text-ariadne-text lg:text-base">
                    T+{formatDurationHm(simElapsedSeconds)}
                </span>
            </div>
            <button
                type="button"
                className="hidden h-full min-w-14 items-center justify-center border-l border-ariadne-border px-2 text-sm tabular-nums text-ariadne-text hover:bg-ariadne-panel-raised md:flex"
                aria-label={`Simulation speed ${simSpeedMultiplier} times. Tap for the next speed.`}
                onClick={() => setSimSpeedMultiplier(nextSimSpeed(simSpeedMultiplier))}
            >
                {simSpeedMultiplier}x
            </button>
        </div>
    );
}



function SuitReadings() {
    const processedData = useAriadneStore((state) => state.processedData);
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);

    const parameters = processedData?.meta.parameters;
    const loadParameters = useMemo(() => loadParametersFromMeta(parameters), [parameters]);
    const loadFactorNow = useMemo(() => {
        if (processedData === null) {
            return Number.NaN;
        }
        return loadFactor(carriedLoadKg(processedData.knots, completedTaskIds, loadParameters), loadParameters);
    }, [processedData, completedTaskIds, loadParameters]);

    const consumables = computeConsumablesState(simElapsedSeconds, parameters);

    let o2Text = formatDurationHm(consumables.suit_remaining_s);
    let o2State: HudState = "no_go";
    let threadText = "unknown";
    let threadState: HudState = "no_go";
    if (processedData !== null) {
        const position = astronautPosition ?? processedData.meta.staging_point;
        const numbers = computeHudNumbers({
            grid: processedData.meta.grid,
            returnField: processedData.float32Layers.return_field,
            position,
            timeLeftSeconds: consumables.planned_time_left_s,
            loadFactor: loadFactorNow,
            o2RemainingSeconds: consumables.suit_remaining_s,
            nextKnotDistanceM: Number.NaN,
            nextKnotWalkTimeSeconds: Number.NaN,
        });
        o2Text = numbers.o2Text;
        o2State = numbers.o2State;
        threadText = numbers.threadMarginText;
        threadState = numbers.threadState;
    }

    return (
        <>
            <Reading
                label="O2"
                value={o2Text}
                state={o2State}
                isEstimate
                ariaLabel={`O2 left, est.: ${o2Text} hours and minutes, ${HAZARD_STATE_LABELS[o2State]}`}
            />
            <Reading
                label="Thread"
                value={threadText}
                state={threadState}
                isEstimate
                ariaLabel={`Thread margin, est.: ${threadText}, ${HAZARD_STATE_LABELS[threadState]}`}
            />
        </>
    );
}



export function StatusBar() {
    return (
        <footer
            className="relative z-40 box-content flex h-[var(--ariadne-status-bar-height)] shrink-0 items-stretch overflow-hidden border-t border-ariadne-accent bg-ariadne-background text-ariadne-text"
            aria-label="Status"
        >
            <MarsTimeCell />
            <ClockCell />
            <SuitReadings />
        </footer>
    );
}
