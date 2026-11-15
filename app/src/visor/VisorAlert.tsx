// Visor alert banner (owner: Lawrence, D-032): the newest active alert, with the four parts of
// system_design.md "Alert anatomy": what happened, the action, distance and est. time, and a big
// [ROUTE] (rerouteWalkTo, like AlertStack). A big DISMISS hides it. Severity is colour plus shape
// plus word (StateBadge). Both buttons are 64 px.

import { formatAlertDistance, formatAlertDuration, resolveAlertTarget } from "../alerts/alertTargets";
import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { rerouteWalkTo } from "../sim/walkDriver";
import { useAriadneStore } from "../state/store";
import { EstimateBadge } from "../theme/EstimateBadge";
import { hazardStateColour, StateBadge } from "../theme/StateBadge";



export function VisorAlert() {
    const alerts = useAriadneStore((state) => state.alerts);
    const dismissedAlertIds = useAriadneStore((state) => state.dismissedAlertIds);
    const processedData = useAriadneStore((state) => state.processedData);
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const walkDetour = useAriadneStore((state) => state.walkDetour);
    const dismissAlert = useAriadneStore((state) => state.dismissAlert);

    if (processedData === null) {
        return null;
    }
    const activeAlerts = alerts.filter((alert) => !dismissedAlertIds.includes(alert.alert_id));
    if (activeAlerts.length === 0) {
        return null;
    }
    // Newest last in the store, so the newest active alert is the final one.
    const alert = activeAlerts[activeAlerts.length - 1];

    const position = astronautPosition ?? processedData.meta.staging_point;
    const target = resolveAlertTarget(processedData, alert, position);

    let distanceText = "";
    let timeText = "";
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

    const severityColour = hazardStateColour(alert.severity);
    let panelClass = "visor-panel";
    if (alert.severity === "no_go") {
        panelClass = "visor-panel visor-panel-no-go visor-alert-pulse";
    } else if (alert.severity === "caution") {
        panelClass = "visor-panel visor-panel-caution";
    }

    let routeText = "ROUTE";
    if (isAlreadyHeadingThere) {
        routeText = "EN ROUTE";
    }

    return (
        <div
            className={`${panelClass} visor-hit flex w-full min-w-0 flex-col gap-2 p-2`}
            role="alert"
            aria-label={`Alert: ${alert.what_happened}`}
        >
            <div className="flex items-center gap-2">
                <StateBadge state={alert.severity} sizePx={14} style={{ fontSize: "0.75rem", padding: "1px 6px" }} />
                <span className="visor-number text-[clamp(24px,3vw,34px)]" style={{ color: severityColour }}>
                    {alert.what_happened}
                </span>
            </div>
            <div className="visor-text text-[clamp(15px,1.6vw,18px)] font-bold leading-tight text-ariadne-text">
                {alert.recommended_action}
            </div>
            {target !== null && (
                <div className="visor-text flex flex-wrap items-center gap-x-2 text-[15px] text-ariadne-muted">
                    <span className="min-w-0 truncate">{target.endpoint.label}:</span>
                    <span>
                        {distanceText}, walk {timeText}
                    </span>
                    <EstimateBadge />
                </div>
            )}
            <div className="grid grid-cols-2 gap-2">
                {target !== null ? (
                    <button
                        type="button"
                        className="visor-button"
                        aria-label={`Route to ${target.endpoint.label}`}
                        disabled={isAlreadyHeadingThere}
                        onClick={onRouteClicked}
                    >
                        {routeText}
                    </button>
                ) : (
                    <span aria-hidden="true" />
                )}
                <button
                    type="button"
                    className="visor-button visor-button-quiet"
                    aria-label={`Dismiss alert: ${alert.what_happened}`}
                    onClick={() => dismissAlert(alert.alert_id)}
                >
                    DISMISS
                </button>
            </div>
        </div>
    );
}
