// Planning Table route panel (owner: Malissa, Stage 2): pick two places (rover or Knots), see the
// fast and safe routes with estimated walking times, and try a reroute around a blocked passage.

import { useMemo } from "react";

import type { ProcessedData } from "../data/loadProcessed";
import { cellFromPosition, cellIndex, isInsideGrid } from "../data/grid";
import type { RouteEndpoint, RouteOptionId, RoutePlan } from "../state/routeSlice";
import { useAriadneStore } from "../state/store";
import { formatDistance, formatWalkingTimeEstimate } from "./formatting";
import { ROUTE_LINE_COLOURS } from "./RouteLines";
import { clearBlockedCells, planRoute, rerouteAroundBlockedCells } from "./routingService";



// Radius of the test hazard placed on the selected route, metres.
const TEST_HAZARD_RADIUS_M = 12;

const ROUTE_OPTION_LABELS: Record<RouteOptionId, string> = {
    fast: "Fast",
    safe: "Safe",
};

const ROUTE_OPTION_DESCRIPTIONS: Record<RouteOptionId, string> = {
    fast: "shortest walking time",
    safe: "prefers gentle slopes, easy ground and rover line of sight",
};



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



function EndpointButtons({
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
    return (
        <div>
            <div className="mb-1 text-xs uppercase tracking-widest text-ariadne-muted">{title}</div>
            <div className="grid grid-cols-2 gap-1">
                {endpoints.map((endpoint) => {
                    const isSelected = endpoint.endpoint_id === selectedId;
                    let className = "min-h-12 rounded border px-2 text-left text-sm ";
                    if (isSelected) {
                        className += "border-ariadne-accent bg-ariadne-accent text-ariadne-background";
                    } else {
                        className += "border-ariadne-border bg-ariadne-panel hover:border-ariadne-accent";
                    }
                    return (
                        <button key={endpoint.endpoint_id} type="button" className={className} onClick={() => onSelect(endpoint)}>
                            {endpoint.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}


function RouteOptionRow({ option, plan }: { option: RouteOptionId; plan: RoutePlan | undefined }) {
    const selectedRouteOption = useAriadneStore((state) => state.selectedRouteOption);
    const setSelectedRouteOption = useAriadneStore((state) => state.setSelectedRouteOption);
    const isSelected = option === selectedRouteOption;

    let className = "flex min-h-12 w-full items-center gap-2 rounded border px-2 text-left ";
    if (isSelected) {
        className += "border-ariadne-accent";
    } else {
        className += "border-ariadne-border";
    }

    let summary: string;
    if (plan === undefined) {
        summary = "no route";
    } else {
        summary = `${formatWalkingTimeEstimate(plan.walking_time_s)}, ${formatDistance(plan.horizontal_distance_m)}`;
    }

    return (
        <button type="button" className={className} onClick={() => setSelectedRouteOption(option)}>
            <span className="inline-block h-1 w-6" style={{ background: ROUTE_LINE_COLOURS[option] }} />
            <span className="flex-1">
                <span className="font-bold">{ROUTE_OPTION_LABELS[option]}</span>{" "}
                <span className="text-xs text-ariadne-muted">({ROUTE_OPTION_DESCRIPTIONS[option]})</span>
                <span className="block">{summary}</span>
            </span>
        </button>
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
            <EndpointButtons title="From" endpoints={endpoints} selectedId={routeStart?.endpoint_id ?? null} onSelect={selectStart} />
            <EndpointButtons title="To" endpoints={endpoints} selectedId={routeEnd?.endpoint_id ?? null} onSelect={selectEnd} />

            {routeStatus === "computing" && <div className="text-ariadne-muted">Computing routes...</div>}
            {routeStatus === "no_route" && <div className="text-ariadne-no-go">NO-GO: no walkable route between these places.</div>}
            {routeStatus === "route_failed" && <div className="text-ariadne-no-go">Routing failed: {routeError}</div>}

            {routeStatus === "route_ready" && (
                <div className="flex flex-col gap-1">
                    <RouteOptionRow option="fast" plan={routePlans.fast} />
                    <RouteOptionRow option="safe" plan={routePlans.safe} />
                    <div className="flex gap-1">
                        <button type="button" className="min-h-12 flex-1 rounded border border-ariadne-border px-2 text-sm hover:border-ariadne-accent" onClick={placeTestHazard}>
                            Block passage mid-route (test reroute)
                        </button>
                        {blockedCellIndices.length > 0 && (
                            <button type="button" className="min-h-12 rounded border border-ariadne-border px-2 text-sm hover:border-ariadne-accent" onClick={removeTestHazards}>
                                Clear blocks
                            </button>
                        )}
                    </div>
                    {blockedCellIndices.length > 0 && (
                        <div className="text-xs text-ariadne-muted">{blockedCellIndices.length} cells blocked; route replanned with D* Lite.</div>
                    )}
                </div>
            )}

            {walkingModel !== undefined && (
                <div className="text-xs text-ariadne-muted">
                    Times: {walkingModel.source_dataset}, Tobler x suit factor {processedData.meta.parameters?.suit_speed_factor ?? 0.6}, {processedData.meta.grid.cell_size_m} m grid, DTM {walkingModel.product_id}. <span className="rounded border border-ariadne-muted px-1">est.</span>
                </div>
            )}
        </div>
    );
}
