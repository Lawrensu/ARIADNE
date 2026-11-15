// Visor storm countdown (D-033): one short, big line under the compass. Caution (triangle) during the
// space weather watch, "STORM IN 14 MIN est."; no-go (octagon, pulsing) once the storm is active,
// "STORM ACTIVE". Nothing before the watch. The watch also arrives as a normal alert banner
// (VisorAlert); this line stays after the banner is dismissed.

import { useStormCountdown } from "../shell/StormCountdownChip";
import { formatStormCountdownText, stormCountdownState } from "../shell/stormCountdownText";
import { hazardStateColour, StateShape } from "../theme/StateBadge";



export function VisorStormCountdown() {
    const countdown = useStormCountdown();
    const state = stormCountdownState(countdown);
    const text = formatStormCountdownText(countdown);
    if (state === null || text === null) {
        return null;
    }

    const colour = hazardStateColour(state);
    let panelClass = "visor-panel visor-panel-caution";
    if (state === "no_go") {
        panelClass = "visor-panel visor-panel-no-go visor-alert-pulse";
    }

    return (
        <div
            className={`${panelClass} mx-auto flex w-fit max-w-full items-center justify-center gap-2 px-3 py-1.5`}
            style={{ color: colour }}
            role="status"
            aria-label={text}
        >
            <StateShape state={state} sizePx={24} />
            <span className="visor-number text-[clamp(22px,3vw,34px)]" style={{ color: colour }}>
                {text}
            </span>
        </div>
    );
}
