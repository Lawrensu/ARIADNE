// Planning Table route panel (owner: Malissa, Stage 2; restyled for the mode sheets, D-031): pick two places
// (rover or Knots), choose fast / safe / smooth, see estimated walking times, and try a reroute around a
// blocked passage. Width-fluid, no outer frame and no title (the sheet supplies both).

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { ProcessedData } from "../data/loadProcessed";
import { cellFromPosition, cellIndex, isInsideGrid } from "../data/grid";
import type { RouteEndpoint, RouteOptionId, RoutePlan } from "../state/routeSlice";
import { useAriadneStore } from "../state/store";
import { EstimateBadge } from "../theme/EstimateBadge";
import { formatDistance, formatWalkingTimeEstimate } from "./formatting";
import { ROUTE_LINE_COLOURS } from "./RouteLines";
import { clearBlockedCells, planRoute, rerouteAroundBlockedCells } from "./routingService";



// Radius of the test hazard placed on the selected route, metres.
const TEST_HAZARD_RADIUS_M = 12;

const ROUTE_OPTION_LABELS: Record<RouteOptionId, string> = {
    fast: "Fast",
    safe: "Safe",
    smooth: "Smooth",
};

// Long explanations sit behind the "?" toggle, not in the segments.
const ROUTE_OPTION_HELP: Record<RouteOptionId, string> = {
    fast: "Fast: shortest walking time.",
    safe: "Safe: prefers gentle slopes, easy ground and rover line of sight.",
    smooth: "Smooth: any-angle path (Theta*).",
};

const ROUTE_OPTION_ORDER: RouteOptionId[] = ["fast", "safe", "smooth"];

const LABEL_CLASS = "text-xs uppercase tracking-widest text-ariadne-muted";

const OUTLINE_BUTTON_CLASS =
    "ariadne-tap border border-ariadne-border px-3 text-sm uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent";



export function buildRouteEndpoints(processedData: ProcessedData): RouteEndpoint[] {
    const endpoints: RouteEndpoint[] = [
        {
            endpoint_kind: "staging_point",
            endpoint_id: "staging_point",
            label: "Rover",
            position: processedData.meta.staging_point,
        },
    ];
    for (const knot of processedData.knots) {
        endpoints.push({
            endpoint_kind: "knot",
            endpoint_id: knot.knot_id,
            label: knot.name,
            position: { x_m: knot.x_m, z_m: knot.z_m },
        });
    }
    return endpoints;
}


// Cells within a radius around the middle of a route: a stand-in hazard to demonstrate rerouting.
function cellsAroundRouteMiddle(processedData: ProcessedData, plan: RoutePlan): number[] {
    const grid = processedData.meta.grid;
    const middle = plan.path_positions[Math.floor(plan.path_positions.length / 2)];
    const centreCell = cellFromPosition(grid, middle);
    const radiusCells = Math.ceil(TEST_HAZARD_RADIUS_M / grid.cell_size_m);
    const cells: number[] = [];
    for (let rowOffset = -radiusCells; rowOffset <= radiusCells; rowOffset++) {
        for (let colOffset = -radiusCells; colOffset <= radiusCells; colOffset++) {
            const row = centreCell.row + rowOffset;
            const col = centreCell.col + colOffset;
            if (isInsideGrid(grid, { row, col })) {
                const distanceM = Math.hypot(rowOffset, colOffset) * grid.cell_size_m;
                if (distanceM <= TEST_HAZARD_RADIUS_M) {
                    cells.push(cellIndex(grid, { row, col }));
                }
            }
        }
    }
    return cells;
}



// A native select: one 48 px control per place, easy to hit with a glove and compact on a phone.
function EndpointPicker({
    title,
    endpoints,
    selectedId,
    onSelect,
}: {
    title: string;
    endpoints: RouteEndpoint[];
    selectedId: string | null;
    onSelect: (endpoint: RouteEndpoint) => void;
}) {
    const onChange = (endpointId: string) => {
        const endpoint = endpoints.find((candidate) => candidate.endpoint_id === endpointId);
        if (endpoint !== undefined) {
            onSelect(endpoint);
        }
    };

    return (
        <label className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2">
            <span className={LABEL_CLASS}>{title}</span>
            <select
                className="ariadne-tap w-full min-w-0 border border-ariadne-border bg-ariadne-panel px-2 text-sm text-ariadne-text hover:border-ariadne-accent"
                value={selectedId ?? ""}
                onChange={(event) => onChange(event.target.value)}
            >
                <option value="" disabled>
                    Choose a place
                </option>
                {endpoints.map((endpoint) => (
                    <option key={endpoint.endpoint_id} value={endpoint.endpoint_id}>
                        {endpoint.label}
                    </option>
                ))}
            </select>
        </label>
    );
}


// One segment of the fast / safe / smooth control: colour key, name, and the result when there is one.
function RouteOptionSegment({ option, plan }: { option: RouteOptionId; plan: RoutePlan | undefined }) {
    const selectedRouteOption = useAriadneStore((state) => state.selectedRouteOption);
    const setSelectedRouteOption = useAriadneStore((state) => state.setSelectedRouteOption);
    const routeStatus = useAriadneStore((state) => state.routeStatus);
    const isSelected = option === selectedRouteOption;

    let className = "ariadne-tap flex min-w-0 flex-1 flex-col items-start gap-0.5 border px-2 py-1 text-left ";
    if (isSelected) {
        className += "border-ariadne-accent bg-ariadne-panel-raised";
    } else {
        className += "border-ariadne-border hover:border-ariadne-accent";
    }

    let timeText = "";
    let distanceText = "";
    if (routeStatus === "route_ready") {
        if (plan === undefined) {
            timeText = "no route";
        } else {
            timeText = formatWalkingTimeEstimate(plan.walking_time_s);
            distanceText = formatDistance(plan.horizontal_distance_m);
        }
    }

    return (
        <button type="button" className={className} aria-pressed={isSelected} onClick={() => setSelectedRouteOption(option)}>
            <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
                <span className="inline-block h-1 w-3" style={{ background: ROUTE_LINE_COLOURS[option] }} aria-hidden="true" />
                {ROUTE_OPTION_LABELS[option]}
            </span>
            {timeText !== "" && <span className="text-xs text-ariadne-data">{timeText}</span>}
            {distanceText !== "" && <span className="text-xs text-ariadne-muted">{distanceText}</span>}
        </button>
    );
}


// "?" toggle: the long explanations live behind it.
function HelpToggle({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div>
            <div className="flex items-center justify-between gap-2">
                <span className={LABEL_CLASS}>Basis</span>
                <button
                    type="button"
                    className="ariadne-tap min-w-12 border border-ariadne-border text-sm text-ariadne-muted hover:border-ariadne-accent"
                    aria-label="Route types and basis: more info"
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    ?
                </button>
            </div>
            {isOpen && <div className="border-l border-ariadne-border pl-2 text-xs text-ariadne-muted">{children}</div>}
        </div>
    );
}



export function RoutePlannerPanel() {
    const processedData = useAriadneStore((state) => state.processedData);
    const routeStart = useAriadneStore((state) => state.routeStart);
    const routeEnd = useAriadneStore((state) => state.routeEnd);
    const routePlans = useAriadneStore((state) => state.routePlans);
    const routeStatus = useAriadneStore((state) => state.routeStatus);
    const routeError = useAriadneStore((state) => state.routeError);
    const selectedRouteOption = useAriadneStore((state) => state.selectedRouteOption);
    const blockedCellIndices = useAriadneStore((state) => state.blockedCellIndices);
    const setRouteStart = useAriadneStore((state) => state.setRouteStart);
    const setRouteEnd = useAriadneStore((state) => state.setRouteEnd);

    const endpoints = useMemo(() => {
        if (processedData === null) {
            return [];
        }
        return buildRouteEndpoints(processedData);
    }, [processedData]);

    if (processedData === null) {
        return null;
    }

    const selectStart = (endpoint: RouteEndpoint) => {
        if (routeEnd !== null && routeEnd.endpoint_id !== endpoint.endpoint_id) {
            void planRoute(endpoint, routeEnd);
        } else {
            setRouteStart(endpoint);
        }
    };

    const selectEnd = (endpoint: RouteEndpoint) => {
        if (routeStart !== null && routeStart.endpoint_id !== endpoint.endpoint_id) {
            void planRoute(routeStart, endpoint);
        } else {
            setRouteEnd(endpoint);
        }
    };

    const selectedPlan = routePlans[selectedRouteOption];
    const placeTestHazard = () => {
        if (selectedPlan === undefined || routeStart === null) {
            return;
        }
        void rerouteAroundBlockedCells(routeStart.position, cellsAroundRouteMiddle(processedData, selectedPlan));
    };

    const removeTestHazards = () => {
        clearBlockedCells();
        if (routeStart !== null && routeEnd !== null) {
            void planRoute(routeStart, routeEnd);
        }
    };

    const walkingModel = processedData.layerEntries["return_field"];

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <EndpointPicker title="From" endpoints={endpoints} selectedId={routeStart?.endpoint_id ?? null} onSelect={selectStart} />
                <EndpointPicker title="To" endpoints={endpoints} selectedId={routeEnd?.endpoint_id ?? null} onSelect={selectEnd} />
            </div>

            <div className="flex gap-1" role="group" aria-label="Route type">
                {ROUTE_OPTION_ORDER.map((option) => (
                    <RouteOptionSegment key={option} option={option} plan={routePlans[option]} />
                ))}
            </div>

            {routeStatus === "computing" && <div className="text-sm text-ariadne-muted">Computing...</div>}
            {routeStatus === "no_route" && <div className="text-sm text-ariadne-no-go">NO-GO: no walkable route.</div>}
            {routeStatus === "route_failed" && <div className="text-sm text-ariadne-no-go">Routing failed: {routeError}</div>}

            {routeStatus === "route_ready" && (
                <div className="flex flex-wrap items-center gap-1">
                    <button type="button" className={OUTLINE_BUTTON_CLASS} onClick={placeTestHazard}>
                        Block mid-route
                    </button>
                    {blockedCellIndices.length > 0 && (
                        <button type="button" className={OUTLINE_BUTTON_CLASS} onClick={removeTestHazards}>
                            Clear blocks
                        </button>
                    )}
                    {blockedCellIndices.length > 0 && (
                        <span className="text-xs text-ariadne-muted">{blockedCellIndices.length} cells, D* Lite</span>
                    )}
                </div>
            )}

            <HelpToggle>
                {ROUTE_OPTION_ORDER.map((option) => (
                    <span key={option} className="block">
                        {ROUTE_OPTION_HELP[option]}
                    </span>
                ))}
                {walkingModel !== undefined && (
                    <span className="mt-1 block">
                        Times: {walkingModel.source_dataset}, Tobler x suit factor {processedData.meta.parameters?.suit_speed_factor ?? 0.6},{" "}
                        {processedData.meta.grid.cell_size_m} m grid, DTM {walkingModel.product_id}.
                        <EstimateBadge />
                    </span>
                )}
            </HelpToggle>
        </div>
    );
}
