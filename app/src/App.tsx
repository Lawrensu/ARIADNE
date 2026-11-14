// ARIADNE app shell (Stage 2: Malissa; Stage 3 shell, tabs and CRT: Letta). Loads the processed
// data, then shows the Planning Table or the Labyrinth view with the status strip, the icon rail and
// the tabbed side panel. Stage 3 adds the Suit HUD, alerts and Knot cards alongside this shell.

import { useEffect } from "react";

import { LayerOverlays, RockMarkers } from "./layers";
import { BlockedCellsOverlay } from "./planning/BlockedCellsOverlay";
import { RouteLines } from "./planning/RouteLines";
import { buildRouteEndpoints } from "./planning/RoutePlannerPanel";
import { planRoute } from "./planning/routingService";
import { GaleContextInset } from "./scene/GaleContextInset";
import type { SceneMarker } from "./scene/markers";
import { MarswalkCanvas } from "./scene/MarswalkCanvas";
import { SciencePlanLines } from "./science/ui/SciencePlanLines";
import { useSimClockDriver } from "./sim/clock";
import { NavigationRail } from "./shell/NavigationRail";
import { SidePanel } from "./shell/SidePanel";
import { StatusStrip } from "./shell/StatusStrip";
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

    return (
        <div className="flex h-full w-full flex-col overflow-hidden bg-ariadne-background text-ariadne-text">
            <StatusStrip />
            <div className="relative flex min-h-0 flex-1">
                <NavigationRail />
                <SidePanel />
                <main className="relative min-h-0 min-w-0 flex-1">
                    <MarswalkCanvas onMarkerSelect={selectMarkerAsRouteEndpoint}>
                        <LayerOverlays />
                        <RockMarkers />
                        <BlockedCellsOverlay />
                        <ThreadLine />
                        <SciencePlanLines />
                        <RouteLines />
                    </MarswalkCanvas>
                    {/* The inset is about 260 px wide: on narrow screens it would cover the map, so it is hidden there. */}
                    <div className="absolute bottom-3 right-3 z-30 hidden xl:block">
                        <GaleContextInset />
                    </div>
                </main>
            </div>
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
