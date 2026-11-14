// The Thread summary for the panel (owner: Letta, Stage 3; logic from Malissa's thread/threadInfo.ts).
// Shows the area inside the ring, the carried load and the provenance line, refreshed once per
// simulated minute so the contour worker is not restarted on every frame.

import { useMemo } from "react";

import { useAriadneStore } from "../state/store";
import { THREAD_COLOR } from "../thread/ThreadLine";
import { computeThreadInfo } from "../thread/threadInfo";



const THREAD_AREA_REFRESH_SECONDS = 60;



export function ThreadSummary() {
    const processedData = useAriadneStore((state) => state.processedData);
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const refreshKey = Math.floor(simElapsedSeconds / THREAD_AREA_REFRESH_SECONDS);

    const threadInfo = useMemo(() => {
        if (processedData === null) {
            return null;
        }
        return computeThreadInfo(processedData, refreshKey * THREAD_AREA_REFRESH_SECONDS, completedTaskIds);
    }, [processedData, refreshKey, completedTaskIds]);

    if (threadInfo === null) {
        return null;
    }

    const areaKm2 = threadInfo.reachable_area_square_metres / 1e6;

    return (
        <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
                <span className="inline-block h-1 w-6 shrink-0" style={{ background: THREAD_COLOR }} />
                <span>The Thread: you can still walk back to the rover from inside it.</span>
            </div>
            <div className="text-ariadne-muted">
                Area inside the Thread: est. {areaKm2.toFixed(1)} km² with est. {threadInfo.carried_load_kg.toFixed(1)} kg carried
                (walking x{threadInfo.load_factor.toFixed(2)}), updated each simulated minute.
            </div>
            <div className="text-xs text-ariadne-dim">{threadInfo.provenance}</div>
        </div>
    );
}
