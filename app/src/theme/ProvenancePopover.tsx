// Provenance on every number (owner: Letta, Stage 3). Tap any displayed value to see the dataset,
// product ID, resolution, timestamp and uncertainty, with an "est." badge for model-derived values
// (contracts.md 1.5, system_design.md "Provenance pattern"). Shared by the HUD, Knot cards and alerts.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { Provenance } from "../data/contracts";
import { EstimateBadge } from "./EstimateBadge";



export interface ProvenanceDialogProps {
    title: string;
    valueText?: string;
    provenance: Provenance;
    onClose: () => void;
}



function ProvenanceRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[7.5rem_1fr] gap-2 border-b border-ariadne-border py-2 text-sm">
            <span className="text-ariadne-muted">{label}</span>
            <span className="break-words text-ariadne-text">{children}</span>
        </div>
    );
}



export function ProvenanceDialog({ title, valueText, provenance, onClose }: ProvenanceDialogProps) {
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    let estimateText = "measured or published value";
    if (provenance.is_estimate) {
        estimateText = "estimated (model-derived)";
    }

    return (
        <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 sm:items-center"
            role="presentation"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Provenance for ${title}`}
                className="ariadne-scroll max-h-[85vh] w-full max-w-lg overflow-y-auto border-2 border-ariadne-accent bg-ariadne-panel p-4 text-ariadne-text"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                        <div className="ariadne-display text-2xl text-ariadne-accent">{title}</div>
                        {valueText !== undefined && (
                            <div className="mt-1 flex items-center gap-1 text-lg">
                                <span>{valueText}</span>
                                {provenance.is_estimate && <EstimateBadge />}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className="ariadne-tap border border-ariadne-border px-3 text-sm hover:border-ariadne-accent"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>

                <ProvenanceRow label="Dataset">{provenance.source_dataset}</ProvenanceRow>
                <ProvenanceRow label="Product ID">{provenance.product_id}</ProvenanceRow>
                {provenance.resolution_m !== undefined && (
                    <ProvenanceRow label="Resolution">{provenance.resolution_m} m</ProvenanceRow>
                )}
                <ProvenanceRow label="Timestamp">
                    {provenance.timestamp !== undefined ? provenance.timestamp : "not time-stamped"}
                </ProvenanceRow>
                <ProvenanceRow label="Uncertainty">
                    {provenance.uncertainty !== undefined ? String(provenance.uncertainty) : "not stated"}
                </ProvenanceRow>
                <ProvenanceRow label="Value type">{estimateText}</ProvenanceRow>

                <p className="mt-3 text-xs text-ariadne-dim">
                    Local grid metres, north up. Latitude and longitude are shown for display only and come from
                    meta.json. Every displayed number keeps this record attached.
                </p>
            </div>
        </div>
    );
}



export interface ProvenanceButtonProps {
    label: string;
    value: string;
    provenance: Provenance;
    // Extra short text after the value, for example a unit.
    unit?: string;
    className?: string;
}



// A tappable value: opens the provenance dialog. Minimum size follows the Planning Table tap rule
// (48 px); callers on the Suit HUD pass their own larger class.
export function ProvenanceButton({ label, value, provenance, unit, className }: ProvenanceButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    let valueText = value;
    if (unit !== undefined && unit.length > 0) {
        valueText = `${value} ${unit}`;
    }

    let classes = "ariadne-tap inline-flex min-w-0 items-center gap-1 border border-transparent px-1 text-left hover:border-ariadne-border ";
    if (className !== undefined) {
        classes += className;
    }

    return (
        <>
            <button
                type="button"
                className={classes}
                onClick={() => setIsOpen(true)}
                aria-label={`${label}: ${valueText}. Show provenance.`}
            >
                <span className="min-w-0 truncate">{value}</span>
                {unit !== undefined && <span className="text-ariadne-muted">{unit}</span>}
                {provenance.is_estimate && <EstimateBadge />}
            </button>
            {isOpen && (
                <ProvenanceDialog
                    title={label}
                    valueText={valueText}
                    provenance={provenance}
                    onClose={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
