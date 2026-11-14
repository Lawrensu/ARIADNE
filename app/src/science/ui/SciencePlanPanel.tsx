// Planning science plan panel (D-027, contracts.md 4.6). Owner: Malissa, Stage 2; restyled for the mode sheets (D-031).
// A three-step flow: (1) PICK the Knots and their order, (2) CHECK times, science budget and GO / CAUTION / NO-GO,
// (3) GO: one big START WALK button. Every change to the stops or tasks recomputes the plan (debounced);
// the recompute can fail and is never assumed to work.
// Layout: width-fluid, no outer frame and no title (the sheet supplies both). Words are short;
// longer explanations sit behind a "?" toggle.

import { useEffect, useMemo, useRef, useState } from "react";

import type { Knot, ScienceTask } from "../../data/contracts";
import { formatDistance } from "../../planning/formatting";
import { selectMode } from "../../shell/modes";
import { startWalkNow } from "../../sim/walkDriver";
import type { SciencePlan, SciencePlanFeasibility, SciencePlanLeg } from "../../state/scienceSlice";
import { useAriadneStore } from "../../state/store";
import { EstimateBadge } from "../../theme/EstimateBadge";
import { InfoHeadingRow } from "../../theme/InfoToggle";
import { ProvenanceDialog } from "../../theme/ProvenancePopover";
import { StateBadge, StateShape } from "../../theme/StateBadge";
import { loadParametersFromMeta } from "../loadFactor";
import { recomputeSciencePlan } from "../sciencePlanService";
import {
    feasibilityDisplay,
    formatBudgetLeft,
    formatCarriedLoad,
    formatDropSuggestion,
    formatLoadRule,
    formatMinutesEstimate,
    formatPlanLimit,
    nearestNeighbourOrder,
    unreachableKnotNames,
} from "./planDisplay";
import {
    PLAN_STEPS,
    PLAN_STEP_LABELS,
    effectivePlanStep,
    initialPlanStep,
    startWalkState,
    stepAvailability,
} from "./planSteps";
import type { PlanStep } from "./planSteps";



const RECOMPUTE_DEBOUNCE_MS = 150;

const LABEL_CLASS = "text-xs uppercase tracking-widest text-ariadne-muted";

const MAIN_ACTION_CLASS =
    "ariadne-tap w-full border border-ariadne-accent bg-ariadne-accent px-3 text-base font-bold uppercase tracking-wider text-ariadne-background hover:bg-ariadne-text disabled:border-ariadne-border disabled:bg-transparent disabled:text-ariadne-muted disabled:opacity-60";

const OUTLINE_BUTTON_CLASS =
    "ariadne-tap border border-ariadne-border px-3 text-sm uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent disabled:opacity-40";

// Square icon button for reorder and remove: a 48 px target.
const ICON_BUTTON_CLASS =
    "ariadne-tap flex w-12 shrink-0 items-center justify-center border border-ariadne-border text-ariadne-muted hover:border-ariadne-accent hover:text-ariadne-text disabled:opacity-30";

const START_BUTTON_CLASS =
    "w-full min-h-16 border border-ariadne-accent bg-ariadne-accent px-3 text-lg font-bold uppercase tracking-widest text-ariadne-background hover:bg-ariadne-text disabled:border-ariadne-border disabled:bg-transparent disabled:text-ariadne-muted disabled:opacity-60";



type IconKind = "up" | "down" | "remove";


function IconGlyph({ kind }: { kind: IconKind }) {
    let path = "M6 15 L12 8 L18 15";
    if (kind === "down") {
        path = "M6 9 L12 16 L18 9";
    }
    if (kind === "remove") {
        path = "M6 6 L18 18 M18 6 L6 18";
    }
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d={path} stroke="currentColor" strokeWidth="2.4" fill="none" />
        </svg>
    );
}


// Square check box drawn as a shape, so the state never depends on colour alone.
function CheckBoxMark({ isChecked }: { isChecked: boolean }) {
    if (isChecked) {
        return (
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" fill="var(--ariadne-accent)" />
                <path d="M6 12 L10 16 L18 7" stroke="var(--ariadne-screen-black)" strokeWidth="2.6" fill="none" />
            </svg>
        );
    }
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" fill="none" stroke="var(--ariadne-muted-green)" strokeWidth="2" />
        </svg>
    );
}



// ---------------------------------------------------------------------------------------------
// Step header
// ---------------------------------------------------------------------------------------------

function StepHeader({ currentStep, stopCount, onSelect }: {
    currentStep: PlanStep;
    stopCount: number;
    onSelect: (step: PlanStep) => void;
}) {
    return (
        <div role="tablist" aria-label="Plan steps" className="grid grid-cols-3 gap-1">
            {PLAN_STEPS.map((step) => {
                const availability = stepAvailability(step, stopCount);
                const isCurrent = step === currentStep;
                let className = "ariadne-tap min-w-0 border px-1 text-sm font-bold uppercase tracking-wider ";
                if (isCurrent) {
                    className += "border-ariadne-accent bg-ariadne-accent text-ariadne-background";
                } else {
                    className += "border-ariadne-border text-ariadne-text hover:border-ariadne-accent disabled:opacity-40 disabled:hover:border-ariadne-border";
                }
                let title: string | undefined;
                if (availability.disabledReason !== null) {
                    title = availability.disabledReason;
                }
                return (
                    <button
                        key={step}
                        type="button"
                        role="tab"
                        aria-selected={isCurrent}
                        disabled={!availability.isEnabled}
                        title={title}
                        className={className}
                        onClick={() => onSelect(step)}
                    >
                        {PLAN_STEP_LABELS[step]}
                    </button>
                );
            })}
        </div>
    );
}



// ---------------------------------------------------------------------------------------------
// Step 1: PICK
// ---------------------------------------------------------------------------------------------

function PickStopRow({ stopNumber, knot, isFirst, isLast }: {
    stopNumber: number;
    knot: Knot;
    isFirst: boolean;
    isLast: boolean;
}) {
    const moveSciencePlanStop = useAriadneStore((state) => state.moveSciencePlanStop);
    const removeSciencePlanStop = useAriadneStore((state) => state.removeSciencePlanStop);

    return (
        <li className="flex items-center gap-1 border border-ariadne-border bg-ariadne-panel pl-2">
            <span className="w-6 shrink-0 text-base font-bold text-ariadne-accent">{stopNumber}</span>
            <span className="min-w-0 flex-1 break-words text-sm font-bold">{knot.name}</span>
            <button
                type="button"
                className={ICON_BUTTON_CLASS}
                aria-label={`Move ${knot.name} earlier`}
                disabled={isFirst}
                onClick={() => moveSciencePlanStop(knot.knot_id, "earlier")}
            >
                <IconGlyph kind="up" />
            </button>
            <button
                type="button"
                className={ICON_BUTTON_CLASS}
                aria-label={`Move ${knot.name} later`}
                disabled={isLast}
                onClick={() => moveSciencePlanStop(knot.knot_id, "later")}
            >
                <IconGlyph kind="down" />
            </button>
            <button
                type="button"
                className={ICON_BUTTON_CLASS}
                aria-label={`Remove ${knot.name} from the plan`}
                onClick={() => removeSciencePlanStop(knot.knot_id)}
            >
                <IconGlyph kind="remove" />
            </button>
        </li>
    );
}


function PickStep({ knots, onNext }: { knots: Knot[]; onNext: () => void }) {
    const stagingPoint = useAriadneStore((state) => state.processedData?.meta.staging_point);
    const sciencePlanStops = useAriadneStore((state) => state.sciencePlanStops);
    const addSciencePlanStop = useAriadneStore((state) => state.addSciencePlanStop);
    const clearSciencePlan = useAriadneStore((state) => state.clearSciencePlan);

    const plannedKnotIds = new Set(sciencePlanStops.map((stop) => stop.knot_id));
    const unplannedKnots = knots.filter((knot) => !plannedKnotIds.has(knot.knot_id));

    const addKnot = (knot: Knot) => {
        addSciencePlanStop(knot.knot_id, knot.science_tasks.map((task) => task.task_id));
    };

    const planAllKnots = () => {
        if (stagingPoint === undefined) {
            return;
        }
        const orderedIds = nearestNeighbourOrder(stagingPoint, unplannedKnots);
        for (const knotId of orderedIds) {
            const knot = knots.find((candidate) => candidate.knot_id === knotId);
            if (knot !== undefined) {
                addKnot(knot);
            }
        }
    };

    // Stops whose Knot is missing from the data are skipped (should not happen).
    const stopRows = sciencePlanStops.map((stop, index) => {
        const knot = knots.find((candidate) => candidate.knot_id === stop.knot_id);
        if (knot === undefined) {
            return null;
        }
        return (
            <PickStopRow
                key={stop.knot_id}
                stopNumber={index + 1}
                knot={knot}
                isFirst={index === 0}
                isLast={index === sciencePlanStops.length - 1}
            />
        );
    });

    let addLabel = "Add";
    if (sciencePlanStops.length === 0) {
        addLabel = "Or add one";
    }

    return (
        <div className="flex flex-col gap-3">
            {unplannedKnots.length > 0 && (
                <button type="button" className={MAIN_ACTION_CLASS} onClick={planAllKnots}>
                    Plan all {unplannedKnots.length} (nearest first)
                </button>
            )}

            {stopRows.length > 0 && <ol className="flex flex-col gap-1">{stopRows}</ol>}

            {unplannedKnots.length > 0 && (
                <div className="flex flex-col gap-1">
                    <span className={LABEL_CLASS}>{addLabel}</span>
                    <div className="flex flex-wrap gap-1">
                        {unplannedKnots.map((knot) => (
                            <button key={knot.knot_id} type="button" className={OUTLINE_BUTTON_CLASS} onClick={() => addKnot(knot)}>
                                + {knot.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="text-sm text-ariadne-muted">Tap a Knot on the map to add</div>

            <button type="button" className={MAIN_ACTION_CLASS} disabled={sciencePlanStops.length === 0} onClick={onNext}>
                Next: check
            </button>

            {sciencePlanStops.length > 0 && (
                <button type="button" className={OUTLINE_BUTTON_CLASS} onClick={() => clearSciencePlan()}>
                    Clear plan
                </button>
            )}
        </div>
    );
}



// ---------------------------------------------------------------------------------------------
// Step 2: CHECK
// ---------------------------------------------------------------------------------------------

function TaskRow({ knotId, task, isChosen }: { knotId: string; task: ScienceTask; isChosen: boolean }) {
    const toggleSciencePlanTask = useAriadneStore((state) => state.toggleSciencePlanTask);
    const [isSourceOpen, setIsSourceOpen] = useState(false);

    let labelClass = "min-w-0 flex-1 py-1 text-left text-sm";
    if (!isChosen) {
        labelClass += " opacity-60";
    }

    return (
        <li className="flex items-stretch gap-1 border-t border-ariadne-border">
            <button
                type="button"
                role="checkbox"
                aria-checked={isChosen}
                aria-label={`Include ${task.label} in the plan`}
                className="ariadne-tap flex w-12 shrink-0 items-center justify-center"
                onClick={() => toggleSciencePlanTask(knotId, task.task_id)}
            >
                <CheckBoxMark isChecked={isChosen} />
            </button>
            <div className={labelClass}>
                <span className="block break-words">{task.label}</span>
                <span className="block text-xs text-ariadne-muted">
                    {Math.round(task.duration_minutes)} min, {task.sample_mass_kg.toFixed(1)} kg
                    <EstimateBadge />
                </span>
            </div>
            <button
                type="button"
                className="ariadne-tap w-12 shrink-0 border-l border-ariadne-border text-xs uppercase tracking-wider text-ariadne-muted hover:text-ariadne-text"
                aria-label={`Source of ${task.label} estimate`}
                onClick={() => setIsSourceOpen(true)}
            >
                src
            </button>
            {isSourceOpen && (
                <ProvenanceDialog
                    title={task.label}
                    valueText={`${Math.round(task.duration_minutes)} min, ${task.sample_mass_kg.toFixed(1)} kg`}
                    provenance={task.provenance}
                    onClose={() => setIsSourceOpen(false)}
                />
            )}
        </li>
    );
}


// One compact leg row: from and to, time and distance, carried load and load factor.
function LegRow({ leg }: { leg: SciencePlanLeg }) {
    let walkBackSuffix = "";
    if (leg.leg_kind === "walk_back_to_rover") {
        walkBackSuffix = " (dashed)";
    }
    return (
        <div className="px-2 py-1 text-xs text-ariadne-muted">
            <span className="block break-words text-ariadne-text">
                {leg.from_label} to {leg.to_label}{walkBackSuffix}
            </span>
            <span className="block">
                <span className="text-ariadne-data">{formatMinutesEstimate(leg.walking_time_s)}</span>, {formatDistance(leg.horizontal_distance_m)}
            </span>
            <span className="block text-ariadne-dim">carrying {formatCarriedLoad(leg.carried_load_kg, leg.load_factor)}</span>
        </div>
    );
}


function CheckStopBlock({ stopNumber, knot, chosenTaskIds, leg }: {
    stopNumber: number;
    knot: Knot;
    chosenTaskIds: string[];
    leg: SciencePlanLeg | undefined;
}) {
    return (
        <li className="border border-ariadne-border bg-ariadne-panel">
            {leg !== undefined && <LegRow leg={leg} />}
            <div className="flex items-center gap-2 border-t border-ariadne-border px-2 py-2">
                <span className="w-6 shrink-0 text-base font-bold text-ariadne-accent">{stopNumber}</span>
                <span className="min-w-0 flex-1 break-words text-sm font-bold">{knot.name}</span>
            </div>
            {knot.science_tasks.length === 0 && (
                <div className="border-t border-ariadne-border px-2 py-2 text-xs text-ariadne-muted">No tasks.</div>
            )}
            {knot.science_tasks.length > 0 && (
                <ul>
                    {knot.science_tasks.map((task) => (
                        <TaskRow key={task.task_id} knotId={knot.knot_id} task={task} isChosen={chosenTaskIds.includes(task.task_id)} />
                    ))}
                </ul>
            )}
        </li>
    );
}


function PlanSummary({ plan, knotNameById }: { plan: SciencePlan; knotNameById: Map<string, string> }) {
    const toggleSciencePlanTask = useAriadneStore((state) => state.toggleSciencePlanTask);
    const unreachableNames = unreachableKnotNames(plan, knotNameById);
    const suggestion = plan.drop_task_suggestion;

    return (
        <div className="flex flex-col gap-2">
            <div className="border border-ariadne-border bg-ariadne-panel p-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className={LABEL_CLASS}>Total / limit</span>
                    <span className="text-base text-ariadne-data">
                        {formatMinutesEstimate(plan.total_plan_time_s)} / {formatMinutesEstimate(plan.plan_time_limit_s)}
                    </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className={LABEL_CLASS}>Science budget</span>
                    <span className="flex flex-wrap items-center gap-2">
                        <StateBadge state={plan.feasibility} />
                        <span className="text-base text-ariadne-data">{formatBudgetLeft(plan.science_budget_left_s)}</span>
                    </span>
                </div>
            </div>

            {unreachableNames.length > 0 && (
                <div className="flex items-center gap-2 border border-ariadne-no-go p-2 text-sm text-ariadne-no-go">
                    <StateShape state="no_go" />
                    <span>NO-GO: cannot reach {unreachableNames.join(", ")}.</span>
                </div>
            )}

            {suggestion !== null && (
                <div className="flex items-center gap-2 border border-ariadne-caution pl-2 text-sm text-ariadne-caution">
                    <StateShape state="caution" />
                    <span className="min-w-0 flex-1 break-words py-1">{formatDropSuggestion(suggestion, knotNameById)}</span>
                    <button
                        type="button"
                        className="ariadne-tap shrink-0 border-l border-ariadne-caution px-3 text-xs font-bold uppercase tracking-wider hover:bg-ariadne-caution hover:text-ariadne-background"
                        onClick={() => toggleSciencePlanTask(suggestion.knot_id, suggestion.task_id)}
                    >
                        Drop
                    </button>
                </div>
            )}
        </div>
    );
}


function CheckStep({ knots }: { knots: Knot[] }) {
    const processedData = useAriadneStore((state) => state.processedData);
    const sciencePlanStops = useAriadneStore((state) => state.sciencePlanStops);
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const sciencePlanStatus = useAriadneStore((state) => state.sciencePlanStatus);
    const sciencePlanError = useAriadneStore((state) => state.sciencePlanError);

    const knotNameById = useMemo(() => new Map(knots.map((knot) => [knot.knot_id, knot.name])), [knots]);

    if (processedData === null) {
        return null;
    }
    const parameters = processedData.meta.parameters;
    const loadParameters = loadParametersFromMeta(parameters);
    const returnFieldEntry = processedData.layerEntries["return_field"];

    let walkSourceText = "walking model";
    if (returnFieldEntry !== undefined) {
        walkSourceText = `${returnFieldEntry.source_dataset}, product ${returnFieldEntry.product_id}`;
    }

    // The leg that ends at each Knot, and the walk back (shown after the last stop).
    const legByKnotId = new Map<string, SciencePlanLeg>();
    let walkBackLeg: SciencePlanLeg | undefined;
    if (sciencePlan !== null) {
        for (const leg of sciencePlan.legs) {
            if (leg.to_knot_id !== null) {
                legByKnotId.set(leg.to_knot_id, leg);
            } else {
                walkBackLeg = leg;
            }
        }
    }

    const stopBlocks = sciencePlanStops.map((stop, index) => {
        const knot = knots.find((candidate) => candidate.knot_id === stop.knot_id);
        if (knot === undefined) {
            return null;
        }
        return (
            <CheckStopBlock
                key={stop.knot_id}
                stopNumber={index + 1}
                knot={knot}
                chosenTaskIds={stop.chosen_task_ids}
                leg={legByKnotId.get(stop.knot_id)}
            />
        );
    });

    let feasibilityExplanation = "";
    if (sciencePlan !== null) {
        const feasibility: SciencePlanFeasibility = sciencePlan.feasibility;
        feasibilityExplanation = feasibilityDisplay(feasibility).explanation;
    }

    return (
        <div className="flex flex-col gap-3">
            {sciencePlanStatus === "computing" && sciencePlan === null && (
                <div className="text-sm text-ariadne-muted">Computing...</div>
            )}
            {sciencePlanStatus === "plan_failed" && (
                <div className="flex items-center gap-2 text-sm text-ariadne-no-go">
                    <StateShape state="no_go" />
                    <span>Plan failed: {sciencePlanError}</span>
                </div>
            )}
            {sciencePlan !== null && <PlanSummary plan={sciencePlan} knotNameById={knotNameById} />}

            <div className="text-xs text-ariadne-muted">Tick the tasks to include</div>

            <ol className="flex flex-col gap-1">{stopBlocks}</ol>

            {walkBackLeg !== undefined && (
                <div className="border border-ariadne-border bg-ariadne-panel">
                    <LegRow leg={walkBackLeg} />
                </div>
            )}

            <InfoHeadingRow title="Basis" label="Plan basis">
                <span className="block py-1">
                    Walking times: {walkSourceText}, Tobler x suit factor. Load factor {formatLoadRule(loadParameters)}.
                </span>
                {sciencePlan !== null && (
                    <span className="block pb-1">
                        Tasks: {formatMinutesEstimate(sciencePlan.total_task_time_s)}. Walking:{" "}
                        {formatMinutesEstimate(sciencePlan.total_walking_time_s)}. Limit:{" "}
                        {formatMinutesEstimate(sciencePlan.plan_time_limit_s)} ({formatPlanLimit(parameters)}).{" "}
                        {feasibilityExplanation}
                    </span>
                )}
                <span className="block pb-1">
                    Task times and sample masses are estimates; "src" on a task shows its source. <EstimateBadge />
                </span>
            </InfoHeadingRow>
        </div>
    );
}



// ---------------------------------------------------------------------------------------------
// Step 3: GO
// ---------------------------------------------------------------------------------------------

function StartWalkBlock() {
    const sciencePlanStops = useAriadneStore((state) => state.sciencePlanStops);
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const sciencePlanStatus = useAriadneStore((state) => state.sciencePlanStatus);
    const walkStartedAtSimSeconds = useAriadneStore((state) => state.walkStartedAtSimSeconds);
    const setSimPlaying = useAriadneStore((state) => state.setSimPlaying);

    let feasibility: SciencePlanFeasibility | null = null;
    let unreachableKnotCount = 0;
    if (sciencePlan !== null) {
        feasibility = sciencePlan.feasibility;
        unreachableKnotCount = sciencePlan.unreachable_knot_ids.length;
    }
    const start = startWalkState({
        stopCount: sciencePlanStops.length,
        status: sciencePlanStatus,
        feasibility,
        unreachableKnotCount,
        isWalkRunning: walkStartedAtSimSeconds !== null,
    });

    const onStart = () => {
        startWalkNow();
        setSimPlaying(true);
        selectMode("map");
    };

    return (
        <div className="flex flex-col gap-1">
            <button type="button" className={START_BUTTON_CLASS} disabled={!start.isEnabled} onClick={onStart}>
                {start.label}
            </button>
            {start.reason !== null && (
                <div className="flex items-center gap-2 text-sm text-ariadne-muted">
                    <StateShape state="no_go" />
                    <span className="min-w-0 break-words">{start.reason}</span>
                </div>
            )}
            {start.note !== null && <div className="text-xs text-ariadne-muted">{start.note}</div>}
        </div>
    );
}



// ---------------------------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------------------------

export function SciencePlanPanel() {
    const processedData = useAriadneStore((state) => state.processedData);
    const sciencePlanStops = useAriadneStore((state) => state.sciencePlanStops);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const setSciencePlanStatus = useAriadneStore((state) => state.setSciencePlanStatus);

    const [chosenStep, setChosenStep] = useState<PlanStep>(() => {
        const state = useAriadneStore.getState();
        return initialPlanStep(state.sciencePlanStops.length, state.sciencePlan !== null);
    });

    // Recompute after every change to the stops or tasks, once the changes pause. Skip the first run with no stops.
    const isFirstRun = useRef(true);
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            if (sciencePlanStops.length === 0) {
                return;
            }
        }
        const timer = window.setTimeout(() => {
            recomputeSciencePlan().catch((error: unknown) => {
                let message = "The science plan could not be computed.";
                if (error instanceof Error) {
                    message = error.message;
                }
                setSciencePlanStatus("plan_failed", message);
            });
        }, RECOMPUTE_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [sciencePlanStops, completedTaskIds, setSciencePlanStatus]);

    if (processedData === null) {
        return null;
    }

    const knots = processedData.knots;
    const currentStep = effectivePlanStep(chosenStep, sciencePlanStops.length);

    return (
        <div className="flex flex-col gap-3">
            <StepHeader currentStep={currentStep} stopCount={sciencePlanStops.length} onSelect={setChosenStep} />

            {currentStep === "pick" && <PickStep knots={knots} onNext={() => setChosenStep("check")} />}

            {currentStep === "check" && (
                <>
                    <CheckStep knots={knots} />
                    <StartWalkBlock />
                </>
            )}

            {currentStep === "go" && <StartWalkBlock />}
        </div>
    );
}
