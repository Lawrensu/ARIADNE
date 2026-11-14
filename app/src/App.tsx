// ARIADNE app shell (owner: Malissa, Stage 2): loads the processed data, then shows the Planning Table
// or the Labyrinth view with the side panel (view switch, routes, simulation clock and the Thread, layers).
// Stage 3 (Letta) adds the Suit HUD, alerts and Knot cards alongside this shell.

import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";

import { LayerOverlays, LayerPanel, RockMarkers } from "./layers";
import { BlockedCellsOverlay } from "./planning/BlockedCellsOverlay";
import { formatDistance } from "./planning/formatting";
import { RouteLines } from "./planning/RouteLines";
import { buildRouteEndpoints, RoutePlannerPanel } from "./planning/RoutePlannerPanel";
import { planRoute } from "./planning/routingService";
import { GaleContextInset } from "./scene/GaleContextInset";
import type { SceneMarker } from "./scene/markers";
import { MarswalkCanvas } from "./scene/MarswalkCanvas";
import { useSimClockDriver } from "./sim/clock";
import { SimClockControls } from "./sim/SimClockControls";
import type { RouteEndpoint } from "./state/routeSlice";
import type { ViewMode } from "./state/viewSlice";
import { useAriadneStore } from "./state/store";
import { computeThreadInfo } from "./thread/threadInfo";
import { THREAD_COLOR, ThreadLine } from "./thread/ThreadLine";



const VIEW_MODE_LABELS: Record<ViewMode, string> = {
    planning_table: "Planning Table",
    labyrinth_view: "Labyrinth view",
};

const VIEW_MODES: ViewMode[] = ["planning_table", "labyrinth_view"];

// The reachable area readout is refreshed once per simulated minute, not every frame.
const THREAD_AREA_REFRESH_SECONDS = 60;



function LoadingScreen({ message }: { message: string }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="text-2xl tracking-widest">ARIADNE</div>
            <div className="text-ariadne-muted">Loading Marswalk data: {message}</div>
        </div>
    );
}


function ErrorScreen({ error }: { error: string }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <div className="text-2xl tracking-widest">ARIADNE</div>
            <div className="text-ariadne-no-go">Could not load the Marswalk data.</div>
            <div className="max-w-xl text-sm text-ariadne-muted">{error}</div>
        </div>
    );
}


function PanelSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2 border-b border-ariadne-border p-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ariadne-accent">{title}</h2>
            {children}
        </section>
    );
}


function ViewSwitch() {
    const viewMode = useAriadneStore((state) => state.viewMode);
    const setViewMode = useAriadneStore((state) => state.setViewMode);
    const isGaleContextVisible = useAriadneStore((state) => state.isGaleContextVisible);
    const setGaleContextVisible = useAriadneStore((state) => state.setGaleContextVisible);

    return (
        <div className="flex flex-col gap-1">
            <div className="grid grid-cols-2 gap-1">
                {VIEW_MODES.map((mode) => {
                    let className = "min-h-12 rounded border px-2 text-sm ";
                    if (mode === viewMode) {
                        className += "border-ariadne-accent bg-ariadne-accent text-ariadne-background";
                    } else {
                        className += "border-ariadne-border bg-ariadne-panel hover:border-ariadne-accent";
                    }
                    return (
                        <button key={mode} type="button" className={className} onClick={() => setViewMode(mode)}>
                            {VIEW_MODE_LABELS[mode]}
                        </button>
                    );
                })}
            </div>
            <button
                type="button"
                className="min-h-12 rounded border border-ariadne-border bg-ariadne-panel px-2 text-sm hover:border-ariadne-accent"
                onClick={() => setGaleContextVisible(!isGaleContextVisible)}
            >
                {isGaleContextVisible ? "Hide Gale Crater context" : "Show Gale Crater context"}
            </button>
        </div>
    );
}


function ThreadSummary() {
    const processedData = useAriadneStore((state) => state.processedData);
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    const refreshKey = Math.floor(simElapsedSeconds / THREAD_AREA_REFRESH_SECONDS);

    const threadInfo = useMemo(() => {
        if (processedData === null) {
            return null;
        }
        return computeThreadInfo(processedData, refreshKey * THREAD_AREA_REFRESH_SECONDS);
    }, [processedData, refreshKey]);

    if (threadInfo === null) {
        return null;
    }
    const areaKm2 = threadInfo.reachable_area_square_metres / 1e6;
    return (
        <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
                <span className="inline-block h-1 w-6" style={{ background: THREAD_COLOR }} />
                <span>The Thread: you can still walk back to the rover from inside it.</span>
            </div>
            <div className="text-ariadne-muted">
                Area inside the Thread: est. {areaKm2.toFixed(1)} km² (updated each simulated minute).
            </div>
            <div className="text-xs text-ariadne-muted">{threadInfo.provenance}</div>
        </div>
    );
}


function StagingPointNote() {
    const processedData = useAriadneStore((state) => state.processedData);
    if (processedData === null) {
        return null;
    }
    const grid = processedData.meta.grid;
    const widthM = grid.width * grid.cell_size_m;
    const heightM = grid.height * grid.cell_size_m;
    return (
        <div className="text-xs text-ariadne-muted">
            Patch {formatDistance(widthM)} x {formatDistance(heightM)}, {grid.cell_size_m} m grid, Gale Crater (boxwork and Gediz Vallis). Rover at the staging point.
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
        <div className="flex h-full w-full">
            <aside className="flex h-full w-96 shrink-0 flex-col overflow-y-auto border-r border-ariadne-border bg-ariadne-background">
                <header className="border-b border-ariadne-border p-3">
                    <div className="text-2xl tracking-widest">ARIADNE</div>
                    <StagingPointNote />
                </header>
                <PanelSection title="View">
                    <ViewSwitch />
                </PanelSection>
                <PanelSection title="Route">
                    <RoutePlannerPanel />
                </PanelSection>
                <PanelSection title="Simulation clock and the Thread">
                    <SimClockControls />
                    <ThreadSummary />
                </PanelSection>
                <LayerPanel />
            </aside>
            <main className="relative h-full flex-1">
                <MarswalkCanvas onMarkerSelect={selectMarkerAsRouteEndpoint}>
                    <LayerOverlays />
                    <RockMarkers />
                    <BlockedCellsOverlay />
                    <ThreadLine />
                    <RouteLines />
                </MarswalkCanvas>
                <div className="absolute bottom-3 right-3 z-50">
                    <GaleContextInset />
                </div>
            </main>
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
