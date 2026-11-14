// Planning Table science plan panel (D-027, contracts.md 4.6). Owner: Malissa, Stage 2.
// Pick and order Knots, tick science tasks, see leg times, plan time, science budget left, and GO / CAUTION / NO-GO.
// Every change to the stops or tasks recomputes the plan (debounced); the recompute can fail and is never assumed to work.

import { useEffect, useMemo, useRef, useState } from "react";

import type { Knot, ScienceTask } from "../../data/contracts";
import type { SciencePlan } from "../../state/scienceSlice";
import { useAriadneStore } from "../../state/store";
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
    formatTaskDuration,
    nearestNeighbourOrder,
    unreachableKnotNames,
} from "./planDisplay";
import type { FeasibilityShape } from "./planDisplay";



const RECOMPUTE_DEBOUNCE_MS = 150;

const BUTTON_CLASS = "min-h-12 rounded border border-ariadne-border px-3 text-sm hover:border-ariadne-accent disabled:opacity-40";
const EST_BADGE_CLASS = "rounded border border-ariadne-muted px-1 text-xs text-ariadne-muted";



function FeasibilityShapeIcon({ shape, colour }: { shape: FeasibilityShape; colour: string }) {
    if (shape === "filled_circle") {
        return (
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
                <circle cx="14" cy="14" r="11" fill={colour} />
            </svg>
        );
    }
    if (shape === "triangle") {
        return (
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
                <polygon points="14,3 26,25 2,25" fill={colour} />
            </svg>
        );
    }
    return (
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <polygon points="9,2 19,2 26,9 26,19 19,26 9,26 2,19 2,9" fill={colour} />
            <path d="M9 9 L19 19 M19 9 L9 19" stroke="#120c08" strokeWidth="3" />
        </svg>
    );
}


// Placeholder state colours until the Stage 3 palette. The shape and the text carry the meaning.
function feasibilityColour(label: string): string {
    if (label === "GO") {
        return "#6fbf73";
    }
    if (label === "CAUTION") {
        return "#f0c040";
    }
    return "#c0392b";
}



function TaskProvenance({ task }: { task: ScienceTask }) {
    return (
        <div className="mt-1 text-xs text-ariadne-muted">
            Source: {task.provenance.source_dataset}, product {task.provenance.product_id}
            {task.provenance.uncertainty !== undefined && <>, uncertainty {String(task.provenance.uncertainty)}</>}
            {task.equipment.length > 0 && <>. Equipment: {task.equipment.join(", ")}</>}. <span className={EST_BADGE_CLASS}>est.</span>
        </div>
    );
}


function TaskRow({ knotId, task, isChosen }: { knotId: string; task: ScienceTask; isChosen: boolean }) {
    const toggleSciencePlanTask = useAriadneStore((state) => state.toggleSciencePlanTask);
    const setTaskCompleted = useAriadneStore((state) => state.setTaskCompleted);
    const isCompleted = useAriadneStore((state) => state.completedTaskIds.includes(task.task_id));
    const [isExpanded, setIsExpanded] = useState(false);

    let includeClassName = "flex min-h-12 flex-1 items-center gap-2 rounded border px-2 text-left text-sm ";
    if (isChosen) {
        includeClassName += "border-ariadne-accent";
    } else {
        includeClassName += "border-ariadne-border opacity-70";
    }

    return (
        <div className="rounded">
            <div className="flex gap-1">
                <button
                    type="button"
                    className={includeClassName}
                    aria-pressed={isChosen}
                    onClick={() => toggleSciencePlanTask(knotId, task.task_id)}
                >
                    <span className="w-5 text-lg" aria-hidden="true">{isChosen ? "[x]" : "[ ]"}</span>
                    <span className="flex-1">
                        <span className="font-bold">{task.label}</span>{" "}
                        <span className="text-xs text-ariadne-muted">({task.task_type.replace(/_/g, " ")})</span>
                        <span className="block text-xs text-ariadne-muted">
                            {formatTaskDuration(task.duration_minutes)}, sample est. {task.sample_mass_kg.toFixed(1)} kg
                            {task.equipment.length > 0 && <>, {task.equipment.join(", ")}</>}
                        </span>
                    </span>
                </button>
                <button
                    type="button"
                    className={BUTTON_CLASS}
                    aria-pressed={isCompleted}
                    onClick={() => setTaskCompleted(task.task_id, !isCompleted)}
                >
                    {isCompleted ? "Done" : "Not done"}
                </button>
                <button type="button" className={BUTTON_CLASS} aria-expanded={isExpanded} onClick={() => setIsExpanded(!isExpanded)}>
                    Info
                </button>
            </div>
            {isExpanded && <TaskProvenance task={task} />}
        </div>
    );
}


function StopCard({ stopNumber, knot, chosenTaskIds, isFirst, isLast }: {
    stopNumber: number;
    knot: Knot;
    chosenTaskIds: string[];
    isFirst: boolean;
    isLast: boolean;
}) {
    const moveSciencePlanStop = useAriadneStore((state) => state.moveSciencePlanStop);
    const removeSciencePlanStop = useAriadneStore((state) => state.removeSciencePlanStop);

    return (
        <div className="flex flex-col gap-1 rounded border border-ariadne-border bg-ariadne-panel p-2">
            <div className="flex items-center gap-1">
                <span className="w-7 text-lg font-bold text-ariadne-accent">{stopNumber}.</span>
                <span className="flex-1 font-bold">{knot.name}</span>
                <button type="button" className={BUTTON_CLASS} disabled={isFirst} onClick={() => moveSciencePlanStop(knot.knot_id, "earlier")}>
                    Earlier
                </button>
                <button type="button" className={BUTTON_CLASS} disabled={isLast} onClick={() => moveSciencePlanStop(knot.knot_id, "later")}>
                    Later
                </button>
                <button type="button" className={BUTTON_CLASS} onClick={() => removeSciencePlanStop(knot.knot_id)}>
                    Remove
                </button>
            </div>
            {knot.science_tasks.length === 0 && <div className="text-xs text-ariadne-muted">No science tasks defined at this Knot.</div>}
            {knot.science_tasks.map((task) => (
                <TaskRow key={task.task_id} knotId={knot.knot_id} task={task} isChosen={chosenTaskIds.includes(task.task_id)} />
            ))}
        </div>
    );
}


function PlanResults({ plan, knots }: { plan: SciencePlan; knots: Knot[] }) {
    const parameters = useAriadneStore((state) => state.processedData?.meta.parameters);
    const toggleSciencePlanTask = useAriadneStore((state) => state.toggleSciencePlanTask);

    const knotNameById = useMemo(() => new Map(knots.map((knot) => [knot.knot_id, knot.name])), [knots]);
    const legRows = buildLegRows(plan);
    const display = feasibilityDisplay(plan.feasibility);
    const colour = feasibilityColour(display.label);
    const unreachableNames = unreachableKnotNames(plan, knotNameById);
    const suggestion = plan.drop_task_suggestion;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded border-2 p-2" style={{ borderColor: colour }}>
                <FeasibilityShapeIcon shape={display.shape} colour={colour} />
                <div>
                    <div className="text-lg font-bold" style={{ color: colour }}>{display.label}</div>
                    <div className="text-xs text-ariadne-muted">{display.explanation}</div>
                </div>
            </div>

            {unreachableNames.length > 0 && (
                <div className="text-ariadne-no-go">NO-GO: cannot reach {unreachableNames.join(", ")} on the walkable ground.</div>
            )}

            <div className="flex flex-col gap-1">
                {legRows.map((row, index) => (
                    <div key={`${row.leg_kind}-${index}`} className="rounded border border-ariadne-border px-2 py-1 text-sm">
                        <div className="font-bold">
                            {row.title}
                            {row.is_walk_back && <span className="text-xs text-ariadne-muted"> (dashed on the map)</span>}
                        </div>
                        <div>{row.time_text}, {row.distance_text}</div>
                        <div className="text-xs text-ariadne-muted">{row.load_text}</div>
                    </div>
                ))}
            </div>

            <div className="rounded border border-ariadne-border p-2 text-sm">
                <div>Task time: {formatMinutesEstimate(plan.total_task_time_s)}</div>
                <div>Walking: {formatMinutesEstimate(plan.total_walking_time_s)}</div>
                <div className="font-bold">Total plan time: {formatMinutesEstimate(plan.total_plan_time_s)}</div>
                <div>
                    Limit: {formatMinutesEstimate(plan.plan_time_limit_s)} ({formatPlanLimit(parameters)})
                </div>
                <div className="font-bold">Science budget: {formatBudgetLeft(plan.science_budget_left_s)}</div>
            </div>

            {suggestion !== null && (
                <button
                    type="button"
                    className="min-h-12 rounded border border-ariadne-accent px-3 text-left text-sm hover:bg-ariadne-accent hover:text-ariadne-background"
                    onClick={() => toggleSciencePlanTask(suggestion.knot_id, suggestion.task_id)}
                >
                    {formatDropSuggestion(suggestion, knotNameById)}. Tap to apply.
                </button>
            )}
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
    const stopCards = sciencePlanStops.map((stop, index) => {
        const knot = knots.find((candidate) => candidate.knot_id === stop.knot_id);
        if (knot === undefined) {
            return null;
        }
        return (
            <StopCard
                key={stop.knot_id}
                stopNumber={index + 1}
                knot={knot}
                chosenTaskIds={stop.chosen_task_ids}
                isFirst={index === 0}
                isLast={index === sciencePlanStops.length - 1}
            />
        );
    });

    return (
        <div className="flex flex-col gap-3">
            <div>
                <div className="mb-1 text-xs uppercase tracking-widest text-ariadne-muted">Add a Knot</div>
                <div className="grid grid-cols-2 gap-1">
                    {unplannedKnots.map((knot) => (
                        <button
                            key={knot.knot_id}
                            type="button"
                            className="min-h-12 rounded border border-ariadne-border bg-ariadne-panel px-2 text-left text-sm hover:border-ariadne-accent"
                            onClick={() => addSciencePlanStop(knot.knot_id, knot.science_tasks.map((task) => task.task_id))}
                        >
                            + {knot.name}
                        </button>
                    ))}
                </div>
                <div className="mt-1 flex gap-1">
                    {unplannedKnots.length > 1 && (
                        <button type="button" className={BUTTON_CLASS} onClick={planAllKnots}>
                            Plan all Knots (suggested order, nearest first)
                        </button>
                    )}
                    {sciencePlanStops.length > 0 && (
                        <button type="button" className={BUTTON_CLASS} onClick={() => clearSciencePlan()}>
                            Clear plan
                        </button>
                    )}
                </div>
            </div>

            {stopCards.length > 0 && (
                <div className="flex flex-col gap-1">
                    <div className="text-xs uppercase tracking-widest text-ariadne-muted">Stops, in order</div>
                    {stopCards}
                </div>
            )}

            <div className="rounded border border-ariadne-border p-2 text-xs text-ariadne-muted">
                <div className="text-sm text-ariadne-text">
                    Carried load now: {formatCarriedLoad(carriedNowKg, carriedNowFactor)}
                </div>
                "Done" simulates the task being done, so its sample mass is carried from now on. The real check-off happens at the Knot.
            </div>

            {sciencePlanStatus === "idle" && (
                <div className="text-ariadne-muted">Add a Knot to build a plan. It shows each walk, the total time and the science budget left.</div>
            )}
            {sciencePlanStatus === "computing" && <div className="text-ariadne-muted">Computing the plan...</div>}
            {sciencePlanStatus === "plan_failed" && <div className="text-ariadne-no-go">Plan failed: {sciencePlanError}</div>}
            {sciencePlan !== null && (sciencePlanStatus === "plan_ready" || sciencePlanStatus === "computing") && (
                <PlanResults plan={sciencePlan} knots={knots} />
            )}

            {sciencePlan !== null && (
                <div className="text-xs text-ariadne-muted">
                    Walking times: {returnFieldEntry !== undefined ? `${returnFieldEntry.source_dataset}, product ${returnFieldEntry.product_id}` : "walking model"}
                    , Tobler x suit factor. Load factor {formatLoadRule(loadParameters)}. Task times and sample masses are
                    estimates; tap Info on a task for its source. <span className={EST_BADGE_CLASS}>est.</span>
                </div>
            )}
        </div>
    );
}
