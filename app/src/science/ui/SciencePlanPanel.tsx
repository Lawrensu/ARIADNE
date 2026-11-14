// Planning science plan panel (D-027, contracts.md 4.6). Owner: Malissa, Stage 2; restyled for the mode sheets (D-031).
// Pick and order Knots, tick science tasks, see leg times, plan time, science budget left, and GO / CAUTION / NO-GO.
// Every change to the stops or tasks recomputes the plan (debounced); the recompute can fail and is never assumed to work.
// Layout: width-fluid, no outer frame and no title (the sheet supplies both). Words are short;
// longer explanations sit behind a "?" toggle.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { Knot, ScienceTask } from "../../data/contracts";
import type { SciencePlan } from "../../state/scienceSlice";
import { useAriadneStore } from "../../state/store";
import { EstimateBadge } from "../../theme/EstimateBadge";
import { ProvenanceDialog } from "../../theme/ProvenancePopover";
import { StateBadge, StateShape } from "../../theme/StateBadge";
import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../loadFactor";
import { recomputeSciencePlan } from "../sciencePlanService";
import {
    buildLegRows,
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



const RECOMPUTE_DEBOUNCE_MS = 150;

const LABEL_CLASS = "text-xs uppercase tracking-widest text-ariadne-muted";

const MAIN_ACTION_CLASS =
    "ariadne-tap w-full border border-ariadne-accent bg-ariadne-accent px-3 text-base font-bold uppercase tracking-wider text-ariadne-background hover:bg-ariadne-text disabled:opacity-40";

const OUTLINE_BUTTON_CLASS =
    "ariadne-tap border border-ariadne-border px-3 text-sm uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent disabled:opacity-40";

// Icon-like text buttons for reorder and remove: small text, still a 48 px target.
const SMALL_BUTTON_CLASS =
    "ariadne-tap min-w-12 border border-ariadne-border px-1 text-xs uppercase tracking-wider text-ariadne-muted hover:border-ariadne-accent hover:text-ariadne-text disabled:opacity-30";



// A heading row with a small "?" that opens a longer explanation underneath.
function HelpRow({ title, helpLabel, children }: { title: string; helpLabel: string; children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div>
            <div className="flex items-center justify-between gap-2">
                <span className={LABEL_CLASS}>{title}</span>
                <button
                    type="button"
                    className="ariadne-tap min-w-12 border border-ariadne-border text-sm text-ariadne-muted hover:border-ariadne-accent"
                    aria-label={`${helpLabel}: more info`}
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    ?
                </button>
            </div>
            {isOpen && <div className="border-l border-ariadne-border pl-2 text-xs text-ariadne-muted">{children}</div>}
        </div>
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



function TaskRow({ knotId, task, isChosen }: { knotId: string; task: ScienceTask; isChosen: boolean }) {
    const toggleSciencePlanTask = useAriadneStore((state) => state.toggleSciencePlanTask);
    const setTaskCompleted = useAriadneStore((state) => state.setTaskCompleted);
    const isCompleted = useAriadneStore((state) => state.completedTaskIds.includes(task.task_id));
    const [isSourceOpen, setIsSourceOpen] = useState(false);

    let labelClass = "min-w-0 flex-1 py-1 text-left text-sm";
    if (!isChosen) {
        labelClass += " opacity-60";
    }

    let doneClass = "ariadne-tap min-w-12 border px-1 text-xs uppercase tracking-wider ";
    if (isCompleted) {
        doneClass += "border-ariadne-accent bg-ariadne-accent text-ariadne-background";
    } else {
        doneClass += "border-ariadne-border text-ariadne-muted hover:border-ariadne-accent";
    }

    return (
        <li className="flex items-stretch gap-1 border-t border-ariadne-border">
            <button
                type="button"
                role="checkbox"
                aria-checked={isChosen}
                aria-label={`Include ${task.label} in the plan`}
                className="ariadne-tap flex min-w-12 items-center justify-center"
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
                className={doneClass}
                aria-pressed={isCompleted}
                aria-label={`${task.label}: mark done (simulated)`}
                onClick={() => setTaskCompleted(task.task_id, !isCompleted)}
            >
                done
            </button>
            <button
                type="button"
                className={SMALL_BUTTON_CLASS}
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


function StopBlock({ stopNumber, knot, chosenTaskIds, isFirst, isLast }: {
    stopNumber: number;
    knot: Knot;
    chosenTaskIds: string[];
    isFirst: boolean;
    isLast: boolean;
}) {
    const moveSciencePlanStop = useAriadneStore((state) => state.moveSciencePlanStop);
    const removeSciencePlanStop = useAriadneStore((state) => state.removeSciencePlanStop);

    return (
        <li className="border border-ariadne-border bg-ariadne-panel">
            <div className="flex items-center gap-1 pl-2">
                <span className="w-6 shrink-0 text-base font-bold text-ariadne-accent">{stopNumber}</span>
                <span className="min-w-0 flex-1 break-words text-sm font-bold">{knot.name}</span>
                <button
                    type="button"
                    className={SMALL_BUTTON_CLASS}
                    aria-label={`Move ${knot.name} earlier`}
                    disabled={isFirst}
                    onClick={() => moveSciencePlanStop(knot.knot_id, "earlier")}
                >
                    up
                </button>
                <button
                    type="button"
                    className={SMALL_BUTTON_CLASS}
                    aria-label={`Move ${knot.name} later`}
                    disabled={isLast}
                    onClick={() => moveSciencePlanStop(knot.knot_id, "later")}
                >
                    down
                </button>
                <button
                    type="button"
                    className={SMALL_BUTTON_CLASS}
                    aria-label={`Remove ${knot.name} from the plan`}
                    onClick={() => removeSciencePlanStop(knot.knot_id)}
                >
                    x
                </button>
            </div>
            {knot.science_tasks.length === 0 && <div className="border-t border-ariadne-border px-2 py-2 text-xs text-ariadne-muted">No tasks.</div>}
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


function PlanResults({ plan, knots }: { plan: SciencePlan; knots: Knot[] }) {
    const parameters = useAriadneStore((state) => state.processedData?.meta.parameters);
    const toggleSciencePlanTask = useAriadneStore((state) => state.toggleSciencePlanTask);

    const knotNameById = useMemo(() => new Map(knots.map((knot) => [knot.knot_id, knot.name])), [knots]);
    const legRows = buildLegRows(plan);
    const display = feasibilityDisplay(plan.feasibility);
    const unreachableNames = unreachableKnotNames(plan, knotNameById);
    const suggestion = plan.drop_task_suggestion;

    return (
        <div className="flex flex-col gap-2">
            {unreachableNames.length > 0 && (
                <div className="flex items-center gap-2 border border-ariadne-no-go p-2 text-sm text-ariadne-no-go">
                    <StateShape state="no_go" />
                    <span>NO-GO: cannot reach {unreachableNames.join(", ")}.</span>
                </div>
            )}

            <div className="border border-ariadne-border bg-ariadne-panel p-2">
                <div className="flex items-baseline justify-between gap-2">
                    <span className={LABEL_CLASS}>Total</span>
                    <span className="text-base text-ariadne-data">{formatMinutesEstimate(plan.total_plan_time_s)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span className={LABEL_CLASS}>Science budget</span>
                    <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base text-ariadne-data">{formatBudgetLeft(plan.science_budget_left_s)}</span>
                        <StateBadge state={plan.feasibility} />
                    </span>
                </div>
            </div>

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

            <HelpRow title="Walks and basis" helpLabel="Walks and basis">
                <ul className="py-1">
                    {legRows.map((row, index) => (
                        <li key={`${row.leg_kind}-${index}`} className="py-1">
                            <span className="block text-ariadne-text">
                                {row.title}
                                {row.is_walk_back && " (dashed)"}
                            </span>
                            <span className="block">{row.time_text}, {row.distance_text}</span>
                            <span className="block text-ariadne-dim">{row.load_text}</span>
                        </li>
                    ))}
                </ul>
                <div className="pb-1">
                    <span className="block">Tasks: {formatMinutesEstimate(plan.total_task_time_s)}</span>
                    <span className="block">Walking: {formatMinutesEstimate(plan.total_walking_time_s)}</span>
                    <span className="block">
                        Limit: {formatMinutesEstimate(plan.plan_time_limit_s)} ({formatPlanLimit(parameters)})
                    </span>
                    <span className="block">{display.explanation}</span>
                </div>
            </HelpRow>
        </div>
    );
}



export function SciencePlanPanel() {
    const processedData = useAriadneStore((state) => state.processedData);
    const sciencePlanStops = useAriadneStore((state) => state.sciencePlanStops);
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const sciencePlanStatus = useAriadneStore((state) => state.sciencePlanStatus);
    const sciencePlanError = useAriadneStore((state) => state.sciencePlanError);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const addSciencePlanStop = useAriadneStore((state) => state.addSciencePlanStop);
    const clearSciencePlan = useAriadneStore((state) => state.clearSciencePlan);
    const setSciencePlanStatus = useAriadneStore((state) => state.setSciencePlanStatus);

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
    const loadParameters = loadParametersFromMeta(processedData.meta.parameters);
    const carriedNowKg = carriedLoadKg(knots, completedTaskIds, loadParameters);
    const carriedNowFactor = loadFactor(carriedNowKg, loadParameters);
    const returnFieldEntry = processedData.layerEntries["return_field"];

    const plannedKnotIds = new Set(sciencePlanStops.map((stop) => stop.knot_id));
    const unplannedKnots = knots.filter((knot) => !plannedKnotIds.has(knot.knot_id));

    const planAllKnots = () => {
        const orderedIds = nearestNeighbourOrder(processedData.meta.staging_point, unplannedKnots);
        for (const knotId of orderedIds) {
            const knot = knots.find((candidate) => candidate.knot_id === knotId);
            if (knot !== undefined) {
                addSciencePlanStop(knot.knot_id, knot.science_tasks.map((task) => task.task_id));
            }
        }
    };

    // Stops whose Knot is missing from the data are skipped (should not happen).
    const stopBlocks = sciencePlanStops.map((stop, index) => {
        const knot = knots.find((candidate) => candidate.knot_id === stop.knot_id);
        if (knot === undefined) {
            return null;
        }
        return (
            <StopBlock
                key={stop.knot_id}
                stopNumber={index + 1}
                knot={knot}
                chosenTaskIds={stop.chosen_task_ids}
                isFirst={index === 0}
                isLast={index === sciencePlanStops.length - 1}
            />
        );
    });

    let walkSourceText = "walking model";
    if (returnFieldEntry !== undefined) {
        walkSourceText = `${returnFieldEntry.source_dataset}, product ${returnFieldEntry.product_id}`;
    }

    return (
        <div className="flex flex-col gap-3">
            {unplannedKnots.length > 0 && (
                <button type="button" className={MAIN_ACTION_CLASS} onClick={planAllKnots}>
                    Plan all Knots
                </button>
            )}

            {stopBlocks.length > 0 && <ol className="flex flex-col gap-1">{stopBlocks}</ol>}

            {sciencePlanStops.length > 0 && unplannedKnots.length > 0 && (
                <div className="flex flex-col gap-1">
                    <span className={LABEL_CLASS}>Add</span>
                    <div className="flex flex-wrap gap-1">
                        {unplannedKnots.map((knot) => (
                            <button
                                key={knot.knot_id}
                                type="button"
                                className={OUTLINE_BUTTON_CLASS}
                                onClick={() => addSciencePlanStop(knot.knot_id, knot.science_tasks.map((task) => task.task_id))}
                            >
                                + {knot.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {sciencePlanStatus === "idle" && sciencePlanStops.length === 0 && (
                <div className="text-sm text-ariadne-muted">No stops yet.</div>
            )}
            {sciencePlanStatus === "computing" && <div className="text-sm text-ariadne-muted">Computing...</div>}
            {sciencePlanStatus === "plan_failed" && (
                <div className="flex items-center gap-2 text-sm text-ariadne-no-go">
                    <StateShape state="no_go" />
                    <span>Plan failed: {sciencePlanError}</span>
                </div>
            )}
            {sciencePlan !== null && (sciencePlanStatus === "plan_ready" || sciencePlanStatus === "computing") && (
                <PlanResults plan={sciencePlan} knots={knots} />
            )}

            <HelpRow title="Load and sources" helpLabel="Load and sources">
                <span className="block py-1 text-ariadne-text">Carried now: {formatCarriedLoad(carriedNowKg, carriedNowFactor)}</span>
                <span className="block pb-1">
                    "done" simulates a finished task: its sample mass is carried from now on. The real check-off happens at the Knot.
                </span>
                <span className="block pb-1">
                    Walking times: {walkSourceText}, Tobler x suit factor. Load factor {formatLoadRule(loadParameters)}. Task times
                    and sample masses are estimates; "src" on a task shows its source. <EstimateBadge />
                </span>
            </HelpRow>

            {sciencePlanStops.length > 0 && (
                <button type="button" className={OUTLINE_BUTTON_CLASS} onClick={() => clearSciencePlan()}>
                    Clear plan
                </button>
            )}
        </div>
    );
}
