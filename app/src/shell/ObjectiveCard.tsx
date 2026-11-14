// Objective card, top left over the map (owner: Lawrence, redesign D-031, visual_direction.md 6.2).
// One answer to "what am I doing now": the shelter while rerouted, else the next Knot of the walk
// with its tasks as a checklist, else the walk back to the rover, else "No walk planned" with a PLAN
// button. Distance and walk time are model values and carry "est.". On a phone (and next to an open
// sheet on desktop) it collapses to one line; tap to expand.

import { useMemo, useState } from "react";

import type { Knot, LocalPosition } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";
import { formatDistanceMetres, formatMinutesEstimate, selectNextKnot } from "../hud/hudMath";
import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { returnFieldSecondsAt } from "../science/sciencePlan";
import type { SciencePlan } from "../state/scienceSlice";
import { useAriadneStore } from "../state/store";
import type { WalkDetour, WalkPhase } from "../state/walkSlice";
import { selectMode } from "./modes";



// "shelter": rerouted to a shelter (or a Knot) after an alert. "knot": the next planned Knot.
// "return_to_rover": every planned task is done. "no_plan": nothing planned yet.
export type ObjectiveKind = "shelter" | "knot" | "return_to_rover" | "no_plan";


export interface ObjectiveTask {
    task_id: string;
    label: string;
    duration_s: number;
    is_done: boolean;
}


export interface ObjectiveView {
    objective_kind: ObjectiveKind;
    title: string;
    // For example "KNOT 2/5"; null when there is no step to count.
    step_text: string | null;
    distance_text: string;
    time_text: string;
    tasks: ObjectiveTask[];
}


interface ObjectiveInput {
    processedData: ProcessedData;
    position: LocalPosition;
    plan: SciencePlan | null;
    walkDetour: WalkDetour | null;
    walkPhase: WalkPhase;
    completedTaskIds: string[];
    simElapsedSeconds: number;
    loadFactorNow: number;
}



function pathLengthMetres(path: LocalPosition[]): number {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
        total += Math.hypot(path[i].x_m - path[i - 1].x_m, path[i].z_m - path[i - 1].z_m);
    }
    return total;
}


// Remaining distance and time on a detour, assuming an even pace along the routed path (est.).
function describeDetour(detour: WalkDetour, walkPhase: WalkPhase, simElapsedSeconds: number): ObjectiveView {
    let title = `Shelter: ${detour.target_label}`;
    if (detour.target_kind === "knot") {
        title = `Reroute: ${detour.target_label}`;
    }

    if (walkPhase === "sheltering" || walkPhase === "at_knot") {
        return { objective_kind: "shelter", title, step_text: "ARRIVED", distance_text: "0 m", time_text: "0 min", tasks: [] };
    }

    const elapsedOnDetour = simElapsedSeconds - detour.started_at_sim_seconds;
    const remainingSeconds = Math.max(0, detour.walking_time_s - Math.max(0, elapsedOnDetour));
    let remainingFraction = 0;
    if (detour.walking_time_s > 0) {
        remainingFraction = remainingSeconds / detour.walking_time_s;
    }
    const remainingMetres = pathLengthMetres(detour.path_positions) * remainingFraction;

    return {
        objective_kind: "shelter",
        title,
        step_text: "REROUTE",
        distance_text: formatDistanceMetres(remainingMetres),
        time_text: formatMinutesEstimate(remainingSeconds),
        tasks: [],
    };
}


function knotTasks(knot: Knot, chosenTaskIds: string[], completedTaskIds: string[]): ObjectiveTask[] {
    const tasks: ObjectiveTask[] = [];
    for (const taskId of chosenTaskIds) {
        const task = knot.science_tasks.find((candidate) => candidate.task_id === taskId);
        if (task === undefined) {
            continue;
        }
        tasks.push({
            task_id: task.task_id,
            label: task.label,
            duration_s: task.duration_minutes * 60,
            is_done: completedTaskIds.includes(task.task_id),
        });
    }
    return tasks;
}


export function describeObjective(input: ObjectiveInput): ObjectiveView {
    if (input.walkDetour !== null) {
        return describeDetour(input.walkDetour, input.walkPhase, input.simElapsedSeconds);
    }

    const plan = input.plan;
    if (plan === null) {
        return { objective_kind: "no_plan", title: "No walk planned", step_text: null, distance_text: "", time_text: "", tasks: [] };
    }

    const selection = selectNextKnot({
        knots: input.processedData.knots,
        position: input.position,
        sciencePlan: plan,
        completedTaskIds: input.completedTaskIds,
        parameters: input.processedData.meta.parameters,
        loadFactor: input.loadFactorNow,
    });

    if (selection.source === "science_plan" && selection.knot !== null) {
        const knot = selection.knot;
        const stopIndex = plan.stops.findIndex((stop) => stop.knot_id === knot.knot_id);
        let chosenTaskIds: string[] = [];
        if (stopIndex >= 0) {
            chosenTaskIds = plan.stops[stopIndex].chosen_task_ids;
        }
        return {
            objective_kind: "knot",
            title: knot.name,
            step_text: `KNOT ${stopIndex + 1}/${plan.stops.length}`,
            distance_text: formatDistanceMetres(selection.distanceM),
            time_text: formatMinutesEstimate(selection.walkTimeSeconds),
            tasks: knotTasks(knot, chosenTaskIds, input.completedTaskIds),
        };
    }

    // Every planned task is done: the objective is the rover. Walk back = return_field x load (est.).
    const staging = input.processedData.meta.staging_point;
    const walkBackSeconds =
        returnFieldSecondsAt(input.processedData.meta.grid, input.processedData.float32Layers.return_field, input.position) *
        input.loadFactorNow;
    const straightLineMetres = Math.hypot(staging.x_m - input.position.x_m, staging.z_m - input.position.z_m);
    return {
        objective_kind: "return_to_rover",
        title: "Back to rover",
        step_text: "TASKS DONE",
        distance_text: formatDistanceMetres(straightLineMetres),
        time_text: formatMinutesEstimate(walkBackSeconds),
        tasks: [],
    };
}



function CheckBox({ isChecked }: { isChecked: boolean }) {
    return (
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
            <rect x="1" y="1" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" />
            {isChecked && <path d="M5 11 L9 15 L17 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />}
        </svg>
    );
}



function TaskChecklist({ tasks }: { tasks: ObjectiveTask[] }) {
    const setTaskCompleted = useAriadneStore((state) => state.setTaskCompleted);

    if (tasks.length === 0) {
        return null;
    }

    return (
        <ul className="flex flex-col border-t border-ariadne-border" aria-label="Tasks">
            {tasks.map((task) => {
                let rowClass = "flex min-h-12 w-full items-center gap-2 px-2 text-left text-sm hover:bg-ariadne-panel-raised ";
                if (task.is_done) {
                    rowClass += "text-ariadne-dim";
                } else {
                    rowClass += "text-ariadne-text";
                }
                return (
                    <li key={task.task_id} className="border-b border-ariadne-border last:border-b-0">
                        <button
                            type="button"
                            role="checkbox"
                            aria-checked={task.is_done}
                            className={rowClass}
                            onClick={() => setTaskCompleted(task.task_id, !task.is_done)}
                        >
                            <span className="text-ariadne-accent">
                                <CheckBox isChecked={task.is_done} />
                            </span>
                            <span className={`min-w-0 flex-1 ${task.is_done ? "line-through" : ""}`}>{task.label}</span>
                            <span className="shrink-0 text-xs text-ariadne-dim">{formatMinutesEstimate(task.duration_s)}</span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}



function PlanButton() {
    return (
        <button
            type="button"
            className="ariadne-tap shrink-0 border border-ariadne-accent px-4 text-sm font-bold uppercase tracking-wider text-ariadne-accent hover:bg-ariadne-accent hover:text-ariadne-background"
            onClick={() => selectMode("plan")}
        >
            Plan
        </button>
    );
}



function useObjectiveView(): ObjectiveView | null {
    const processedData = useAriadneStore((state) => state.processedData);
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const walkPlanSnapshot = useAriadneStore((state) => state.walkPlanSnapshot);
    const walkDetour = useAriadneStore((state) => state.walkDetour);
    const walkPhase = useAriadneStore((state) => state.walkPhase);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    // Only a detour needs the clock (time left to the shelter); elsewhere the view changes with the
    // position and the tasks, so the card does not re-render on every clock tick.
    const detourClock = useAriadneStore((state) => {
        if (state.walkDetour === null) {
            return 0;
        }
        return Math.floor(state.simElapsedSeconds);
    });

    const parameters = processedData?.meta.parameters;
    const loadParameters = useMemo(() => loadParametersFromMeta(parameters), [parameters]);
    const loadFactorNow = useMemo(() => {
        if (processedData === null) {
            return Number.NaN;
        }
        return loadFactor(carriedLoadKg(processedData.knots, completedTaskIds, loadParameters), loadParameters);
    }, [processedData, completedTaskIds, loadParameters]);

    // The walk follows the plan frozen at its start; before the walk, the current plan.
    const plan = walkPlanSnapshot ?? sciencePlan;

    return useMemo(() => {
        if (processedData === null) {
            return null;
        }
        return describeObjective({
            processedData,
            position: astronautPosition ?? processedData.meta.staging_point,
            plan,
            walkDetour,
            walkPhase,
            completedTaskIds,
            simElapsedSeconds: detourClock,
            loadFactorNow,
        });
    }, [processedData, astronautPosition, plan, walkDetour, walkPhase, completedTaskIds, detourClock, loadFactorNow]);
}



export interface ObjectiveCardProps {
    // True on a phone and next to an open sheet on desktop: one line, tap to expand.
    isCollapsible: boolean;
}



export function ObjectiveCard({ isCollapsible }: ObjectiveCardProps) {
    const view = useObjectiveView();
    const [isExpanded, setExpanded] = useState(false);

    if (view === null) {
        return null;
    }

    const isNoPlan = view.objective_kind === "no_plan";
    let titleClass = "ariadne-display min-w-0 truncate text-2xl leading-none ";
    if (view.objective_kind === "shelter") {
        titleClass += "text-ariadne-caution";
    } else {
        titleClass += "text-ariadne-data";
    }

    const distanceLine = (
        <span className="whitespace-nowrap text-sm tabular-nums text-ariadne-text">
            {view.distance_text} · {view.time_text} walk <span className="text-xs text-ariadne-dim">est.</span>
        </span>
    );

    const isShowingFull = !isCollapsible || isExpanded;

    if (!isShowingFull) {
        return (
            <section className="ariadne-bracketed flex min-h-12 items-stretch border border-ariadne-border bg-ariadne-overlay" aria-label="Objective">
                <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 text-left"
                    aria-expanded={false}
                    onClick={() => setExpanded(true)}
                >
                    <span className="shrink-0 text-xs uppercase tracking-widest text-ariadne-accent">Objective</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ariadne-data">{view.title}</span>
                    {!isNoPlan && <span className="shrink-0 text-xs tabular-nums text-ariadne-muted">{view.distance_text}</span>}
                    <span className="shrink-0 text-ariadne-accent" aria-hidden="true">
                        ▾
                    </span>
                </button>
                {isNoPlan && <PlanButton />}
            </section>
        );
    }

    return (
        <section className="ariadne-bracketed flex flex-col border border-ariadne-border bg-ariadne-overlay" aria-label="Objective">
            <div className="flex min-h-12 items-center justify-between gap-2 px-2">
                <span className="text-xs uppercase tracking-widest text-ariadne-accent">Objective</span>
                <span className="flex items-center gap-1">
                    {view.step_text !== null && <span className="text-xs tracking-wider text-ariadne-muted">{view.step_text}</span>}
                    {isCollapsible && (
                        <button
                            type="button"
                            className="ariadne-tap min-w-12 text-ariadne-accent"
                            aria-expanded={true}
                            aria-label="Collapse objective"
                            onClick={() => setExpanded(false)}
                        >
                            ▴
                        </button>
                    )}
                </span>
            </div>
            <div className="flex flex-col gap-1 px-2 pb-2">
                <div className={titleClass}>{view.title}</div>
                {isNoPlan ? (
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-ariadne-muted">Pick Knots in PLAN.</span>
                        <PlanButton />
                    </div>
                ) : (
                    distanceLine
                )}
            </div>
            <TaskChecklist tasks={view.tasks} />
        </section>
    );
}
