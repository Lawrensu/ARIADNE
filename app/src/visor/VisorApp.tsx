// ARIADNE visor (owner: Lawrence, D-032): the helmet visor view at /visor. The astronaut sees the
// terrain ahead at eye level (first-person camera) with a minimal glowing overlay: compass, three
// readings, the next step, alerts and a small minimap. The tablet view (/tablet) is the other
// format. Same data, same store, same drivers as the tablet; the visor never changes routing, the
// Thread, the plan or the walk.

import { useEffect } from "react";

import { RouteLines } from "../planning/RouteLines";
import { MarswalkCanvas } from "../scene/MarswalkCanvas";
import { SciencePlanLines } from "../science/ui/SciencePlanLines";
import { useSimClockDriver } from "../sim/clock";
import { useWalkAndScenarioDriver } from "../sim/walkDriver";
import { useAriadneStore } from "../state/store";
import { useSessionSync } from "../sync/sessionSync";
import { ThreadLine } from "../thread/ThreadLine";
import { useVisorTarget } from "./useVisorState";
import { VisorHud } from "./VisorHud";
import { VisorWorldMarkers } from "./VisorWorldMarkers";
import "./visor.css";



function VisorLoadingScreen({ message }: { message: string }) {
    return (
        <div className="visor-root flex flex-col items-center justify-center gap-2">
            <div className="visor-number text-5xl text-ariadne-accent">ARIADNE VISOR</div>
            <div className="visor-text px-4 text-center text-ariadne-muted">Loading Marswalk data: {message}</div>
        </div>
    );
}


function VisorErrorScreen({ error }: { error: string }) {
    return (
        <div className="visor-root flex flex-col items-center justify-center gap-2 p-4 text-center">
            <div className="visor-number text-5xl text-ariadne-accent">ARIADNE VISOR</div>
            <div className="text-ariadne-no-go">Could not load the Marswalk data.</div>
            <div className="max-w-xl text-sm text-ariadne-muted">{error}</div>
            <a className="visor-chip mt-2" href="/tablet">
                TABLET
            </a>
        </div>
    );
}



// Mounted once the data is loaded: the drivers need processedData, like MainView in App.tsx.
function VisorMain() {
    useSimClockDriver();
    useWalkAndScenarioDriver();
    useSessionSync();

    const target = useVisorTarget();

    return (
        <div className="visor-root">
            <div className="visor-world">
                <MarswalkCanvas cameraKind="first_person">
                    <ThreadLine />
                    <SciencePlanLines />
                    <RouteLines />
                    <VisorWorldMarkers target={target} />
                </MarswalkCanvas>
            </div>
            <div className="visor-vignette" aria-hidden="true" />
            <div className="visor-edge" aria-hidden="true" />
            <VisorHud target={target} />
        </div>
    );
}



export function VisorApp() {
    const dataLoadStatus = useAriadneStore((state) => state.dataLoadStatus);
    const dataLoadMessage = useAriadneStore((state) => state.dataLoadMessage);
    const dataLoadError = useAriadneStore((state) => state.dataLoadError);
    const processedData = useAriadneStore((state) => state.processedData);
    const loadProcessedData = useAriadneStore((state) => state.loadProcessedData);

    useEffect(() => {
        void loadProcessedData();
    }, [loadProcessedData]);

    if (dataLoadStatus === "load_failed") {
        return <VisorErrorScreen error={dataLoadError ?? "Unknown error"} />;
    }
    if (processedData === null) {
        return <VisorLoadingScreen message={dataLoadMessage} />;
    }
    return <VisorMain />;
}
