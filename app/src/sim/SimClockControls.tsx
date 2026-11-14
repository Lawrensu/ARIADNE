// HTML panel for the simulation clock (owner: Malissa, Stage 2; restyled, D-031). Placement is decided by the app shell.
// Width-fluid, no outer frame and no title. Buttons are at least 48 px so they work with gloves.
// The clock is a replay, never live data (D-014).

import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { computeConsumablesState, formatDurationHms, SIM_SPEED_PRESETS } from "./clock";
import { useAriadneStore } from "../state/store";



const BUTTON_BASE_CLASSES =
    "min-h-12 min-w-12 px-3 border font-mono text-sm uppercase tracking-wider cursor-pointer";


function buttonClasses(isActive: boolean): string {
    if (isActive) {
        return `${BUTTON_BASE_CLASSES} border-ariadne-accent bg-ariadne-accent text-ariadne-background`;
    }
    return `${BUTTON_BASE_CLASSES} border-ariadne-border bg-ariadne-panel text-ariadne-text hover:border-ariadne-accent`;
}


function Readout({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="min-w-0 text-xs uppercase tracking-wider text-ariadne-muted">{label}</span>
            <span className="shrink-0 tabular-nums text-ariadne-data">{value}</span>
        </div>
    );
}



export function SimClockControls() {
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    const isSimPlaying = useAriadneStore((state) => state.isSimPlaying);
    const simSpeedMultiplier = useAriadneStore((state) => state.simSpeedMultiplier);
    const parameters = useAriadneStore((state) =>
        state.processedData === null ? undefined : state.processedData.meta.parameters,
    );
    const knots = useAriadneStore((state) => (state.processedData === null ? null : state.processedData.knots));
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const setSimPlaying =useAriadneStore((state) => state.setSimPlaying);
    const setSimSpeedMultiplier = useAriadneStore((state) => state.setSimSpeedMultiplier);
    const resetSim = useAriadneStore((state) => state.resetSim);

    const consumables = computeConsumablesState(simElapsedSeconds, parameters);
    // Carried load now (contracts.md 4.6): tool kit plus the samples of the tasks done so far.
    const loadParameters = loadParametersFromMeta(parameters);
    let carriedKg = loadParameters.base_carried_load_kg;
    if (knots !== null) {
        carriedKg = carriedLoadKg(knots, completedTaskIds, loadParameters);
    }
    const currentLoadFactor = loadFactor(carriedKg, loadParameters);
    const suitIsEmpty = consumables.suit_remaining_s <= 0;
    const playLabel = isSimPlaying ? "Pause" : "Play";

    function onPlayPauseClicked() {
        if (isSimPlaying) {
            setSimPlaying(false);
        } else if (suitIsEmpty === false) {
            setSimPlaying(true);
        }
    }

    return (
        <section className="flex flex-col gap-2 text-ariadne-text" aria-label="Simulation clock">
            <div className="flex gap-1">
                <button type="button" className={`${buttonClasses(isSimPlaying)} flex-1`} onClick={onPlayPauseClicked}>
                    {playLabel}
                </button>
                <button type="button" className={`${buttonClasses(false)} flex-1`} onClick={resetSim}>
                    Reset
                </button>
            </div>
            <div className="flex gap-1" role="group" aria-label="Simulation speed">
                {SIM_SPEED_PRESETS.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        className={`${buttonClasses(preset === simSpeedMultiplier)} flex-1 px-1`}
                        aria-pressed={preset === simSpeedMultiplier}
                        onClick={() => setSimSpeedMultiplier(preset)}
                    >
                        {preset}x
                    </button>
                ))}
            </div>
            <div className="flex flex-col gap-1 text-sm">
                <Readout label="Elapsed" value={formatDurationHms(consumables.elapsed_s)} />
                <Readout label="Walk left, est." value={formatDurationHms(consumables.planned_remaining_s)} />
                <Readout label="Thread time left, est." value={formatDurationHms(consumables.thread_threshold_s)} />
                <Readout label="Load, est." value={`${carriedKg.toFixed(1)} kg, x${currentLoadFactor.toFixed(3)}`} />
                <Readout label="O2 left, est." value={formatDurationHms(consumables.suit_remaining_s)} />
            </div>
            <p className="text-xs text-ariadne-dim">Replay clock, not live data.</p>
        </section>
    );
}
