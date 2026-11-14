// Data slice: the processed pipeline outputs, loaded once at start-up (owner: Malissa, Stage 2).

import type { StateCreator } from "zustand";

import type { ProcessedData } from "../data/loadProcessed";
import { loadProcessedDataOverHttp } from "../data/loadProcessed";
import type { AriadneState } from "./store";



// "idle" before loading starts, "loading" while files arrive, "loaded" when ready, "load_failed" on any error.
export type DataLoadStatus = "idle" | "loading" | "loaded" | "load_failed";


export interface DataSlice {
    dataLoadStatus: DataLoadStatus;
    dataLoadMessage: string;
    dataLoadError: string | null;
    processedData: ProcessedData | null;
    loadProcessedData: () => Promise<void>;
}



export const createDataSlice: StateCreator<AriadneState, [], [], DataSlice> = (set, get) => ({
    dataLoadStatus: "idle",
    dataLoadMessage: "",
    dataLoadError: null,
    processedData: null,

    loadProcessedData: async () => {
        if (get().dataLoadStatus === "loading") {
            return;
        }
        set({ dataLoadStatus: "loading", dataLoadMessage: "Starting", dataLoadError: null });
        try {
            const processedData = await loadProcessedDataOverHttp((message) => set({ dataLoadMessage: message }));
            set({ processedData, dataLoadStatus: "loaded", dataLoadMessage: "Loaded" });
        } catch (error) {
            let errorMessage: string;
            if (error instanceof Error) {
                errorMessage = error.message;
            } else {
                errorMessage = String(error);
            }
            set({ dataLoadStatus: "load_failed", dataLoadError: errorMessage });
        }
    },
});
