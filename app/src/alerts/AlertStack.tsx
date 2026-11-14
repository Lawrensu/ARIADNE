// Alert stack (owner: Lawrence, Stage 3 takeover). Every alert shows what happened, the action, the
// distance and walking time to its target from where the astronaut is now (est.), and a one-tap
// [ROUTE] that leaves the plan and walks there (rerouteWalkTo). system_design.md, Alert anatomy.
//
// variant "hud": every active alert, newest first, inside the Suit HUD.
// variant "map": only the newest active alert, compact, over the map.

import { useAriadneStore } from "../state/store";
import type { AlertRecord } from "../state/alertsSlice";
import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { rerouteWalkTo } from "../sim/walkDriver";
import { EstimateBadge } from "../theme/EstimateBadge";
import { hazardStateColour, StateBadge } from "../theme/StateBadge";
import { formatAlertDistance, formatAlertDuration, resolveAlertTarget } from "./alertTargets";



export type AlertStackVariant = "hud" | "map";



function formatSimClock(seconds: number): string {
    const totalMinutes = Math.floor(Math.max(seconds, 0) / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `T+${hours}:${minutes < 10 ? "0" : ""}${minutes}`;
}



function AlertCard({ alert, variant }: { alert: AlertRecord; variant: AlertStackVariant }) {
    const processedData = useAriadneStore((state) => state.processedData);
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const walkDetour = useAriadneStore((state) => state.walkDetour);
    const dismissAlert = useAriadneStore((state) => state.dismissAlert);

    if (processedData === null) {
        return null;
    }
    const position = astronautPosition ?? processedData.meta.staging_point;
    const target = resolveAlertTarget(processedData, alert, position);

    let distanceText: string | null = null;
    let timeText: string | null = null;
    if (target !== null) {
        const parameters = loadParametersFromMeta(processedData.meta.parameters);
        const factor = loadFactor(carriedLoadKg(processedData.knots, completedTaskIds, parameters), parameters);
        distanceText = formatAlertDistance(target.distance_m);
        timeText = formatAlertDuration(target.walking_time_s * factor);
    }

    const isAlreadyHeadingThere =
        target !== null && walkDetour !== null && walkDetour.target_id === target.endpoint.endpoint_id;

    function onRouteClicked() {
        if (target === null) {
            return;
        }
        void rerouteWalkTo(target.endpoint, useAriadneStore.getState().simElapsedSeconds);
    }

    let routeButtonClass = "ariadne-tap-hud w-full sm:w-auto sm:min-w-40 text-3xl";
    let cardWidthClass = "w-full";
    if (variant === "map") {
        routeButtonClass = "ariadne-tap w-full text-2xl";
        cardWidthClass = "w-full max-w-[22rem]";
    }

    const severityColour = hazardStateColour(alert.severity);

    let routeButtonText = "[ROUTE]";
    if (isAlreadyHeadingThere) {
        routeButtonText = "EN ROUTE";
    }

    return (
        <div
            className={`${cardWidthClass} flex min-w-0 flex-col gap-2 bg-ariadne-panel p-2`}
            style={{ border: `1px solid ${severityColour}` }}
            role="alert"
        >
            <div className="flex items-center gap-2">
                <StateBadge state={alert.severity} sizePx={16} />
                <span className="text-xs text-ariadne-dim">{formatSimClock(alert.created_at_sim_seconds)}</span>
                <button
                    type="button"
                    className="ml-auto min-h-8 border border-ariadne-border px-2 text-xs uppercase tracking-wider text-ariadne-muted hover:border-ariadne-accent"
                    aria-label={`Dismiss alert: ${alert.what_happened}`}
                    onClick={() => dismissAlert(alert.alert_id)}
                >
                    Dismiss
                </button>
            </div>
            <div className="text-base font-bold leading-tight text-ariadne-text">{alert.what_happened}</div>
            <div className="text-sm leading-tight text-ariadne-data">{alert.recommended_action}</div>
            {target !== null && (
                <>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-1 text-sm text-ariadne-muted">
                        <span className="min-w-0 truncate">{target.endpoint.label}:</span>
                        <span>{distanceText}, walk {timeText}</span>
                        <EstimateBadge />
                    </div>
                    <button
                        type="button"
                        className={`${routeButtonClass} ariadne-display border px-3 uppercase tracking-wider disabled:opacity-60`}
                        style={{ borderColor: "var(--color-ariadne-accent)", color: "var(--color-ariadne-accent)" }}
                        aria-label={`Route to ${target.endpoint.label}`}
                        disabled={isAlreadyHeadingThere}
                        onClick={onRouteClicked}
                    >
                        {routeButtonText}
                    </button>
                </>
            )}
        </div>
    );
}



export function AlertStack({ variant }: { variant: AlertStackVariant }) {
    const alerts = useAriadneStore((state) => state.alerts);
    const dismissedAlertIds = useAriadneStore((state) => state.dismissedAlertIds);

    const activeAlerts = alerts.filter((alert) => !dismissedAlertIds.includes(alert.alert_id)).reverse();

    if (activeAlerts.length === 0) {
        if (variant === "map") {
            return null;
        }
        return <p className="ariadne-display text-2xl text-ariadne-dim">NO ALERTS</p>;
    }

    let shownAlerts = activeAlerts;
    if (variant === "map") {
        shownAlerts = activeAlerts.slice(0, 1);
    }

    return (
        <div className="flex flex-col gap-2" aria-live="polite">
            {shownAlerts.map((alert) => (
                <AlertCard key={alert.alert_id} alert={alert} variant={variant} />
            ))}
        </div>
    );
}
