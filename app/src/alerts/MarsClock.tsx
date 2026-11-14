// Mars clock (owner: Letta, Stage 3): the replayed Local Mean Solar Time from the environment
// timeline, plus a live Mars24 estimate for "now" at the patch longitude. Two variants: one line
// for the status strip, a larger block for the Time tab.
//
// Honesty rules: the replayed clock is labelled "replay" and is never called live (D-014). The live
// conversion runs in the app as an estimate (D-024 rule 6) and carries "est." everywhere.
//
// Props only, no store reads, so the clock can be placed in any panel.

import { useEffect, useState } from "react";

import type { EnvironmentTimeline } from "../data/contracts";
import { EstimateBadge } from "../theme/EstimateBadge";
import { InfoToggle } from "../theme/InfoToggle";
import { ProvenanceButton } from "../theme/ProvenancePopover";
import {
    MARS24_PROVENANCE,
    formatMarsClock,
    marsLocalMeanSolarTimeHours,
    replaySampleAt,
} from "./mars24";



export interface MarsClockProps {
    // Simulated seconds since the Marswalk started (state/simSlice.ts).
    simElapsedSeconds: number;
    environmentTimeline: EnvironmentTimeline;
    // East-positive longitude in degrees at the middle of the patch (see patchCentreEastLongitudeDeg).
    eastLongitudeDeg: number;
    variant?: "strip" | "panel";
}



// Seconds since the replay started as "H:MM:SS"; the replay clock is a duration, not a time of day.
function formatReplayElapsed(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return "0:00:00";
    }
    const wholeSeconds = Math.floor(totalSeconds);
    const hours = Math.floor(wholeSeconds / 3600);
    const minutes = Math.floor((wholeSeconds % 3600) / 60);
    const seconds = wholeSeconds % 60;
    const minutesText = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const secondsText = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${hours}:${minutesText}:${secondsText}`;
}


function padTwoDigits(value: number): string {
    if (value < 10) {
        return `0${value}`;
    }
    return `${value}`;
}


// UTC time of day, for the live estimate, so the two channels can be compared.
function formatUtcTime(utcMilliseconds: number): string {
    const utcDate = new Date(utcMilliseconds);
    return `${padTwoDigits(utcDate.getUTCHours())}:${padTwoDigits(utcDate.getUTCMinutes())}:${padTwoDigits(utcDate.getUTCSeconds())}`;
}


// A one-second tick, so the live estimate keeps moving without a global store or a timer library.
function useUtcNowMilliseconds(): number {
    const [nowMilliseconds, setNowMilliseconds] = useState(() => Date.now());
    useEffect(() => {
        const intervalId = window.setInterval(() => setNowMilliseconds(Date.now()), 1000);
        return () => window.clearInterval(intervalId);
    }, []);
    return nowMilliseconds;
}



export function MarsClock({ simElapsedSeconds, environmentTimeline, eastLongitudeDeg, variant = "panel" }: MarsClockProps) {
    const nowMilliseconds = useUtcNowMilliseconds();
    const replaySample = replaySampleAt(environmentTimeline, simElapsedSeconds);
    const replaySol = environmentTimeline.replay_source.sol;
    const nowHours = marsLocalMeanSolarTimeHours(new Date(nowMilliseconds), eastLongitudeDeg);
    const nowClockText = formatMarsClock(nowHours);
    const longitudeText = `${eastLongitudeDeg.toFixed(3)} deg east`;

    if (variant === "strip") {
        let replayPart = <span className="text-sm text-ariadne-dim">no replay sample</span>;
        if (replaySample !== null) {
            replayPart = (
                <>
                    <ProvenanceButton
                        label="Replayed Local Mean Solar Time"
                        value={replaySample.local_mean_solar_time}
                        provenance={replaySample.provenance}
                        className="text-sm text-ariadne-accent"
                    />
                    <span className="text-xs text-ariadne-muted">REMS sol {replaySol}</span>
                </>
            );
        }
        return (
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1" role="group" aria-label="Mars clock">
                <span className="text-xs uppercase tracking-widest text-ariadne-dim">LMST (replay)</span>
                {replayPart}
                <span className="text-ariadne-dim" aria-hidden="true">
                    |
                </span>
                <span className="text-xs uppercase tracking-widest text-ariadne-dim">now (est.)</span>
                <span className="text-sm tabular-nums text-ariadne-data">{nowClockText}</span>
                <EstimateBadge />
            </div>
        );
    }

    let replayBlock;
    if (replaySample === null) {
        replayBlock = <div className="text-sm text-ariadne-dim">No replay sample.</div>;
    } else {
        replayBlock = (
            <div className="flex flex-wrap items-center gap-x-2">
                <span className="ariadne-display text-[length:var(--ariadne-text-display)] leading-none text-ariadne-accent">
                    {replaySample.local_mean_solar_time}
                </span>
                <ProvenanceButton
                    label="Replayed Local Mean Solar Time"
                    value={`REMS sol ${replaySol}`}
                    provenance={replaySample.provenance}
                    className="text-xs text-ariadne-muted"
                />
            </div>
        );
    }

    return (
        <section className="flex flex-col gap-2 text-ariadne-text" aria-label="Mars clock">
            <div>
                <div className="text-xs uppercase tracking-widest text-ariadne-dim">LMST replay</div>
                {replayBlock}
            </div>

            <div className="border-t border-ariadne-border pt-2">
                <div className="flex flex-wrap items-center gap-x-2">
                    <span className="text-xs uppercase tracking-widest text-ariadne-dim">LMST now</span>
                    <ProvenanceButton
                        label="Mars local mean solar time now (est.)"
                        value={nowClockText}
                        provenance={MARS24_PROVENANCE}
                        className="ariadne-display text-[length:var(--ariadne-text-hud)] leading-none text-ariadne-data"
                    />
                    <InfoToggle label="Mars clock" pushRight>
                        Replay: not live data
                        {replaySample !== null && <>, sample at {formatReplayElapsed(replaySample.seconds_since_replay_start)} of the replay</>}.
                        Now: Mars24 mean solar time at {longitudeText} (patch centre), UTC {formatUtcTime(nowMilliseconds)}. Mean
                        solar time only, not true solar time. <EstimateBadge />
                    </InfoToggle>
                </div>
            </div>
        </section>
    );
}
