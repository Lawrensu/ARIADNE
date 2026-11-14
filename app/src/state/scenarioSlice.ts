// Scenario slice (owner: Letta, Stage 3, built by the simulation sub-agent): which scripted scenario
// is running and how many of its events have fired. The scenario itself lives at src/sim/scenario.json
// (contracts.md 3.15). The clock stays simElapsedSeconds in simSlice; this slice only bookkeeping.

import type { StateCreator } from "zustand";

import type { AriadneState } from "./store";



// "idle": not started. "running": events fire as sim time passes. "complete": every event fired.
export type ScenarioStatus = "idle" | "running" | "complete";



export interface ScenarioSlice {
    activeScenarioId: string | null;
    scenarioStatus: ScenarioStatus;
    // Number of events already fired in this run, in order (0 means none yet).
    scenarioEventIndex: number;
    // Increments on every start; the UI shows it so two runs can be compared.
    scenarioRunCount: number;
    startScenario: (scenarioId: string) => void;
    setScenarioStatus: (status: ScenarioStatus) => void;
    setScenarioEventIndex: (index: number) => void;
    resetScenario: () => void;
}



export const createScenarioSlice: StateCreator<AriadneState, [], [], ScenarioSlice> = (set) => ({
    activeScenarioId: null,
    scenarioStatus: "idle",
    scenarioEventIndex: 0,
    scenarioRunCount: 0,

    startScenario: (scenarioId) =>
        set((state) => ({
            activeScenarioId: scenarioId,
            scenarioStatus: "running",
            scenarioEventIndex: 0,
            scenarioRunCount: state.scenarioRunCount + 1,
        })),

    setScenarioStatus: (status) => set({ scenarioStatus: status }),
    setScenarioEventIndex: (index) => set({ scenarioEventIndex: Math.max(index, 0) }),
    resetScenario: () =>
        set({ activeScenarioId: null, scenarioStatus: "idle", scenarioEventIndex: 0 }),
});
