// HTML panel for the simulation clock (owner: Malissa, Stage 2). Placement is decided by the app shell.
// Buttons are at least 48 px tall so they work with gloves. The clock is a replay, never live data (D-014).

import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { computeConsumablesState, formatDurationHms, SIM_SPEED_PRESETS } from "./clock";
import { useAriadneStore } from "../state/store";



const BUTTON_BASE_CLASSES =
    "min-h-12 min-w-12 px-3 border border-ariadne-border font-mono text-sm cursor-pointer";


function buttonClasses(isActive: boolean): string {
    if (isActive) {
        return `${BUTTON_BASE_CLASSES} bg-ariadne-accent text-ariadne-background`;
    }
    return `${BUTTON_BASE_CLASSES} bg-ariadne-panel text-ariadne-text`;
}


function Readout({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <span className="text-ariadne-muted">{label}</span>
            <span>{value}</span>
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
        <section className="flex flex-col gap-3 p-3 border border-ariadne-border bg-ariadne-panel text-ariadne-text">
            <div className="flex gap-2">
                <button type="button" className={buttonClasses(isSimPlaying)} onClick={onPlayPauseClicked}>
                    {playLabel}
                </button>
                <button type="button" className={buttonClasses(false)} onClick={resetSim}>
                    Reset
                </button>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Simulation speed">
                {SIM_SPEED_PRESETS.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        className={buttonClasses(preset === simSpeedMultiplier)}
                        onClick={() => setSimSpeedMultiplier(preset)}
                    >
                        {preset}x
                    </button>
                ))}
            </div>
            <div className="flex flex-col gap-1 text-sm">
                <Readout label="Simulated time elapsed" value={formatDurationHms(consumables.elapsed_s)} />
                <Readout label="Planned walk time left (est.)" value={formatDurationHms(consumables.planned_remaining_s)} />
                <Readout label="Thread threshold, time left (est.)" value={formatDurationHms(consumables.thread_threshold_s)} />
                <Readout
                    label="Carried load now (est.)"
                    value={`${carriedKg.toFixed(1)} kg, factor ${currentLoadFactor.toFixed(3)}`}
                />
                <Readout label="Suit time remaining, O2 (est.)" value={formatDurationHms(consumables.suit_remaining_s)} />
            </div>
            <p className="text-xs text-ariadne-muted">Simulation clock, not live data.</p>
        </section>
    );
}
