// ARIADNE app shell (Stage 2: Malissa; Stage 3: Letta; interface redesign: Lawrence, D-031). Loads
// the processed data, then shows the full-size map between a mode tab bar (MAP, PLAN, SUIT, DATA)
// and a status bar, with the objective card, alerts, control legend and mode sheets floating over
// it (app/design/visual_direction.md section 6). SUIT shows the Suit HUD in the same area.

import { useEffect } from "react";

import { AlertStack } from "./alerts/AlertStack";
import { SuitHud } from "./hud/SuitHud";
import { KnotCard } from "./knots/KnotCard";
import { LayerOverlays, RockMarkers } from "./layers";
import { BlockedCellsOverlay } from "./planning/BlockedCellsOverlay";
import { RouteLines } from "./planning/RouteLines";
import { buildRouteEndpoints } from "./planning/RoutePlannerPanel";
import { planRoute } from "./planning/routingService";
import { AstronautMarker } from "./scene/AstronautMarker";
import type { SceneMarker } from "./scene/markers";
import { MarswalkCanvas } from "./scene/MarswalkCanvas";
import { SciencePlanLines } from "./science/ui/SciencePlanLines";
import { useSimClockDriver } from "./sim/clock";
import { useWalkAndScenarioDriver } from "./sim/walkDriver";
import { LegendSheet } from "./shell/LegendSheet";
import { MapOverlays } from "./shell/MapOverlays";
import { StatusBar } from "./shell/StatusBar";
import { TabBar } from "./shell/TabBar";
import type { RouteEndpoint } from "./state/routeSlice";
import { useAriadneStore } from "./state/store";
import { CrtOverlay } from "./theme/CrtOverlay";
import { ThreadLine } from "./thread/ThreadLine";



function LoadingScreen({ message }: { message: string }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-ariadne-background">
            <div className="ariadne-display ariadne-glow text-4xl text-ariadne-accent">ARIADNE</div>
            <div className="text-ariadne-muted">Loading Marswalk data: {message}</div>
        </div>
    );
}


function ErrorScreen({ error }: { error: string }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-ariadne-background p-4 text-center">
            <div className="ariadne-display text-4xl text-ariadne-accent">ARIADNE</div>
            <div className="text-ariadne-no-go">Could not load the Marswalk data.</div>
            <div className="max-w-xl text-sm text-ariadne-muted">{error}</div>
        </div>
    );
}



// Clicking a marker on the map: the first pick is the start, the next pick is the destination.
function selectMarkerAsRouteEndpoint(marker: SceneMarker): void {
    const state = useAriadneStore.getState();
    if (state.processedData === null) {
        return;
    }
    const endpoint: RouteEndpoint | undefined = buildRouteEndpoints(state.processedData).find(
        (candidate) => candidate.endpoint_id === marker.marker_id,
    );
    let pickedEndpoint: RouteEndpoint;
    if (endpoint !== undefined) {
        pickedEndpoint = endpoint;
    } else {
        pickedEndpoint = {
            endpoint_kind: marker.marker_kind,
            endpoint_id: marker.marker_id,
            label: marker.label,
            position: marker.position,
        };
    }

    const routeStart = state.routeStart;
    if (routeStart === null) {
        state.setRouteStart(pickedEndpoint);
        return;
    }
    if (routeStart.endpoint_id === pickedEndpoint.endpoint_id) {
        return;
    }
    void planRoute(routeStart, pickedEndpoint);
}



function MainView() {
    useSimClockDriver();
    useWalkAndScenarioDriver();

    return (
        <div className="flex h-full w-full flex-col overflow-hidden bg-ariadne-background text-ariadne-text">
            <TabBar />
            {/* The content area between the bars: the map always fills it; overlays float on top. */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
                {/* isolate: marker labels drawn as HTML by the scene keep their z-index inside the map,
                    so cards and sheets always sit above them. */}
                <main className="absolute inset-0 isolate">
                    <MarswalkCanvas onMarkerSelect={selectMarkerAsRouteEndpoint}>
                        <LayerOverlays />
                        <RockMarkers />
                        <BlockedCellsOverlay />
                        <ThreadLine />
                        <SciencePlanLines />
                        <RouteLines />
                        <AstronautMarker />
                    </MarswalkCanvas>
                </main>
                <MapOverlays />
                <SuitHud alertSlot={<AlertStack variant="hud" />} />
            </div>
            <StatusBar />
            <KnotCard />
            <LegendSheet />
            <CrtOverlay />
        </div>
    );
}



export function App() {
    const dataLoadStatus = useAriadneStore((state) => state.dataLoadStatus);
    const dataLoadMessage = useAriadneStore((state) => state.dataLoadMessage);
    const dataLoadError = useAriadneStore((state) => state.dataLoadError);
    const processedData = useAriadneStore((state) => state.processedData);
    const loadProcessedData = useAriadneStore((state) => state.loadProcessedData);

    useEffect(() => {
        void loadProcessedData();
    }, [loadProcessedData]);

    if (dataLoadStatus === "load_failed") {
        return <ErrorScreen error={dataLoadError ?? "Unknown error"} />;
    }
    if (processedData === null) {
        return <LoadingScreen message={dataLoadMessage} />;
    }
    return <MainView />;
}
