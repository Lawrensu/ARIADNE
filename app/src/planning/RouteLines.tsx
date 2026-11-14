// Draws the fast, safe and smooth route plans from the store on the terrain (owner: Malissa, Stage 2;
// phosphor map look, D-031). All three are phosphor green and differ by dash pattern: fast long
// dashes, safe short dashes, smooth dots. Each sits on a dark casing so it reads on the green terrain.
// The selected option is drawn thick, bright and on top; the others thinner in the dimmer signal
// green. A small label stack at the route end names them.

import { Html, Line } from "@react-three/drei";
import { useMemo } from "react";

import { LINE_CASING_COLOUR, LINE_CASING_EXTRA_WIDTH_PX, LINE_CASING_OPACITY, LINE_RENDER_ORDER, MAP_COLOURS } from "../scene/mapStyle";
import { MapLabel } from "../scene/MapLabel";
import { useScreenSpaceDashes } from "../scene/useScreenSpaceDashes";
import type { RouteOptionId, RoutePlan } from "../state/routeSlice";
import { useAriadneStore } from "../state/store";
import type { TerrainFrame } from "../terrain/terrainFrame";
import { sampleTerrainSceneY } from "../terrain/terrainFrame";
import { useTerrain } from "../terrain/TerrainContext";



// Route line colours: all phosphor green on the map (visual_direction.md 6.3). Kept as a per-option
// record because the route planner panel imports it for its swatches.
export const ROUTE_LINE_COLOURS: Record<RouteOptionId, string> = {
    fast: MAP_COLOURS.phosphor_green,
    safe: MAP_COLOURS.phosphor_green,
    smooth: MAP_COLOURS.phosphor_green,
};


// Dash patterns in screen pixels (useScreenSpaceDashes keeps them constant at any zoom).
export interface RouteDashPattern {
    dash_px: number;
    gap_px: number;
}

export const ROUTE_DASH_PATTERNS: Record<RouteOptionId, RouteDashPattern> = {
    fast: { dash_px: 18, gap_px: 6 },
    safe: { dash_px: 6, gap_px: 6 },
    smooth: { dash_px: 2, gap_px: 5 },
};

export const ROUTE_LABELS: Record<RouteOptionId, string> = {
    fast: "Fast",
    safe: "Safe",
    smooth: "Smooth",
};

const ROUTE_LIFT_ABOVE_TERRAIN_M = 2.0;
const ROUTE_OPTION_DRAW_ORDER: RouteOptionId[] = ["safe", "smooth", "fast"];
const ROUTE_LABEL_ORDER: RouteOptionId[] = ["fast", "safe", "smooth"];
const SELECTED_LINE_WIDTH_PX = 4;
const UNSELECTED_LINE_WIDTH_PX = 2.5;
const LABEL_SAMPLE_WIDTH_PX = 26;



function routeScenePoints(plan: RoutePlan, frame: TerrainFrame): [number, number, number][] {
    return plan.path_positions.map((position) => {
        const y = sampleTerrainSceneY(frame, position.x_m, position.z_m) + ROUTE_LIFT_ABOVE_TERRAIN_M;
        return [position.x_m, y, position.z_m] as [number, number, number];
    });
}


function RouteLine({ plan, isSelected }: { plan: RoutePlan; isSelected: boolean }) {
    const { frame } = useTerrain();
    const points = useMemo(() => routeScenePoints(plan, frame), [plan, frame]);

    if (points.length < 2) {
        return null;
    }

    let lineWidth: number;
    let colour: string;
    let renderOffset: number;
    if (isSelected) {
        lineWidth = SELECTED_LINE_WIDTH_PX;
        colour = ROUTE_LINE_COLOURS[plan.route_option];
        renderOffset = 1;
    } else {
        lineWidth = UNSELECTED_LINE_WIDTH_PX;
        colour = MAP_COLOURS.signal_green;
        renderOffset = 0;
    }
    const pattern = ROUTE_DASH_PATTERNS[plan.route_option];

    return (
        <group>
            <Line
                points={points}
                color={LINE_CASING_COLOUR}
                lineWidth={lineWidth + LINE_CASING_EXTRA_WIDTH_PX}
                depthTest={false}
                renderOrder={LINE_RENDER_ORDER.route_casing + renderOffset}
                transparent
                opacity={LINE_CASING_OPACITY}
                toneMapped={false}
            />
            <Line
                points={points}
                color={colour}
                lineWidth={lineWidth}
                dashed
                dashSize={pattern.dash_px}
                gapSize={pattern.gap_px}
                depthTest={false}
                renderOrder={LINE_RENDER_ORDER.route_line + renderOffset}
                transparent
                opacity={1}
                toneMapped={false}
            />
        </group>
    );
}


// A short line sample in the label, so the label also teaches the dash pattern.
function DashSample({ option }: { option: RouteOptionId }) {
    const pattern = ROUTE_DASH_PATTERNS[option];
    return (
        <svg width={LABEL_SAMPLE_WIDTH_PX} height={6} viewBox={`0 0 ${LABEL_SAMPLE_WIDTH_PX} 6`} aria-hidden="true" style={{ marginRight: 5, verticalAlign: "middle" }}>
            <line
                x1={0}
                y1={3}
                x2={LABEL_SAMPLE_WIDTH_PX}
                y2={3}
                stroke="currentColor"
                strokeWidth={2.5}
                strokeDasharray={`${pattern.dash_px} ${pattern.gap_px}`}
            />
        </svg>
    );
}


// One stack of labels just left of the route end, so it never covers the destination marker's label.
function RouteEndLabels({ plans, selectedOption }: { plans: RoutePlan[]; selectedOption: RouteOptionId }) {
    const { frame } = useTerrain();
    let anchorPlan = plans.find((plan) => plan.route_option === selectedOption);
    if (anchorPlan === undefined) {
        anchorPlan = plans[0];
    }
    const lastPosition = anchorPlan.path_positions[anchorPlan.path_positions.length - 1];
    const y = sampleTerrainSceneY(frame, lastPosition.x_m, lastPosition.z_m) + ROUTE_LIFT_ABOVE_TERRAIN_M;

    return (
        <Html position={[lastPosition.x_m, y, lastPosition.z_m]} zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
            <div
                style={{
                    position: "absolute",
                    right: 16,
                    bottom: 8,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 2,
                    pointerEvents: "none",
                }}
            >
                {ROUTE_LABEL_ORDER.map((option) => {
                    const plan = plans.find((candidate) => candidate.route_option === option);
                    if (plan === undefined) {
                        return null;
                    }
                    let emphasis: "normal" | "quiet" = "quiet";
                    if (option === selectedOption) {
                        emphasis = "normal";
                    }
                    return (
                        <MapLabel key={option} emphasis={emphasis}>
                            <DashSample option={option} />
                            {ROUTE_LABELS[option]}
                        </MapLabel>
                    );
                })}
            </div>
        </Html>
    );
}



export function RouteLines() {
    const routePlans = useAriadneStore((state) => state.routePlans);
    const selectedRouteOption = useAriadneStore((state) => state.selectedRouteOption);
    const groupRef = useScreenSpaceDashes();

    const drawnPlans: RoutePlan[] = [];
    for (const option of ROUTE_OPTION_DRAW_ORDER) {
        const plan = routePlans[option];
        if (plan !== undefined && plan.path_positions.length >= 2) {
            drawnPlans.push(plan);
        }
    }

    return (
        <group ref={groupRef}>
            {drawnPlans.map((plan) => (
                <RouteLine key={plan.route_option} plan={plan} isSelected={plan.route_option === selectedRouteOption} />
            ))}
            {drawnPlans.length > 0 ? <RouteEndLabels plans={drawnPlans} selectedOption={selectedRouteOption} /> : null}
        </group>
    );
}
