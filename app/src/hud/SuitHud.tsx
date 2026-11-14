// Full-screen Suit HUD (owner: Letta, Stage 3, built by the HUD sub-agent).
// Minimal in-suit display: compass tape, next Knot, exactly three big numbers (distance, Thread
// margin, O2), science budget chip, alerts and on-demand sheets. Rendered only while
// isSuitHudOpen is true; the main agent mounts it in App.tsx and passes alertSlot.
//
// At most three big numbers are always visible. Everything else is one tap away (system_design.md,
// UX design principles). State is always colour, shape and word through StateBadge.

import { useMemo } from "react";
import type { ReactNode } from "react";

import type { EnvironmentSample, Knot } from "../data/contracts";
import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { computeConsumablesState } from "../sim/clock";
import type { SciencePlan } from "../state/scienceSlice";
import { useAriadneStore } from "../state/store";
import { computeThreadInfo } from "../thread/threadInfo";
import { EstimateBadge } from "../theme/EstimateBadge";
import { StateBadge } from "../theme/StateBadge";
import { CompassTape } from "./CompassTape";
import { HudTile } from "./HudTile";
import {
    computeHudNumbers,
    emptyHudNumbers,
    formatDistanceMetres,
    formatMeasurement,
    formatMinutesEstimate,
    formatScienceBudgetChip,
    nearestEnvironmentSample,
    selectNextKnot,
} from "./hudMath";



const SIM_MINUTE_SECONDS = 60;
const CLOSE_BUTTON_CLASS =
    "ariadne-tap-hud min-w-16 border border-ariadne-border px-3 text-sm uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent";



export interface SuitHudProps {
    // The main agent passes the AlertStack here; the HUD never imports app/src/alerts/.
    alertSlot?: ReactNode;
}



function HudSheetFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
    return (
        <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-2 sm:items-center"
            role="presentation"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="ariadne-scroll flex max-h-[92vh] w-full max-w-2xl flex-col gap-3 overflow-y-auto border-2 border-ariadne-accent bg-ariadne-panel p-3 text-ariadne-text"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="ariadne-display text-2xl text-ariadne-accent">{title}</div>
                    <button
                        type="button"
                        className={CLOSE_BUTTON_CLASS}
                        onClick={onClose}
                        aria-label={`Close ${title}`}
                    >
                        Close
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}



interface ScienceBudgetSheetProps {
    plan: SciencePlan | null;
    knots: Knot[];
    completedTaskIds: string[];
    onSetTaskCompleted: (taskId: string, isCompleted: boolean) => void;
    onClose: () => void;
}


function ScienceBudgetSheet({ plan, knots, completedTaskIds, onSetTaskCompleted, onClose }: ScienceBudgetSheetProps) {
    const knotNameById = useMemo(() => new Map(knots.map((knot) => [knot.knot_id, knot.name])), [knots]);

    const budgetText = formatScienceBudgetChip(plan === null ? null : plan.science_budget_left_s);

    let body: ReactNode;
    if (plan === null) {
        body = (
            <p className="text-sm text-ariadne-muted">
                No plan yet. Build one in the Plan panel of the Planning Table, then come back here to
                check tasks off as they are done.
            </p>
        );
    } else {
        body = (
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="ariadne-display text-xl text-ariadne-data">{budgetText}</span>
                    <StateBadge state={plan.feasibility} />
                    <span className="text-sm text-ariadne-muted">
                        Total plan {formatMinutesEstimate(plan.total_plan_time_s)} est., limit{" "}
                        {formatMinutesEstimate(plan.plan_time_limit_s)}.
                    </span>
                </div>

                {plan.drop_task_suggestion !== null && (
                    <p className="text-sm text-ariadne-caution">
                        Suggestion: drop {plan.drop_task_suggestion.label} to save est.{" "}
                        {formatMinutesEstimate(plan.drop_task_suggestion.saves_s)}.
                    </p>
                )}

                {plan.tasks.length === 0 && <p className="text-sm text-ariadne-muted">The plan has no tasks yet.</p>}

                <div className="flex flex-col gap-1">
                    {plan.tasks.map((task) => {
                        const isDone = completedTaskIds.includes(task.task_id);
                        const knotName = knotNameById.get(task.knot_id);
                        let buttonText = "Done";
                        if (isDone) {
                            buttonText = "Undo";
                        }
                        return (
                            <div key={task.task_id} className="flex items-center gap-2 border border-ariadne-border p-2">
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold">{task.label}</div>
                                    <div className="text-xs text-ariadne-muted">
                                        {knotName === undefined ? task.knot_id : knotName} ·
                                        {" "}est. {formatMinutesEstimate(task.duration_s)}, sample est.{" "}
                                        {formatMeasurement(task.sample_mass_kg, 1, "kg")}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="ariadne-tap-hud min-w-20 border border-ariadne-border px-2 text-sm hover:border-ariadne-accent"
                                    aria-pressed={isDone}
                                    aria-label={`${buttonText} ${task.label}`}
                                    onClick={() => onSetTaskCompleted(task.task_id, !isDone)}
                                >
                                    {buttonText}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <p className="text-xs text-ariadne-dim">
                    Done marks the sample mass as carried from now on (est., D-027). The real check-off
                    happens at the Knot.
                </p>
            </div>
        );
    }

    return (
        <HudSheetFrame title="Science budget" onClose={onClose}>
            {body}
        </HudSheetFrame>
    );
}



interface ConditionsSheetProps {
    sample: EnvironmentSample | null;
    replaySol: number | null;
    onClose: () => void;
}


function ConditionRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid grid-cols-[10rem_1fr] gap-2 border-b border-ariadne-border py-1 text-sm">
            <span className="text-ariadne-muted">{label}</span>
            <span className="text-ariadne-text">{value}</span>
        </div>
    );
}


function ConditionsSheet({ sample, replaySol, onClose }: ConditionsSheetProps) {
    let body: ReactNode;
    if (sample === null) {
        body = <p className="text-sm text-ariadne-caution">Environment timeline not loaded.</p>;
    } else {
        let solText = "unknown";
        if (replaySol !== null) {
            solText = String(replaySol);
        }
        body = (
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-sm">
                    <span>Replay weather:</span>
                    <span className="text-ariadne-data">REMS sol {solText}</span>
                    {sample.provenance.is_estimate && <EstimateBadge />}
                </div>
                <ConditionRow label="Local mean solar time" value={sample.local_mean_solar_time} />
                <ConditionRow
                    label="Air temperature"
                    value={formatMeasurement(sample.air_temperature_c, 1, "°C")}
                />
                <ConditionRow
                    label="Ground temperature"
                    value={formatMeasurement(sample.ground_temperature_c, 1, "°C")}
                />
                <ConditionRow label="Pressure" value={formatMeasurement(sample.pressure_pa, 0, "Pa")} />
                <ConditionRow label="UV index" value={sample.uv_index_level.replace(/_/g, " ")} />
                <ConditionRow
                    label="Dust opacity"
                    value={formatMeasurement(sample.dust_opacity_tau, 2, "tau")}
                />
                <ConditionRow
                    label="Radiation dose rate"
                    value={formatMeasurement(sample.radiation_dose_rate_usv_per_hour, 2, "µSv/h")}
                />
                <p className="mt-2 text-xs text-ariadne-dim">
                    Source: {sample.provenance.source_dataset}, product {sample.provenance.product_id}
                    {sample.provenance.timestamp !== undefined && <>, timestamp {sample.provenance.timestamp}</>}
                    {sample.provenance.uncertainty !== undefined && (
                        <>, uncertainty {String(sample.provenance.uncertainty)}</>
                    )}
                    .
                </p>
            </div>
        );
    }

    return (
        <HudSheetFrame title="Conditions" onClose={onClose}>
            <p className="text-sm text-ariadne-muted">
                Replayed historical data on the simulation clock, not live measurements (D-014).
            </p>
            {body}
            <div className="border-t border-ariadne-border pt-2 text-xs text-ariadne-dim">
                REPLAY: weather from REMS sol {replaySol === null ? "unknown" : replaySol}. The solar storm
                RAD reading is the May 2024 event, measured on a different sol (D-025).
            </div>
        </HudSheetFrame>
    );
}



export function SuitHud({ alertSlot }: SuitHudProps) {
    const isSuitHudOpen = useAriadneStore((state) => state.isSuitHudOpen);
    const hudSheet = useAriadneStore((state) => state.hudSheet);
    const setSuitHudOpen = useAriadneStore((state) => state.setSuitHudOpen);
    const setHudSheet = useAriadneStore((state) => state.setHudSheet);
    const processedData = useAriadneStore((state) => state.processedData);
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const astronautHeadingDeg = useAriadneStore((state) => state.astronautHeadingDeg);
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const setTaskCompleted = useAriadneStore((state) => state.setTaskCompleted);
    const viewMode = useAriadneStore((state) => state.viewMode);
    const requestViewReset = useAriadneStore((state) => state.requestViewReset);

    const position = astronautPosition ?? processedData?.meta.staging_point ?? null;
    const parameters = processedData?.meta.parameters;
    const knots = processedData?.knots ?? [];
    const simMinuteIndex = Math.floor(simElapsedSeconds / SIM_MINUTE_SECONDS);

    const loadParameters = useMemo(() => loadParametersFromMeta(parameters), [parameters]);
    const carriedLoadKgNow = useMemo(
        () => carriedLoadKg(knots, completedTaskIds, loadParameters),
        [knots, completedTaskIds, loadParameters],
    );
    const loadFactorNow = loadFactor(carriedLoadKgNow, loadParameters);

    const consumables = useMemo(
        () => computeConsumablesState(simElapsedSeconds, parameters),
        [simElapsedSeconds, parameters],
    );

    // The Thread time left comes from the same reader the map uses. It is refreshed once per
    // simulated minute so the reachable-area scan does not run on every animation frame, and it is
    // skipped while the HUD is closed.
    const threadInfo = useMemo(() => {
        if (!isSuitHudOpen || processedData === null) {
            return null;
        }
        return computeThreadInfo(processedData, simMinuteIndex * SIM_MINUTE_SECONDS, completedTaskIds);
    }, [isSuitHudOpen, processedData, simMinuteIndex, completedTaskIds]);

    const selection = useMemo(
        () =>
            selectNextKnot({
                knots,
                position: position ?? { x_m: Number.NaN, z_m: Number.NaN },
                sciencePlan,
                completedTaskIds,
                parameters,
                loadFactor: loadFactorNow,
            }),
        [knots, position, sciencePlan, completedTaskIds, parameters, loadFactorNow],
    );

    const hudNumbers = useMemo(() => {
        if (processedData === null || position === null) {
            return emptyHudNumbers();
        }
        let timeLeftSeconds = consumables.planned_time_left_s;
        if (threadInfo !== null) {
            timeLeftSeconds = threadInfo.time_left_s;
        }
        return computeHudNumbers({
            grid: processedData.meta.grid,
            returnField: processedData.float32Layers.return_field,
            position,
            timeLeftSeconds,
            loadFactor: loadFactorNow,
            o2RemainingSeconds: consumables.suit_remaining_s,
            nextKnotDistanceM: selection.distanceM,
            nextKnotWalkTimeSeconds: selection.walkTimeSeconds,
        });
    }, [
        processedData,
        position,
        threadInfo,
        consumables.planned_time_left_s,
        consumables.suit_remaining_s,
        loadFactorNow,
        selection.distanceM,
        selection.walkTimeSeconds,
    ]);

    const environmentSample = useMemo(() => {
        if (!isSuitHudOpen || processedData === null) {
            return null;
        }
        return nearestEnvironmentSample(
            processedData.environmentTimeline.samples,
            simMinuteIndex * SIM_MINUTE_SECONDS,
        );
    }, [isSuitHudOpen, processedData, simMinuteIndex]);

    if (!isSuitHudOpen) {
        return null;
    }

    const replaySol = processedData === null ? null : processedData.environmentTimeline.replay_source.sol;
    const sunAzimuthDeg = processedData === null ? null : processedData.meta.sun.sun_azimuth_deg;
    const nextKnotBearingDeg = selection.knot === null ? null : selection.bearingDeg;
    const budgetText = formatScienceBudgetChip(sciencePlan === null ? null : sciencePlan.science_budget_left_s);

    let nextKnotSourceText = "No data";
    if (selection.source === "science_plan") {
        nextKnotSourceText = "Science plan";
    } else if (selection.source === "nearest_knot") {
        nextKnotSourceText = "Nearest Knot";
    }

    let nextKnotDistanceText = "Distance unknown";
    if (selection.knot !== null) {
        nextKnotDistanceText = `${formatDistanceMetres(selection.distanceM)} away`;
    }

    let nextKnotDistanceSourceText = "Load the Marswalk data to see the next Knot.";
    if (selection.knot !== null && selection.isDistanceFromPlan) {
        nextKnotDistanceSourceText = "Distance from the planned walking leg.";
    } else if (selection.knot !== null) {
        nextKnotDistanceSourceText = "Straight-line distance, est. Walk time is from the walking model.";
    }

    let nextKnotBearingText = "unknown";
    if (selection.knot !== null && Number.isFinite(selection.bearingDeg)) {
        nextKnotBearingText = `${selection.bearingWord} (${Math.round(selection.bearingDeg)}°)`;
    }

    let alertsContent: ReactNode;
    if (alertSlot === undefined || alertSlot === null) {
        alertsContent = <p className="text-sm text-ariadne-dim">No active alerts.</p>;
    } else {
        alertsContent = alertSlot;
    }

    function onResetViewClicked() {
        requestViewReset(viewMode);
    }

    function onExitHudClicked() {
        setSuitHudOpen(false);
    }

    function onScienceBudgetClicked() {
        setHudSheet("science_budget");
    }

    function onConditionsClicked() {
        setHudSheet("conditions");
    }

    function onSheetCloseClicked() {
        setHudSheet("none");
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col gap-2 overflow-y-auto bg-ariadne-background p-2 text-ariadne-text">
            <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ariadne-border pb-2">
                <div className="ariadne-display ariadne-glow text-2xl leading-none text-ariadne-accent sm:text-3xl">
                    SUIT DISPLAY
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-1 text-[length:var(--ariadne-text-xs)] text-ariadne-muted">
                    <span className="border border-ariadne-border px-1 uppercase tracking-widest">REPLAY</span>
                    {environmentSample === null ? (
                        <span>environment not loaded</span>
                    ) : (
                        <span>LMST {environmentSample.local_mean_solar_time}</span>
                    )}
                </div>
                <button
                    type="button"
                    className={`${CLOSE_BUTTON_CLASS} ml-auto`}
                    aria-label="Exit suit display"
                    onClick={onExitHudClicked}
                >
                    EXIT HUD
                </button>
            </header>

            <CompassTape
                headingDeg={astronautHeadingDeg}
                nextKnotBearingDeg={nextKnotBearingDeg}
                sunAzimuthDeg={sunAzimuthDeg}
            />

            <section
                className="flex shrink-0 flex-col gap-1 border border-ariadne-border bg-ariadne-panel p-2"
                aria-label="Next Knot"
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[length:var(--ariadne-text-xs)] uppercase tracking-widest text-ariadne-muted">
                        Next Knot
                    </span>
                    <span className="text-[length:var(--ariadne-text-xs)] text-ariadne-dim">{nextKnotSourceText}</span>
                </div>
                <div className="ariadne-display text-2xl leading-none text-ariadne-text">
                    {selection.knot === null ? "No Knots loaded" : selection.knot.name}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ariadne-muted">
                    <span>{nextKnotDistanceText}</span>
                    <span>Bearing {nextKnotBearingText}</span>
                    <span className="flex items-center gap-1">
                        Walk <span className="text-ariadne-data">{formatMinutesEstimate(selection.walkTimeSeconds)}</span>
                        <EstimateBadge />
                    </span>
                </div>
                <div className="text-[length:var(--ariadne-text-xs)] text-ariadne-dim">{nextKnotDistanceSourceText}</div>
            </section>

            <section className="grid shrink-0 grid-cols-3 gap-2" aria-label="Three main readings">
                <HudTile
                    label="Next Knot"
                    value={hudNumbers.distanceText}
                    state={hudNumbers.distanceState}
                    ariaLabel={`Distance to next Knot: ${hudNumbers.distanceText}`}
                />
                <HudTile
                    label="Thread margin"
                    value={hudNumbers.threadMarginText}
                    state={hudNumbers.threadState}
                    isEstimate
                    ariaLabel={`Thread margin: ${hudNumbers.threadMarginText}`}
                />
                <HudTile
                    label="O2 h:mm"
                    value={hudNumbers.o2Text}
                    state={hudNumbers.o2State}
                    isEstimate
                    ariaLabel={`O2 left: ${hudNumbers.o2Text} hours and minutes`}
                />
            </section>

            <section className="flex shrink-0 flex-wrap gap-2" aria-label="Science budget and conditions">
                <button
                    type="button"
                    className="ariadne-tap-hud flex min-w-0 flex-1 items-center gap-2 border border-ariadne-border bg-ariadne-panel px-3 text-left hover:border-ariadne-accent"
                    aria-label="Open the science budget sheet"
                    onClick={onScienceBudgetClicked}
                >
                    <span className="min-w-0 text-[length:var(--ariadne-text-xs)] uppercase tracking-widest text-ariadne-muted">
                        Science budget
                    </span>
                    <span className="ariadne-display min-w-0 truncate text-xl text-ariadne-data">{budgetText}</span>
                    {sciencePlan !== null && <StateBadge state={sciencePlan.feasibility} sizePx={14} />}
                </button>
                <button
                    type="button"
                    className={CLOSE_BUTTON_CLASS}
                    aria-label="Open the conditions sheet"
                    onClick={onConditionsClicked}
                >
                    CONDITIONS
                </button>
            </section>

            <section
                className="flex shrink-0 flex-col gap-1 border border-ariadne-border bg-ariadne-panel p-2"
                aria-label="Alerts"
            >
                <div className="text-[length:var(--ariadne-text-xs)] uppercase tracking-widest text-ariadne-muted">
                    ALERTS
                </div>
                <div aria-live="polite">{alertsContent}</div>
            </section>

            <footer className="mt-auto flex shrink-0 flex-wrap gap-2 pt-1">
                <button
                    type="button"
                    className="ariadne-tap-hud min-w-0 flex-1 border border-ariadne-border px-3 text-xs uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent sm:text-sm"
                    aria-label="Reset the active view"
                    onClick={onResetViewClicked}
                >
                    RESET VIEW
                </button>
                <button
                    type="button"
                    className="ariadne-tap-hud min-w-0 flex-1 border border-ariadne-border px-3 text-xs uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent sm:text-sm"
                    aria-label="Exit suit display"
                    onClick={onExitHudClicked}
                >
                    EXIT HUD
                </button>
            </footer>

            {hudSheet === "science_budget" && (
                <ScienceBudgetSheet
                    plan={sciencePlan}
                    knots={knots}
                    completedTaskIds={completedTaskIds}
                    onSetTaskCompleted={setTaskCompleted}
                    onClose={onSheetCloseClicked}
                />
            )}
            {hudSheet === "conditions" && (
                <ConditionsSheet
                    sample={environmentSample}
                    replaySol={replaySol}
                    onClose={onSheetCloseClicked}
                />
            )}
        </div>
    );
}



export function HudLauncher() {
    const setSuitHudOpen = useAriadneStore((state) => state.setSuitHudOpen);
    const isSuitHudOpen = useAriadneStore((state) => state.isSuitHudOpen);

    return (
        <button
            type="button"
            className="ariadne-tap-hud min-w-16 border border-ariadne-border bg-ariadne-panel px-3 text-sm uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent"
            aria-label="Open suit display"
            aria-pressed={isSuitHudOpen}
            onClick={() => setSuitHudOpen(true)}
        >
            SUIT HUD
        </button>
    );
}
