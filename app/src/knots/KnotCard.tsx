// Knot card (owner: Letta, Stage 3): a readable science stop card with the rationale, the
// measured values and their provenance, the real Curiosity photos with credits, the science tasks
// with check-off (D-027) and a one-tap route to the Knot. Photos are local (app/public/knots/), so
// the demo works offline (D-024). Contract values are shown exactly; nothing is recomputed here.

import { useEffect } from "react";

import type { Knot, KnotMeasurement, ScienceTask } from "../data/contracts";
import { planRoute } from "../planning/routingService";
import type { RouteEndpoint } from "../state/routeSlice";
import { useAriadneStore } from "../state/store";
import { EstimateBadge } from "../theme/EstimateBadge";
import { ProvenanceButton } from "../theme/ProvenancePopover";
import { localPhotoPath } from "./knotPhotos";



const CARD_TITLE_ID_PREFIX = "knot-card-title-";

const ACTION_BUTTON_CLASS =
    "ariadne-tap inline-flex items-center justify-center gap-2 border-2 border-ariadne-accent px-4 text-sm font-bold uppercase tracking-wider text-ariadne-accent hover:bg-ariadne-accent hover:text-ariadne-background disabled:opacity-40";

const CLOSE_BUTTON_CLASS =
    "ariadne-tap inline-flex min-w-12 items-center justify-center border border-ariadne-border px-3 text-sm hover:border-ariadne-accent";

const ESTIMATE_NOTE_CLASS = "text-xs text-ariadne-dim";



function formatGridPosition(knot: Knot): string {
    return `Local grid x ${knot.x_m.toFixed(1)} m, z ${knot.z_m.toFixed(1)} m`;
}


function taskTypeLabel(task: ScienceTask): string {
    // The contract stores descriptive snake_case strings; show them as words.
    return task.task_type.replace(/_/g, " ");
}


// Shape plus word, so the done state never depends on colour alone.
function DoneStateMark({ isDone }: { isDone: boolean }) {
    if (isDone) {
        return (
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                <rect x="2" y="2" width="20" height="20" fill="var(--ariadne-go)" />
                <path d="M6 12 L10 16 L18 7" stroke="var(--ariadne-screen-black)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="18" height="18" fill="none" stroke="var(--ariadne-muted-green)" strokeWidth="2" />
        </svg>
    );
}


function MeasurementRow({ measurement }: { measurement: KnotMeasurement }) {
    return (
        <li className="border-b border-ariadne-border py-2 last:border-b-0">
            <span className="block text-sm text-ariadne-muted">{measurement.label}</span>
            <ProvenanceButton
                label={measurement.label}
                value={String(measurement.value)}
                unit={measurement.unit}
                provenance={measurement.provenance}
                className="text-base text-ariadne-data"
            />
        </li>
    );
}


function ScienceTaskRow({ task }: { task: ScienceTask }) {
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const setTaskCompleted = useAriadneStore((state) => state.setTaskCompleted);
    const isDone = completedTaskIds.includes(task.task_id);

    return (
        <li className="border-b border-ariadne-border py-2 last:border-b-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="font-bold">{task.label}</div>
                    <div className="text-sm text-ariadne-muted">
                        {taskTypeLabel(task)}, {task.duration_minutes} min, {task.sample_mass_kg.toFixed(1)} kg sample
                        <EstimateBadge />
                    </div>
                    {task.equipment.length > 0 && (
                        <div className="text-sm text-ariadne-muted">Equipment: {task.equipment.join(", ")}</div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                        <ProvenanceButton
                            label={`${task.label} task estimate`}
                            value={`${task.duration_minutes} min, ${task.sample_mass_kg.toFixed(1)} kg`}
                            provenance={task.provenance}
                            className="text-xs text-ariadne-muted"
                        />
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span
                        className="inline-flex items-center gap-1 text-xs uppercase tracking-wider"
                        aria-label={isDone ? "Done" : "Not done"}
                        style={{ color: isDone ? "var(--ariadne-go)" : "var(--ariadne-muted-green)" }}
                    >
                        <DoneStateMark isDone={isDone} />
                        <span>{isDone ? "Done" : "Not done"}</span>
                    </span>
                    <button
                        type="button"
                        className={CLOSE_BUTTON_CLASS}
                        aria-pressed={isDone}
                        onClick={() => setTaskCompleted(task.task_id, !isDone)}
                    >
                        {isDone ? "Undo" : "Done"}
                    </button>
                </div>
            </div>
        </li>
    );
}


export interface KnotCardContentProps {
    knot: Knot;
}


// The card body, split out so it can be rendered for every real Knot in tests without opening the
// overlay. KnotCard below resolves the selected Knot and mounts this.
export function KnotCardContent({ knot }: KnotCardContentProps) {
    const processedData = useAriadneStore((state) => state.processedData);
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const setSelectedKnot = useAriadneStore((state) => state.setSelectedKnot);

    const titleId = `${CARD_TITLE_ID_PREFIX}${knot.knot_id}`;

    const closeCard = () => setSelectedKnot(null);

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setSelectedKnot(null);
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [setSelectedKnot]);

    const routeHere = () => {
        if (processedData === null) {
            return;
        }
        let start: RouteEndpoint;
        if (astronautPosition !== null) {
            start = {
                endpoint_kind: "cell",
                endpoint_id: "current_position",
                label: "Current position",
                position: astronautPosition,
            };
        } else {
            start = {
                endpoint_kind: "staging_point",
                endpoint_id: "staging_point",
                label: "Rover",
                position: processedData.meta.staging_point,
            };
        }
        const knotEndpoint: RouteEndpoint = {
            endpoint_kind: "knot",
            endpoint_id: knot.knot_id,
            label: knot.name,
            position: { x_m: knot.x_m, z_m: knot.z_m },
        };
        void planRoute(start, knotEndpoint);
        closeCard();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
            role="presentation"
            onClick={closeCard}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="flex max-h-[92vh] w-full flex-col overflow-hidden border-2 border-ariadne-accent bg-ariadne-panel text-ariadne-text sm:max-h-[85vh] sm:max-w-[40rem]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 border-b border-ariadne-border p-3">
                    <div className="min-w-0">
                        <h2 id={titleId} className="ariadne-display break-words text-2xl text-ariadne-accent">
                            {knot.name}
                        </h2>
                        <div className="break-words text-sm text-ariadne-muted">{formatGridPosition(knot)}</div>
                    </div>
                    <button type="button" className={CLOSE_BUTTON_CLASS} onClick={closeCard} aria-label="Close Knot card">
                        Close
                    </button>
                </div>

                <div className="ariadne-scroll flex flex-1 flex-col gap-4 overflow-y-auto p-3">
                    <section>
                        <h3 className="mb-1 text-xs uppercase tracking-widest text-ariadne-muted">Why go here</h3>
                        <p className="text-sm">{knot.science_rationale}</p>
                    </section>

                    <section>
                        <h3 className="mb-1 text-xs uppercase tracking-widest text-ariadne-muted">Measurements</h3>
                        <ul>
                            {knot.measurements.map((measurement, index) => (
                                <MeasurementRow key={`${knot.knot_id}-measurement-${index}`} measurement={measurement} />
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h3 className="mb-1 text-xs uppercase tracking-widest text-ariadne-muted">Science tasks</h3>
                        {knot.science_tasks.length === 0 && (
                            <p className="text-sm text-ariadne-muted">No science tasks defined at this Knot.</p>
                        )}
                        {knot.science_tasks.length > 0 && (
                            <>
                                <ul>
                                    {knot.science_tasks.map((task) => (
                                        <ScienceTaskRow key={task.task_id} task={task} />
                                    ))}
                                </ul>
                                <p className={ESTIMATE_NOTE_CLASS}>
                                    Done adds the sample mass to the carried load and slows the walk back (contracts.md 4.6, D-027).
                                </p>
                            </>
                        )}
                    </section>

                    <section>
                        <h3 className="mb-1 text-xs uppercase tracking-widest text-ariadne-muted">Curiosity photos</h3>
                        {knot.photos.length === 0 && <p className="text-sm text-ariadne-muted">No photos for this Knot.</p>}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {knot.photos.map((photo, index) => (
                                <figure key={`${knot.knot_id}-photo-${index + 1}`} className="min-w-0">
                                    <img
                                        src={localPhotoPath(knot.knot_id, index + 1)}
                                        alt={photo.caption}
                                        loading="lazy"
                                        className="aspect-[4/3] w-full border border-ariadne-border object-cover"
                                    />
                                    <figcaption className="mt-1 text-xs text-ariadne-muted">
                                        <span className="block text-ariadne-text">{photo.caption}</span>
                                        <span className="block">
                                            Sol {photo.sol}, {photo.camera}
                                        </span>
                                        <span className="block text-ariadne-dim">Credit: {photo.credit}</span>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="sticky bottom-0 flex gap-2 border-t border-ariadne-border bg-ariadne-panel p-3">
                    <button
                        type="button"
                        className={`${ACTION_BUTTON_CLASS} flex-1`}
                        onClick={routeHere}
                        disabled={processedData === null}
                    >
                        Route here
                    </button>
                    <button type="button" className={CLOSE_BUTTON_CLASS} onClick={closeCard}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}


export function KnotCard() {
    const isKnotCardOpen = useAriadneStore((state) => state.isKnotCardOpen);
    const selectedKnotId = useAriadneStore((state) => state.selectedKnotId);
    const processedData = useAriadneStore((state) => state.processedData);

    if (!isKnotCardOpen) {
        return null;
    }
    if (selectedKnotId === null || processedData === null) {
        return null;
    }
    const knot = processedData.knots.find((candidate) => candidate.knot_id === selectedKnotId);
    if (knot === undefined) {
        return null;
    }
    return <KnotCardContent knot={knot} />;
}
