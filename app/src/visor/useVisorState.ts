// Visor state hooks (owner: Lawrence, D-032). They only READ the store and call the shared helpers
// in hud/hudMath.ts, so every number matches the tablet Suit HUD. Nothing here changes routing,
// the Thread, the plan or the walk.

import { useMemo } from "react";

import type { Knot, LocalPosition, ScienceTask } from "../data/contracts";
import {
    bearingDegrees,
    computeHudNumbers,
    emptyHudNumbers,
    remainingDetourWalkSeconds,
    selectNextKnot,
} from "../hud/hudMath";
import type { HudNumbers } from "../hud/hudMath";
import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { computeConsumablesState } from "../sim/clock";
import { useAriadneStore } from "../state/store";
import { computeThreadInfo } from "../thread/threadInfo";
import type { VisorTargetKind } from "./visorMath";



const SIM_MINUTE_SECONDS = 60;



export interface VisorTarget {
    kind: VisorTargetKind;
    // "knot_id" or the shelter target id, for matching markers.
    id: string;
    label: string;
    position: LocalPosition;
    distanceM: number;
    // Walk time in seconds, est. (plan leg, shelter countdown or straight-line model).
    walkSeconds: number;
    bearingDeg: number;
}


export interface VisorTask {
    taskId: string;
    label: string;
    knotName: string;
}



// The load factor now (contracts.md 4.6): tool kit plus the samples already taken.
export function useCurrentLoadFactor(): number {
    const processedData = useAriadneStore((state) => state.processedData);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    return useMemo(() => {
        if (processedData === null) {
            return 1;
        }
        const parameters = loadParametersFromMeta(processedData.meta.parameters);
        return loadFactor(carriedLoadKg(processedData.knots, completedTaskIds, parameters), parameters);
    }, [processedData, completedTaskIds]);
}


// The place the astronaut walks to now: the shelter while rerouted (walkDetour is set), else the
// next Knot (first plan stop with open tasks, else the nearest Knot; hud/hudMath.ts selectNextKnot).
// Null until the data is loaded or when there is no Knot.
export function useVisorTarget(): VisorTarget | null {
    const processedData = useAriadneStore((state) => state.processedData);
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const walkDetour = useAriadneStore((state) => state.walkDetour);
    const simSecond = useAriadneStore((state) => Math.floor(state.simElapsedSeconds));
    const loadFactorNow = useCurrentLoadFactor();

    return useMemo(() => {
        if (processedData === null) {
            return null;
        }
        const position = astronautPosition ?? processedData.meta.staging_point;

        if (walkDetour !== null && walkDetour.path_positions.length > 0) {
            const shelterPosition = walkDetour.path_positions[walkDetour.path_positions.length - 1];
            return {
                kind: "shelter",
                id: walkDetour.target_id,
                label: walkDetour.target_label,
                position: shelterPosition,
                distanceM: Math.hypot(shelterPosition.x_m - position.x_m, shelterPosition.z_m - position.z_m),
                walkSeconds: remainingDetourWalkSeconds(walkDetour, simSecond),
                bearingDeg: bearingDegrees(position.x_m, position.z_m, shelterPosition.x_m, shelterPosition.z_m),
            };
        }

        const selection = selectNextKnot({
            knots: processedData.knots,
            position,
            sciencePlan,
            completedTaskIds,
            parameters: processedData.meta.parameters,
            loadFactor: loadFactorNow,
        });
        if (selection.knot === null) {
            return null;
        }
        return {
            kind: "knot",
            id: selection.knot.knot_id,
            label: selection.knot.name,
            position: { x_m: selection.knot.x_m, z_m: selection.knot.z_m },
            distanceM: selection.distanceM,
            walkSeconds: selection.walkTimeSeconds,
            bearingDeg: selection.bearingDeg,
        };
    }, [processedData, astronautPosition, sciencePlan, completedTaskIds, walkDetour, simSecond, loadFactorNow]);
}


// The task to do right now: only while the astronaut is at a Knot (walkPhase "at_knot", no detour).
// It is the first chosen task of that Knot's plan stop that is not checked off yet.
export function useVisorCurrentTask(target: VisorTarget | null): VisorTask | null {
    const processedData = useAriadneStore((state) => state.processedData);
    const walkPhase = useAriadneStore((state) => state.walkPhase);
    const walkDetour = useAriadneStore((state) => state.walkDetour);
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const walkPlanSnapshot = useAriadneStore((state) => state.walkPlanSnapshot);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);

    return useMemo(() => {
        if (processedData === null || target === null || target.kind !== "knot") {
            return null;
        }
        if (walkPhase !== "at_knot" || walkDetour !== null) {
            return null;
        }
        const plan = walkPlanSnapshot ?? sciencePlan;
        const knot: Knot | undefined = processedData.knots.find((candidate) => candidate.knot_id === target.id);
        if (plan === null || knot === undefined) {
            return null;
        }
        const stop = plan.stops.find((candidate) => candidate.knot_id === knot.knot_id);
        if (stop === undefined) {
            return null;
        }
        for (const taskId of stop.chosen_task_ids) {
            if (completedTaskIds.includes(taskId)) {
                continue;
            }
            const task: ScienceTask | undefined = knot.science_tasks.find((candidate) => candidate.task_id === taskId);
            if (task !== undefined) {
                return { taskId: task.task_id, label: task.label, knotName: knot.name };
            }
        }
        return null;
    }, [processedData, target, walkPhase, walkDetour, sciencePlan, walkPlanSnapshot, completedTaskIds]);
}


// The three big readings (distance, Thread margin, O2) from the shared HUD maths. The Thread time
// left is refreshed once per simulated minute, as in the Suit HUD.
export function useVisorReadings(target: VisorTarget | null): HudNumbers {
    const processedData = useAriadneStore((state) => state.processedData);
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    const loadFactorNow = useCurrentLoadFactor();
    const simMinuteIndex = Math.floor(simElapsedSeconds / SIM_MINUTE_SECONDS);

    const threadInfo = useMemo(() => {
        if (processedData === null) {
            return null;
        }
        return computeThreadInfo(processedData, simMinuteIndex * SIM_MINUTE_SECONDS, completedTaskIds);
    }, [processedData, simMinuteIndex, completedTaskIds]);

    const consumables = useMemo(
        () => computeConsumablesState(simElapsedSeconds, processedData?.meta.parameters),
        [simElapsedSeconds, processedData],
    );

    return useMemo(() => {
        if (processedData === null) {
            return emptyHudNumbers();
        }
        const position = astronautPosition ?? processedData.meta.staging_point;
        let timeLeftSeconds = consumables.planned_time_left_s;
        if (threadInfo !== null) {
            timeLeftSeconds = threadInfo.time_left_s;
        }
        const numbers = computeHudNumbers({
            grid: processedData.meta.grid,
            returnField: processedData.float32Layers.return_field,
            position,
            timeLeftSeconds,
            loadFactor: loadFactorNow,
            o2RemainingSeconds: consumables.suit_remaining_s,
            nextKnotDistanceM: target === null ? Number.NaN : target.distanceM,
            nextKnotWalkTimeSeconds: target === null ? Number.NaN : target.walkSeconds,
        });
        // A shelter walk always has a distance, so its state is "go" (as in the Suit HUD).
        if (target !== null && target.kind === "shelter") {
            return { ...numbers, distanceState: "go" };
        }
        return numbers;
    }, [processedData, astronautPosition, threadInfo, consumables, loadFactorNow, target]);
}
