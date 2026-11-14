// Web Worker that computes the Thread contour off the main thread (owner: Malissa, Stage 2).
// One contour on the full 1013 x 934 field takes 30 to 700 ms, too long for the render loop.
// Protocol (descriptive message types):
//   in  "set_return_field"          { return_field: Float32Array, grid }
//   in  "compute_thread_contours"   { request_id, threshold_seconds }
//   out "thread_contours_ready"     { request_id, threshold_seconds, rings: LocalPosition[][] }
//   out "thread_contours_failed"    { request_id, error_message }

import type { GridDefinition } from "../data/contracts";
import { computeThreadContours } from "./threadContour";



export type ThreadWorkerRequest =
    | { message_type: "set_return_field"; return_field: Float32Array; grid: GridDefinition }
    | { message_type: "compute_thread_contours"; request_id: number; threshold_seconds: number };



let returnField: Float32Array | null = null;
let grid: GridDefinition | null = null;


self.onmessage = (event: MessageEvent<ThreadWorkerRequest>) => {
    const request = event.data;
    if (request.message_type === "set_return_field") {
        returnField = request.return_field;
        grid = request.grid;
        return;
    }
    if (request.message_type === "compute_thread_contours") {
        if (returnField === null || grid === null) {
            self.postMessage({
                message_type: "thread_contours_failed",
                request_id: request.request_id,
                error_message: "return_field not set",
            });
            return;
        }
        try {
            const rings = computeThreadContours(returnField, grid, request.threshold_seconds);
            self.postMessage({
                message_type: "thread_contours_ready",
                request_id: request.request_id,
                threshold_seconds: request.threshold_seconds,
                rings,
            });
        } catch (error) {
            self.postMessage({
                message_type: "thread_contours_failed",
                request_id: request.request_id,
                error_message: String(error),
            });
        }
    }
};
