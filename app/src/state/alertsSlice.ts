// Alerts slice (owner: Letta, Stage 3, built by the alerts sub-agent): the active alert list.
// Every alert has what happened, the action, distance and time, and a one-tap route target
// (system_design.md, Alert anatomy). Severity uses the go / caution / no-go states.

import type { StateCreator } from "zustand";

import type { RouteEndpointKind } from "./routeSlice";
import type { AriadneState } from "./store";



export type AlertSeverity = "go" | "caution" | "no_go";



export interface AlertRecord {
    alert_id: string;
    // Descriptive string constant, for example "solar_particle_event_alert" (D-012, contracts.md 3.15).
    alert_type: string;
    severity: AlertSeverity;
    // What happened, in one short sentence.
    what_happened: string;
    // What the crew should do; an alert without an action is a bug.
    recommended_action: string;
    // Distance and walking time to the action target, when there is one.
    distance_m: number | null;
    time_s: number | null;
    // The place the one-tap [ROUTE] goes to (shelter, rover or Knot).
    route_target_kind: RouteEndpointKind | null;
    route_target_id: string | null;
    route_target_label: string | null;
    created_at_sim_seconds: number;
    is_estimate: boolean;
}



export interface AlertsSlice {
    alerts: AlertRecord[];
    dismissedAlertIds: string[];
    // Adds an alert once; a repeated raise with the same alert_id is ignored (the scenario engine
    // can call it every frame without duplicating).
    raiseAlert: (alert: AlertRecord) => void;
    dismissAlert: (alertId: string) => void;
    clearAlerts: () => void;
}



export const createAlertsSlice: StateCreator<AriadneState, [], [], AlertsSlice> = (set) => ({
    alerts: [],
    dismissedAlertIds: [],

    raiseAlert: (alert) =>
        set((state) => {
            const alreadyRaised = state.alerts.some((candidate) => candidate.alert_id === alert.alert_id);
            if (alreadyRaised) {
                return {};
            }
            return { alerts: [...state.alerts, alert] };
        }),

    dismissAlert: (alertId) =>
        set((state) => {
            if (state.dismissedAlertIds.includes(alertId)) {
                return {};
            }
            return { dismissedAlertIds: [...state.dismissedAlertIds, alertId] };
        }),

    clearAlerts: () => set({ alerts: [], dismissedAlertIds: [] }),
});
