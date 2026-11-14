// Compact Knot list (owner: Letta, Stage 3): every science stop with its photo count, task count and
// how many tasks are done, each a 48 px button that opens the Knot card. The main agent places it in
// the Plan panel.

import { useAriadneStore } from "../state/store";



const LIST_BUTTON_CLASS =
    "ariadne-tap flex w-full items-center gap-2 border border-ariadne-border bg-ariadne-panel px-2 text-left text-sm hover:border-ariadne-accent";



export function KnotList() {
    const processedData = useAriadneStore((state) => state.processedData);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const setSelectedKnot = useAriadneStore((state) => state.setSelectedKnot);

    if (processedData === null) {
        return null;
    }

    return (
        <div className="flex flex-col gap-1">
            <div className="text-xs uppercase tracking-widest text-ariadne-muted">Science stops</div>
            {processedData.knots.map((knot) => {
                const doneCount = knot.science_tasks.filter((task) => completedTaskIds.includes(task.task_id)).length;
                return (
                    <button
                        key={knot.knot_id}
                        type="button"
                        className={LIST_BUTTON_CLASS}
                        onClick={() => setSelectedKnot(knot.knot_id)}
                        aria-label={`Open Knot card for ${knot.name}`}
                    >
                        <span className="min-w-0 flex-1">
                            <span className="block break-words font-bold">{knot.name}</span>
                            <span className="block text-xs text-ariadne-muted">
                                {knot.photos.length} photos, {knot.science_tasks.length} tasks, {doneCount} done
                            </span>
                        </span>
                        <span className="shrink-0 border border-ariadne-border px-2 text-xs uppercase tracking-wider text-ariadne-muted">
                            Open
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
