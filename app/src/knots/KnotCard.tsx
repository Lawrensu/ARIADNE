// Knot card (owner: Letta, Stage 3): a readable science stop card. Photo on top with its credit, the name,
// the science text, measurements as label/value rows with provenance, the tasks with check boxes (D-027)
// and "Route here" / "Close". Photos are local (app/public/knots/), so the demo works offline (D-024).
// Contract values are shown exactly; nothing is recomputed here. Square corners, 1 px phosphor frame,
// dark backdrop, fits a 375 px phone.

import { useEffect } from "react";

import type { Knot, KnotMeasurement, ScienceTask } from "../data/contracts";
import { planRoute } from "../planning/routingService";
import type { RouteEndpoint } from "../state/routeSlice";
import { useAriadneStore } from "../state/store";
import { InfoToggle } from "../theme/InfoToggle";
import { ProvenanceButton } from "../theme/ProvenancePopover";
import { localPhotoPath } from "./knotPhotos";



const CARD_TITLE_ID_PREFIX = "knot-card-title-";

const ACTION_BUTTON_CLASS =
    "ariadne-tap inline-flex items-center justify-center border border-ariadne-accent bg-ariadne-accent px-4 text-sm font-bold uppercase tracking-wider text-ariadne-background hover:bg-ariadne-text disabled:opacity-40";

const CLOSE_BUTTON_CLASS =
    "ariadne-tap inline-flex items-center justify-center border border-ariadne-border px-4 text-sm font-bold uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent";

const LABEL_CLASS = "text-xs uppercase tracking-widest text-ariadne-muted";



function formatGridPosition(knot: Knot): string {
    return `x ${knot.x_m.toFixed(1)} m, z ${knot.z_m.toFixed(1)} m (local grid)`;
}


// Square check box drawn as a shape, so the done state never depends on colour alone.
function CheckBoxMark({ isChecked }: { isChecked: boolean }) {
    if (isChecked) {
        return (
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                <rect x="2" y="2" width="20" height="20" fill="var(--ariadne-accent)" />
                <path d="M6 12 L10 16 L18 7" stroke="var(--ariadne-screen-black)" strokeWidth="2.6" fill="none" />
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
        <li className="flex items-center justify-between gap-3 border-b border-ariadne-border last:border-b-0">
            <span className="min-w-0 text-sm text-ariadne-muted">{measurement.label}</span>
            <ProvenanceButton
                label={measurement.label}
                value={String(measurement.value)}
                unit={measurement.unit}
                provenance={measurement.provenance}
                className="shrink-0 text-sm text-ariadne-data"
            />
        </li>
    );
}


function ScienceTaskRow({ task }: { task: ScienceTask }) {
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const setTaskCompleted = useAriadneStore((state) => state.setTaskCompleted);
    const isDone = completedTaskIds.includes(task.task_id);

    return (
        <li className="flex items-center gap-1 border-b border-ariadne-border last:border-b-0">
            <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                aria-label={`${task.label}: ${isDone ? "done" : "not done"}`}
                className="ariadne-tap flex min-w-12 items-center justify-center"
                onClick={() => setTaskCompleted(task.task_id, !isDone)}
            >
                <CheckBoxMark isChecked={isDone} />
            </button>
            <div className="min-w-0 flex-1 py-1">
                <div className="break-words text-sm font-bold">{task.label}</div>
                {task.equipment.length > 0 && <div className="text-xs text-ariadne-muted">{task.equipment.join(", ")}</div>}
            </div>
            <ProvenanceButton
                label={`${task.label} task estimate`}
                value={`${task.duration_minutes} min, ${task.sample_mass_kg.toFixed(1)} kg`}
                provenance={task.provenance}
                className="shrink-0 text-xs text-ariadne-muted"
            />
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

    // The first photo goes on top at full width, the others below it in two columns.
    const photoFigures = knot.photos.map((photo, index) => {
        const isFirstPhoto = index === 0;
        let figureClass = "min-w-0";
        if (isFirstPhoto) {
            figureClass += " col-span-2";
        }
        return (
            <figure key={`${knot.knot_id}-photo-${index + 1}`} className={figureClass}>
                <img
                    src={localPhotoPath(knot.knot_id, index + 1)}
                    alt={photo.caption}
                    loading="lazy"
                    className="aspect-[4/3] w-full border border-ariadne-border object-cover"
                />
                <figcaption className="mt-1 text-xs text-ariadne-dim">
                    Sol {photo.sol}, {photo.camera}. Credit: {photo.credit}
                </figcaption>
            </figure>
        );
    });

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4" role="presentation" onClick={closeCard}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="flex max-h-[92vh] w-full flex-col overflow-hidden border border-ariadne-accent bg-ariadne-panel text-ariadne-text sm:max-h-[85vh] sm:max-w-[40rem]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="ariadne-scroll flex flex-1 flex-col gap-4 overflow-y-auto p-3">
                    {photoFigures.length > 0 && <div className="grid grid-cols-2 gap-2">{photoFigures}</div>}

                    <div>
                        <h2 id={titleId} className="ariadne-display break-words text-2xl text-ariadne-accent">
                            {knot.name}
                        </h2>
                        <div className="break-words text-xs text-ariadne-dim">{formatGridPosition(knot)}</div>
                    </div>

                    <p className="text-sm">{knot.science_rationale}</p>

                    {knot.measurements.length > 0 && (
                        <section>
                            <h3 className={`${LABEL_CLASS} mb-1`}>Measurements</h3>
                            <ul className="border-t border-ariadne-border">
                                {knot.measurements.map((measurement, index) => (
                                    <MeasurementRow key={`${knot.knot_id}-measurement-${index}`} measurement={measurement} />
                                ))}
                            </ul>
                        </section>
                    )}

                    <section>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className={LABEL_CLASS}>Tasks</h3>
                            {knot.science_tasks.length > 0 && (
                                <InfoToggle label="Tasks">
                                    Done adds the sample mass to the carried load and slows the walk back (contracts.md 4.6, D-027).
                                </InfoToggle>
                            )}
                        </div>
                        {knot.science_tasks.length === 0 && <p className="text-sm text-ariadne-muted">No tasks.</p>}
                        {knot.science_tasks.length > 0 && (
                            <ul className="mt-1 border-t border-ariadne-border">
                                {knot.science_tasks.map((task) => (
                                    <ScienceTaskRow key={task.task_id} task={task} />
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-ariadne-border bg-ariadne-panel p-3">
                    <button type="button" className={ACTION_BUTTON_CLASS} onClick={routeHere} disabled={processedData === null}>
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
