// Compact Knot list (owner: Letta, Stage 3): one 48 px row per science stop with its tasks done count
// and a chevron; a tap opens the Knot card. Width-fluid, no outer frame and no title (the DATA sheet
// supplies both).

import { useAriadneStore } from "../state/store";



const LIST_BUTTON_CLASS =
    "ariadne-tap flex w-full items-center gap-2 border border-ariadne-border bg-ariadne-panel px-3 text-left text-sm hover:border-ariadne-accent";



export function KnotList() {
    const processedData = useAriadneStore((state) => state.processedData);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const setSelectedKnot = useAriadneStore((state) => state.setSelectedKnot);

    if (processedData === null) {
        return null;
    }

    return (
        <ul className="flex flex-col gap-1">
            {processedData.knots.map((knot) => {
                const doneCount = knot.science_tasks.filter((task) => completedTaskIds.includes(task.task_id)).length;
                const taskCount = knot.science_tasks.length;
                return (
                    <li key={knot.knot_id}>
                        <button
                            type="button"
                            className={LIST_BUTTON_CLASS}
                            onClick={() => setSelectedKnot(knot.knot_id)}
                            aria-label={`Open Knot card for ${knot.name}, ${doneCount} of ${taskCount} tasks done`}
                        >
                            <span className="min-w-0 flex-1 break-words font-bold">{knot.name}</span>
                            <span className="shrink-0 text-xs tabular-nums text-ariadne-muted">
                                {doneCount}/{taskCount} tasks
                            </span>
                            <span className="shrink-0 text-base text-ariadne-accent" aria-hidden="true">
                                &gt;
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
