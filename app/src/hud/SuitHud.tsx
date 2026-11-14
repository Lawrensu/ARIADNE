// Full-screen Suit HUD (owner: Letta, Stage 3, built by the HUD sub-agent).
// Minimal in-suit display: compass tape, next Knot, exactly three big numbers (distance, Thread
// margin, O2), science budget chip, alerts and on-demand sheets. Rendered only while
// isSuitHudOpen is true; the main agent mounts it in App.tsx and passes alertSlot.
//
// At most three big numbers are always visible. Everything else is one tap away (system_design.md,
// UX design principles). State is always colour, shape and word through StateBadge.

import { useMemo } from "react";
import type { ReactNode } from "react";

import type { EnvironmentSample, Knot, LocalPosition, Provenance } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";
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
    bearingDegrees,
    bearingWord,
    computeHudNumbers,
    emptyHudNumbers,
    formatDistanceMetres,
    formatMeasurement,
    formatMinutesEstimate,
    formatScienceBudgetChip,
    nearestEnvironmentSample,
    normalizeBearing,
    selectNextKnot,
} from "./hudMath";



const SIM_MINUTE_SECONDS = 60;
const CLOSE_BUTTON_CLASS =
    "ariadne-tap-hud min-w-16 border border-ariadne-border px-3 text-sm uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent";



export interface SuitHudProps {
    // The main agent passes the AlertStack here; the HUD never imports app/src/alerts/.
    alertSlot?: ReactNode;
}



interface ReadingProvenance {
    distance: Provenance;
    threadMargin: Provenance;
    o2: Provenance;
}


// Provenance for the three big readings (contracts.md 1.5). The Thread margin reads the
// return_field layer entry from meta.json when present, so the dataset and product ID are real.
function buildReadingProvenance(
    processedData: ProcessedData | null,
    nextKnot: Knot | null,
    simElapsedSeconds: number,
): ReadingProvenance {
    const timestampText = `sim T+${Math.floor(Math.max(simElapsedSeconds, 0) / 60)} min`;

    let returnFieldDataset = "ARIADNE return_field.bin (pipeline)";
    let returnFieldProductId = "return_field";
    let returnFieldResolutionM: number | undefined = undefined;
    if (processedData !== null) {
        const entry = processedData.meta.layers.find((layer) => layer.layer_id === "return_field");
        if (entry !== undefined) {
            returnFieldDataset = entry.source_dataset;
            returnFieldProductId = entry.product_id;
            returnFieldResolutionM = entry.native_resolution_m;
        }
    }

    let distanceProductId = "no Knot selected";
    if (nextKnot !== null) {
        distanceProductId = nextKnot.knot_id;
    }

    return {
        distance: {
            source_dataset: "ARIADNE local grid: your position and Knot position",
            product_id: distanceProductId,
            timestamp: timestampText,
            is_estimate: true,
            uncertainty: "straight line unless taken from the planned leg",
        },
        threadMargin: {
            source_dataset: returnFieldDataset,
            product_id: returnFieldProductId,
            resolution_m: returnFieldResolutionM,
            timestamp: timestampText,
            is_estimate: true,
            uncertainty: "walking model, carried load included",
        },
        o2: {
            source_dataset: "ARIADNE suit consumables model (meta.json parameters)",
            product_id: "suit_capability_hours",
            timestamp: timestampText,
            is_estimate: true,
            uncertainty: "8 h suit capability minus elapsed simulation time",
        },
    };
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
    const walkDetour = useAriadneStore((state) => state.walkDetour);

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
    const budgetText = formatScienceBudgetChip(sciencePlan === null ? null : sciencePlan.science_budget_left_s);

    // While rerouted the HUD points at the shelter (the end of the detour path), not at the Knot.
    let shelterPosition: LocalPosition | null = null;
    if (walkDetour !== null && walkDetour.path_positions.length > 0) {
        shelterPosition = walkDetour.path_positions[walkDetour.path_positions.length - 1];
    }

    let nextKnotBearingDeg: number | null = null;
    let bearingWordText = "";
    let distanceTileText = hudNumbers.distanceText;
    let distanceTileState = hudNumbers.distanceState;
    let distanceTileLabel = "Next Knot";

    if (walkDetour !== null && shelterPosition !== null && position !== null) {
        nextKnotBearingDeg = bearingDegrees(position.x_m, position.z_m, shelterPosition.x_m, shelterPosition.z_m);
        bearingWordText = bearingWord(nextKnotBearingDeg);
        const shelterDistanceM = Math.hypot(shelterPosition.x_m - position.x_m, shelterPosition.z_m - position.z_m);
        distanceTileText = formatDistanceMetres(shelterDistanceM);
        distanceTileState = "go";
        distanceTileLabel = "Shelter";
    } else if (selection.knot !== null && Number.isFinite(selection.bearingDeg)) {
        nextKnotBearingDeg = selection.bearingDeg;
        bearingWordText = selection.bearingWord;
    }

    let bearingText = "";
    if (nextKnotBearingDeg !== null) {
        bearingText = `${bearingWordText} ${Math.round(normalizeBearing(nextKnotBearingDeg))}°`;
    }

    const readingProvenance = buildReadingProvenance(processedData, selection.knot, simElapsedSeconds);

    let alertsContent: ReactNode;
    if (alertSlot === undefined || alertSlot === null) {
        alertsContent = <p className="ariadne-display text-2xl text-ariadne-dim">NO ALERTS</p>;
    } else {
        alertsContent = alertSlot;
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

    let nextBlock: ReactNode;
    if (walkDetour !== null) {
        nextBlock = (
            <>
                <div className="flex flex-wrap items-center gap-2">
                    <StateBadge state="caution" sizePx={16} />
                    <span className="ariadne-display text-xl leading-none text-ariadne-caution">REROUTED</span>
                </div>
                <div className="ariadne-display break-words text-4xl leading-none text-ariadne-caution sm:text-5xl">
                    SHELTER: {walkDetour.target_label}
                </div>
            </>
        );
    } else {
        nextBlock = (
            <>
                <div className="ariadne-display text-xl leading-none text-ariadne-muted">NEXT KNOT</div>
                <div className="ariadne-display ariadne-glow break-words text-4xl leading-none text-ariadne-text sm:text-5xl">
                    {selection.knot === null ? "NO KNOTS" : selection.knot.name}
                </div>
            </>
        );
    }

    let nextBlockBorderColour = "var(--ariadne-border)";
    if (walkDetour !== null) {
        nextBlockBorderColour = "var(--ariadne-caution)";
    }

    return (
        <div
            className="ariadne-scroll absolute inset-0 overflow-y-auto overflow-x-hidden bg-ariadne-background text-ariadne-text"
            aria-label="Suit display"
        >
            <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-3 p-3">
                <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-3">
                        <CompassTape
                            headingDeg={astronautHeadingDeg}
                            nextKnotBearingDeg={nextKnotBearingDeg}
                            sunAzimuthDeg={sunAzimuthDeg}
                        />

                        <section className="grid min-w-0 gap-2 sm:grid-cols-3" aria-label="Three main readings">
                            <HudTile
                                label={distanceTileLabel}
                                value={distanceTileText}
                                state={distanceTileState}
                                ariaLabel={`Distance to ${distanceTileLabel}: ${distanceTileText}`}
                                provenance={readingProvenance.distance}
                            />
                            <HudTile
                                label="Thread margin"
                                value={hudNumbers.threadMarginText}
                                state={hudNumbers.threadState}
                                isEstimate
                                ariaLabel={`Thread margin: ${hudNumbers.threadMarginText}`}
                                provenance={readingProvenance.threadMargin}
                            />
                            <HudTile
                                label="O2 h:mm"
                                value={hudNumbers.o2Text}
                                state={hudNumbers.o2State}
                                isEstimate
                                ariaLabel={`O2 left: ${hudNumbers.o2Text} hours and minutes`}
                                provenance={readingProvenance.o2}
                            />
                        </section>
                    </div>

                    <div className="flex min-w-0 flex-col gap-3">
                        <section
                            className="flex min-w-0 flex-col gap-1 border bg-ariadne-panel p-3"
                            style={{ borderColor: nextBlockBorderColour }}
                            aria-label={walkDetour === null ? "Next Knot" : "Shelter"}
                        >
                            {nextBlock}
                            <div className="ariadne-display flex flex-wrap items-baseline gap-x-4 gap-y-1 text-3xl leading-none text-ariadne-data">
                                {bearingText.length > 0 && <span>{bearingText}</span>}
                                <span>{distanceTileText}</span>
                                {walkDetour === null && selection.knot !== null && (
                                    <span className="flex items-baseline gap-1">
                                        WALK {formatMinutesEstimate(selection.walkTimeSeconds)}
                                        <EstimateBadge />
                                    </span>
                                )}
                            </div>
                        </section>

                        <section className="grid min-w-0 gap-2 sm:grid-cols-[1fr_auto]" aria-label="Science budget and conditions">
                            <button
                                type="button"
                                className="ariadne-tap-hud flex min-w-0 items-center gap-2 border border-ariadne-border bg-ariadne-panel px-3 text-left hover:border-ariadne-accent"
                                aria-label="Open the science budget sheet"
                                onClick={onScienceBudgetClicked}
                            >
                                <span className="ariadne-display text-xl text-ariadne-muted">SCIENCE</span>
                                <span className="ariadne-display min-w-0 flex-1 truncate text-3xl leading-none text-ariadne-data">
                                    {budgetText}
                                </span>
                                {sciencePlan !== null && <StateBadge state={sciencePlan.feasibility} sizePx={16} />}
                            </button>
                            <button
                                type="button"
                                className="ariadne-tap-hud ariadne-display border border-ariadne-border px-4 text-2xl text-ariadne-text hover:border-ariadne-accent"
                                aria-label="Open the conditions sheet"
                                onClick={onConditionsClicked}
                            >
                                CONDITIONS
                            </button>
                        </section>

                        <section className="flex min-w-0 flex-col gap-2" aria-label="Alerts">
                            <div className="ariadne-display text-xl leading-none text-ariadne-muted">ALERTS</div>
                            <div aria-live="polite">{alertsContent}</div>
                        </section>
                    </div>
                </div>

                <button
                    type="button"
                    className="ariadne-tap-hud ariadne-display mt-auto w-full shrink-0 border border-ariadne-border text-2xl text-ariadne-text hover:border-ariadne-accent"
                    aria-label="Exit suit display"
                    onClick={onExitHudClicked}
                >
                    EXIT
                </button>
            </div>

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



// Kept exported for the shell; the SUIT tab in the tab bar is the normal way in now.
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
