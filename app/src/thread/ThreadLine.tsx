// The Thread drawn on the terrain (owner: Malissa, Stage 2). Render inside the scene's <TerrainProvider>.
// Reads the simulation clock and the processed data from the store. The contour is computed in a Web
// Worker (threadContourWorker.ts) only when the quantised threshold changes (threadContour.ts: 15 s steps,
// coarser while playing fast); the previous ring stays on screen until the new one arrives.
// All rings are drawn as ONE line-segments object (one draw call), because the real field has
// hundreds to about 1,700 rings at large thresholds.

import { Line } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { LocalPosition } from "../data/contracts";
import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { computeConsumablesState } from "../sim/clock";
import { useAriadneStore } from "../state/store";
import { sampleTerrainSceneY } from "../terrain/terrainFrame";
import { useTerrain } from "../terrain/TerrainContext";
import {
    GLOW_EXTRA_WIDTH_PX,
    GLOW_OPACITY,
    GLOW_STENCIL_REF,
    LINE_CASING_COLOUR,
    LINE_CASING_EXTRA_WIDTH_PX,
    LINE_CASING_OPACITY,
    LINE_RENDER_ORDER,
    MAP_COLOURS,
} from "../scene/mapStyle";
import {
    chooseThresholdQuantumSeconds,
    effectiveReturnFieldThresholdSeconds,
    largestFiniteReturnSeconds,
    quantiseThresholdSeconds,
    THREAD_THRESHOLD_QUANTUM_SECONDS,
} from "./threadContour";



// Lift above the terrain surface in metres, so the line is not hidden by the mesh.
const THREAD_LIFT_M = 1.5;
// Phosphor green: the Thread is the app's signature line (Stage 3 palette). It is the brightest line
// on the map (D-031): a wide low-opacity phosphor glow, a thin dark casing, and a phosphor white core,
// solid and thicker than any route. THREAD_COLOR stays the swatch colour other panels import.
export const THREAD_COLOR = MAP_COLOURS.phosphor_green;
export const THREAD_CORE_COLOR = MAP_COLOURS.phosphor_white;
const THREAD_LINE_WIDTH_PX = 3.5;
// Rings enclosing less than this area are not drawn: they are the outlines of single rocks and small
// no-go spots inside the reachable region (or tiny reachable islands), which would bury the Thread in
// hundreds of small loops. 2,000 m^2 is about a 45 x 45 m square. Only drawing is affected;
// computeThreadContours still returns every ring, and the no-go layer shows the small hazards.
const MIN_DRAWN_RING_AREA_M2 = 2000;


// Area enclosed by a closed ring (shoelace formula), m^2, always positive.
function ringAreaSquareMetres(ring: LocalPosition[]): number {
    let twiceSignedArea = 0;
    for (let index = 0; index < ring.length - 1; index++) {
        const current = ring[index];
        const next = ring[index + 1];
        twiceSignedArea += current.x_m * next.z_m - next.x_m * current.z_m;
    }
    return Math.abs(twiceSignedArea) / 2;
}



type ThreadWorkerResponse =
    | { message_type: "thread_contours_ready"; request_id: number; threshold_seconds: number; rings: LocalPosition[][] }
    | { message_type: "thread_contours_failed"; request_id: number; error_message: string };


function useThreadContourWorker(returnField: Float32Array, grid: { width: number; height: number; cell_size_m: number }) {
    const workerRef = useRef<Worker | null>(null);
    const latestRequestIdRef = useRef(0);
    const [rings, setRings] = useState<LocalPosition[][]>([]);

    useEffect(() => {
        const worker = new Worker(new URL("./threadContourWorker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (event: MessageEvent<ThreadWorkerResponse>) => {
            const response = event.data;
            if (response.request_id !== latestRequestIdRef.current) {
                return;
            }
            if (response.message_type === "thread_contours_ready") {
                setRings(response.rings);
            } else {
                console.error(`Thread contour failed: ${response.error_message}`);
            }
        };
        // A copy, so the main thread keeps its own return_field.
        worker.postMessage({ message_type: "set_return_field", return_field: returnField.slice(), grid });
        workerRef.current = worker;
        return () => {
            worker.terminate();
            workerRef.current = null;
        };
    }, [returnField, grid]);

    const requestContours = (thresholdSeconds: number) => {
        const worker = workerRef.current;
        if (worker === null) {
            return;
        }
        latestRequestIdRef.current += 1;
        worker.postMessage({
            message_type: "compute_thread_contours",
            request_id: latestRequestIdRef.current,
            threshold_seconds: thresholdSeconds,
        });
    };

    return { rings, requestContours };
}



export function ThreadLine() {
    const { processedData, frame } = useTerrain();
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    const isSimPlaying = useAriadneStore((state) => state.isSimPlaying);
    const simSpeedMultiplier = useAriadneStore((state) => state.simSpeedMultiplier);

    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);

    const returnField = processedData.float32Layers.return_field;
    const grid = processedData.meta.grid;
    const { rings, requestContours } = useThreadContourWorker(returnField, grid);

    // Above the largest finite return time the ring is the whole reachable region and cannot change.
    const thresholdCapSeconds = useMemo(
        () => quantiseThresholdSeconds(largestFiniteReturnSeconds(returnField) + 2 * THREAD_THRESHOLD_QUANTUM_SECONDS),
        [returnField],
    );

    // contracts.md 4.6 rule 4: inside the Thread when return_field x load_factor <= time left. The factor is
    // uniform, so this is the contour of return_field at time left / load_factor. That effective threshold
    // is what gets quantised and capped, so the worker is asked only when the drawn ring can change.
    const timeLeftSeconds = computeConsumablesState(simElapsedSeconds, processedData.meta.parameters).planned_time_left_s;
    const loadParameters = loadParametersFromMeta(processedData.meta.parameters);
    const carriedKg = carriedLoadKg(processedData.knots, completedTaskIds, loadParameters);
    const effectiveThresholdSeconds = effectiveReturnFieldThresholdSeconds(
        timeLeftSeconds,
        loadFactor(carriedKg, loadParameters),
    );
    const quantisedThresholdSeconds = quantiseThresholdSeconds(
        effectiveThresholdSeconds,
        chooseThresholdQuantumSeconds(isSimPlaying, simSpeedMultiplier),
    );
    const drawnThresholdSeconds = Math.min(quantisedThresholdSeconds, thresholdCapSeconds);

    useEffect(() => {
        requestContours(drawnThresholdSeconds);
        // requestContours is recreated every render but only reads refs; the threshold is the real trigger.
        // returnField is listed so a new worker (created in the effect above) gets its first request.
    }, [drawnThresholdSeconds, returnField]);

    // Pairs of points (segment start, segment end) for one LineSegments2 draw.
    const segmentPoints = useMemo(() => {
        const points: [number, number, number][] = [];
        for (const ring of rings) {
            if (ringAreaSquareMetres(ring) < MIN_DRAWN_RING_AREA_M2) {
                continue;
            }
            let previous: [number, number, number] | null = null;
            for (const point of ring) {
                const current: [number, number, number] = [
                    point.x_m,
                    sampleTerrainSceneY(frame, point.x_m, point.z_m) + THREAD_LIFT_M,
                    point.z_m,
                ];
                if (previous !== null) {
                    points.push(previous, current);
                }
                previous = current;
            }
        }
        return points;
    }, [rings, frame]);

    if (segmentPoints.length < 2) {
        return null;
    }

    // Three passes over the same segments: glow, casing, core (three draw calls in total).
    return (
        <group name="thread">
            <Line
                segments
                points={segmentPoints}
                color={THREAD_COLOR}
                lineWidth={THREAD_LINE_WIDTH_PX + GLOW_EXTRA_WIDTH_PX}
                transparent
                opacity={GLOW_OPACITY}
                stencilWrite
                stencilRef={GLOW_STENCIL_REF}
                stencilFunc={THREE.NotEqualStencilFunc}
                stencilZPass={THREE.ReplaceStencilOp}
                depthWrite={false}
                toneMapped={false}
                renderOrder={LINE_RENDER_ORDER.thread_glow}
            />
            <Line
                segments
                points={segmentPoints}
                color={LINE_CASING_COLOUR}
                lineWidth={THREAD_LINE_WIDTH_PX + LINE_CASING_EXTRA_WIDTH_PX}
                transparent
                opacity={LINE_CASING_OPACITY}
                depthWrite={false}
                toneMapped={false}
                renderOrder={LINE_RENDER_ORDER.thread_casing}
            />
            <Line
                segments
                points={segmentPoints}
                color={THREAD_CORE_COLOR}
                lineWidth={THREAD_LINE_WIDTH_PX}
                transparent
                depthWrite={false}
                toneMapped={false}
                renderOrder={LINE_RENDER_ORDER.thread_core}
            />
        </group>
    );
}
