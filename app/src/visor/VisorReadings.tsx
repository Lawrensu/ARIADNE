// Visor readings (owner: Lawrence, D-032): exactly three numbers along the bottom of the glass:
// distance to the next Knot (or the shelter), Thread margin (est.) and O2 h:mm (est.). Each shows
// state as colour plus shape plus word (theme/StateBadge) and carries "est." Tapping a reading opens
// its provenance. The numbers come from hud/hudMath.ts through useVisorReadings.

import { useState } from "react";

import type { Provenance } from "../data/contracts";
import type { HudNumbers, HudState } from "../hud/hudMath";
import { EstimateBadge } from "../theme/EstimateBadge";
import { ProvenanceDialog } from "../theme/ProvenancePopover";
import { StateBadge } from "../theme/StateBadge";
import type { VisorTarget } from "./useVisorState";



export interface VisorReadingsProps {
    numbers: HudNumbers;
    target: VisorTarget | null;
    simElapsedSeconds: number;
}



interface ReadingProps {
    label: string;
    value: string;
    state: HudState;
    isEstimate: boolean;
    provenance: Provenance;
}


function Reading({ label, value, state, isEstimate, provenance }: ReadingProps) {
    const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className="visor-hit flex min-h-16 min-w-0 flex-col items-center gap-1 bg-transparent p-1 text-center"
                aria-label={`${label}: ${value}${isEstimate ? ", estimate" : ""}. Show provenance.`}
                onClick={() => setIsProvenanceOpen(true)}
            >
                {/* Phone and tablet: the label stays on one line; the est. badge moves under the number. */}
                <span className="flex w-full min-w-0 items-center justify-center gap-1">
                    <span className="visor-label truncate text-[20px]">{label}</span>
                    {isEstimate && (
                        <span className="hidden lg:inline-flex">
                            <EstimateBadge />
                        </span>
                    )}
                </span>
                <span
                    className="visor-number whitespace-nowrap text-[clamp(32px,4.2vw,56px)]"
                    style={{ color: "var(--ariadne-phosphor-white)" }}
                >
                    {value}
                </span>
                <span className="flex flex-wrap items-center justify-center gap-1">
                    <StateBadge state={state} sizePx={14} style={{ fontSize: "0.75rem", padding: "1px 6px", lineHeight: 1.1 }} />
                    {isEstimate && (
                        <span className="lg:hidden">
                            <EstimateBadge />
                        </span>
                    )}
                </span>
            </button>
            {isProvenanceOpen && (
                <ProvenanceDialog
                    title={label}
                    valueText={value}
                    provenance={provenance}
                    onClose={() => setIsProvenanceOpen(false)}
                />
            )}
        </>
    );
}



export function VisorReadings({ numbers, target, simElapsedSeconds }: VisorReadingsProps) {
    const timestampText = `sim T+${Math.floor(Math.max(simElapsedSeconds, 0) / 60)} min`;

    let distanceLabel = "NEXT KNOT";
    let distanceProductId = "no Knot selected";
    if (target !== null) {
        distanceProductId = target.id;
        if (target.kind === "shelter") {
            distanceLabel = "SHELTER";
        }
    }

    const distanceProvenance: Provenance = {
        source_dataset: "ARIADNE local grid: your position and the target position",
        product_id: distanceProductId,
        timestamp: timestampText,
        is_estimate: true,
        uncertainty: "straight line unless taken from the planned leg; position is simulated",
    };
    const threadProvenance: Provenance = {
        source_dataset: "ARIADNE return field (pipeline) and walking model",
        product_id: "return_field",
        timestamp: timestampText,
        is_estimate: true,
        uncertainty: "walking model, carried load included",
    };
    const o2Provenance: Provenance = {
        source_dataset: "ARIADNE suit consumables model (meta.json parameters)",
        product_id: "suit_capability_hours",
        timestamp: timestampText,
        is_estimate: true,
        uncertainty: "8 h suit capability minus elapsed simulation time",
    };

    return (
        <section className="grid w-full grid-cols-3 gap-1" aria-label="Three main readings">
            <Reading
                label={distanceLabel}
                value={numbers.distanceText}
                state={numbers.distanceState}
                isEstimate={true}
                provenance={distanceProvenance}
            />
            <Reading
                label="THREAD"
                value={numbers.threadMarginText}
                state={numbers.threadState}
                isEstimate={true}
                provenance={threadProvenance}
            />
            <Reading label="O2 H:MM" value={numbers.o2Text} state={numbers.o2State} isEstimate={true} provenance={o2Provenance} />
        </section>
    );
}
