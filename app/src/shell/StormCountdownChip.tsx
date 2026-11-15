// Storm countdown chip for the tablet status bar (D-033). Shows nothing until a space weather watch
// is on; then "STORM IN 14 MIN est." in caution (triangle), and "STORM ACTIVE" in no-go (octagon)
// once the storm has started. State is colour plus shape plus word. On a phone the text is the short
// "STORM 14m" and wraps onto two lines so the Thread reading keeps its room on 375 px.
//
// useStormCountdown() is the one place that turns the store into a StormCountdown; the objective
// card and the visor use it too.

import { useMemo } from "react";

import { SOLAR_STORM_SCENARIO, stormCountdownAt } from "../sim/scenarioEngine";
import type { StormCountdown } from "../sim/scenarioEngine";
import { useAriadneStore } from "../state/store";
import { hazardStateColour, StateShape } from "../theme/StateBadge";
import { formatStormCountdownShort, formatStormCountdownText, stormCountdownState } from "./stormCountdownText";



// Whole simulated seconds are enough: the countdown is shown in minutes.
export function useStormCountdown(): StormCountdown {
    const wholeSeconds = useAriadneStore((state) => Math.floor(state.simElapsedSeconds));
    const isScenarioRunning = useAriadneStore((state) => state.scenarioStatus === "running");

    return useMemo(
        () => stormCountdownAt(SOLAR_STORM_SCENARIO, wholeSeconds, isScenarioRunning),
        [wholeSeconds, isScenarioRunning],
    );
}



export function StormCountdownChip() {
    const countdown = useStormCountdown();
    const state = stormCountdownState(countdown);
    const fullText = formatStormCountdownText(countdown);
    const shortText = formatStormCountdownShort(countdown);
    if (state === null || fullText === null || shortText === null) {
        return null;
    }

    const colour = hazardStateColour(state);
    return (
        <div
            className="flex min-w-0 shrink-0 items-center gap-1 border-r border-ariadne-border px-1.5 sm:px-2 lg:px-3"
            style={{ color: colour }}
            role="group"
            aria-label={fullText}
            title="Space weather forecast, est."
        >
            <StateShape state={state} sizePx={14} />
            <span className="max-w-[3.6rem] text-center text-xs font-bold leading-tight sm:hidden">{shortText}</span>
            <span className="hidden whitespace-nowrap text-xs font-bold sm:inline lg:text-sm">{fullText}</span>
        </div>
    );
}
