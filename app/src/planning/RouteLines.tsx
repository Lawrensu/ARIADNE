// Draws the fast, safe and smooth route plans from the store on the terrain (owner: Malissa, Stage 2).
// The selected option is drawn thick and on top; the other one thin, so both stay comparable.

import { Line } from "@react-three/drei";
import { useMemo } from "react";

import type { RouteOptionId, RoutePlan } from "../state/routeSlice";
import { useAriadneStore } from "../state/store";
import { useTerrain } from "../terrain/TerrainContext";
import { sampleTerrainSceneY } from "../terrain/terrainFrame";



// Placeholder colours until the Stage 3 palette (Letta). Fast and safe also differ by dash pattern.
export const ROUTE_LINE_COLOURS: Record<RouteOptionId, string> = {
    fast: "#ffb347",
    safe: "#7fd1ff",
    smooth: "#9be564",
};

const ROUTE_LIFT_ABOVE_TERRAIN_M = 2.0;
const ROUTE_OPTION_DRAW_ORDER: RouteOptionId[] = ["safe", "smooth", "fast"];



function RouteLine({ plan, isSelected }: { plan: RoutePlan; isSelected: boolean }) {
    const { frame } = useTerrain();

    const points = useMemo(() => {
        return plan.path_positions.map((position) => {
            const y = sampleTerrainSceneY(frame, position.x_m, position.z_m) + ROUTE_LIFT_ABOVE_TERRAIN_M;
            return [position.x_m, y, position.z_m] as [number, number, number];
        });
    }, [plan, frame]);

    if (points.length < 2) {
        return null;
    }

    let lineWidth: number;
    if (isSelected) {
        lineWidth = 5;
    } else {
        lineWidth = 2;
    }

    let isDashed: boolean;
    if (plan.route_option === "safe") {
        isDashed = true;
    } else {
        isDashed = false;
    }

    return (
        <Line
            points={points}
            color={ROUTE_LINE_COLOURS[plan.route_option]}
            lineWidth={lineWidth}
            dashed={isDashed}
            dashSize={12}
            gapSize={6}
            depthTest={false}
            renderOrder={isSelected ? 31 : 30}
            transparent
            opacity={isSelected ? 1 : 0.7}
        />
    );
}



export function RouteLines() {
    const routePlans = useAriadneStore((state) => state.routePlans);
    const selectedRouteOption = useAriadneStore((state) => state.selectedRouteOption);

    return (
        <group>
            {ROUTE_OPTION_DRAW_ORDER.map((option) => {
                const plan = routePlans[option];
                if (plan === undefined) {
                    return null;
                }
                return <RouteLine key={option} plan={plan} isSelected={option === selectedRouteOption} />;
            })}
        </group>
    );
}
