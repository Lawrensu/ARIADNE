// Session sync between windows (owner: Lawrence, D-032). Two windows of the same browser (for example
// /tablet and /visor side by side) share one live Marswalk through one BroadcastChannel
// ("ariadne_session_v1"): same origin only, no server, nothing leaves the browser.
// Mount useSessionSync() once per page (tablet and visor). The logic is in sessionController.ts.

import { useEffect } from "react";

import { computeConsumablesState } from "../sim/clock";
import { useAriadneStore } from "../state/store";
import { sharedRealTimeMs } from "./clockAnchor";
import { createSessionController } from "./sessionController";
import type { ChannelAdapter, StoreAdapter } from "./sessionController";
import { SESSION_CHANNEL_NAME } from "./sessionMessages";
import type { SessionMessage } from "./sessionMessages";



// Housekeeping tick for heartbeat, anchors and leader checks while the page is hidden (the animation
// frame loop does not run there).
const BACKGROUND_TICK_MS = 250;



function createStoreAdapter(): StoreAdapter {
    return {
        getValue: (field) => (useAriadneStore.getState() as unknown as Record<string, unknown>)[field],
        setValues: (values) => useAriadneStore.setState(values),
        subscribe: (listener) => useAriadneStore.subscribe(listener),
        isDataReady: () => useAriadneStore.getState().processedData !== null,
        getClockLimitSeconds: () => {
            const processedData = useAriadneStore.getState().processedData;
            const parameters = processedData === null ? undefined : processedData.meta.parameters;
            return computeConsumablesState(0, parameters).suit_capability_s;
        },
    };
}


function createChannelAdapter(): ChannelAdapter {
    const channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
    return {
        post: (message: SessionMessage) => channel.postMessage(message),
        listen: (listener) => {
            channel.onmessage = (event: MessageEvent) => listener(event.data);
        },
        close: () => channel.close(),
    };
}



export function useSessionSync(): void {
    useEffect(() => {
        if (typeof BroadcastChannel === "undefined") {
            return;
        }

        const controller = createSessionController({
            windowId: useAriadneStore.getState().sessionWindowId,
            store: createStoreAdapter(),
            channel: createChannelAdapter(),
            nowMs: sharedRealTimeMs,
        });
        controller.start();

        let animationFrameId = 0;
        function onFrame(): void {
            controller.tick();
            animationFrameId = requestAnimationFrame(onFrame);
        }
        animationFrameId = requestAnimationFrame(onFrame);
        const intervalId = window.setInterval(() => controller.tick(), BACKGROUND_TICK_MS);
        window.addEventListener("pagehide", controller.stop);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.clearInterval(intervalId);
            window.removeEventListener("pagehide", controller.stop);
            controller.stop();
        };
    }, []);
}
