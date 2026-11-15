// Visor HUD overlay (owner: Lawrence, D-032): everything projected on the glass above the 3D world.
// Top: header, compass strip. Middle: alert banner (centre) and minimap (corner), the centre of view
// stays clear. Bottom: the next-step line, the current task with a big TASK DONE button at a Knot,
// and exactly three readings. All pieces read the store; the numbers come from hud/hudMath.ts.

import { useAriadneStore } from "../state/store";
import { useVisorCurrentTask, useVisorReadings } from "./useVisorState";
import type { VisorTarget } from "./useVisorState";
import { VisorAlert } from "./VisorAlert";
import { VisorCompass } from "./VisorCompass";
import { VisorHeader } from "./VisorHeader";
import { VisorMinimap } from "./VisorMinimap";
import { VisorReadings } from "./VisorReadings";
import { formatNextStepLine, formatTaskLine, relativeBearingWord } from "./visorMath";



export interface VisorHudProps {
    // Computed once by VisorApp and shared with the world markers.
    target: VisorTarget | null;
}



export function VisorHud({ target }: VisorHudProps) {
    const processedData = useAriadneStore((state) => state.processedData);
    const astronautHeadingDeg = useAriadneStore((state) => state.astronautHeadingDeg);
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    const setTaskCompleted = useAriadneStore((state) => state.setTaskCompleted);

    const currentTask = useVisorCurrentTask(target);
    const numbers = useVisorReadings(target);

    const sunAzimuthDeg = processedData === null ? null : processedData.meta.sun.sun_azimuth_deg;

    let nextStepText = "NO TARGET";
    let nextStepColour = "var(--ariadne-text)";
    let directionText = "";
    if (target !== null) {
        nextStepText = formatNextStepLine({
            kind: target.kind,
            label: target.label,
            distanceM: target.distanceM,
            walkSeconds: target.walkSeconds,
        });
        directionText = relativeBearingWord(target.bearingDeg, astronautHeadingDeg);
        if (target.kind === "shelter") {
            nextStepColour = "var(--ariadne-no-go)";
        }
    }

    return (
        <div className="visor-glass" aria-label="Visor display">
            <div className="flex flex-col gap-2">
                <VisorHeader />
                <VisorCompass headingDeg={astronautHeadingDeg} target={target} sunAzimuthDeg={sunAzimuthDeg} />
            </div>

            <div className="flex min-h-0 flex-1 items-start gap-2 pt-1">
                <div className="hidden flex-1 sm:block" />
                <div className="min-w-0 flex-1 sm:flex-[0_1_560px]">
                    <VisorAlert />
                </div>
                <div className="flex shrink-0 justify-end sm:flex-1">
                    <VisorMinimap target={target} />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2">
                    {currentTask !== null && (
                        <div className="visor-panel visor-hit flex flex-col gap-2 p-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="visor-label text-[18px]">AT {currentTask.knotName}</div>
                                <div className="visor-number text-[clamp(26px,3.4vw,36px)] text-ariadne-text">
                                    {formatTaskLine(currentTask.label)}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="visor-button sm:min-w-[220px]"
                                aria-label={`Mark task done: ${currentTask.label}`}
                                onClick={() => setTaskCompleted(currentTask.taskId, true)}
                            >
                                TASK DONE
                            </button>
                        </div>
                    )}

                    <div
                        className="visor-text flex min-w-0 flex-wrap items-baseline justify-center gap-x-3 text-center text-[clamp(16px,1.8vw,22px)] font-bold"
                        style={{ color: nextStepColour }}
                        aria-live="polite"
                    >
                        <span>{nextStepText}</span>
                        {directionText !== "" && <span className="visor-label text-[22px]">{directionText}</span>}
                    </div>
                </div>

                <VisorReadings numbers={numbers} target={target} simElapsedSeconds={simElapsedSeconds} />
            </div>
        </div>
    );
}
