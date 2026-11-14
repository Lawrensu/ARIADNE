import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Self-hosted fonts, bundled by Vite (D-029): VT323 for display, IBM Plex Mono for text and data.
// Latin subsets only. No font CDN and no network request at run time.
import "@fontsource/vt323/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-600.css";

import { App } from "./App";
import { useAriadneStore } from "./state/store";
import "./index.css";



// Development only (stripped from production builds): the store on window for debugging and demo
// rehearsal, e.g. window.__ariadneStore.getState().setSimElapsedSeconds(5 * 3600) in the console.
if (import.meta.env.DEV) {
    (window as unknown as { __ariadneStore: typeof useAriadneStore }).__ariadneStore = useAriadneStore;
}



const rootElement = document.getElementById("root");
if (rootElement === null) {
    throw new Error("index.html has no #root element");
}

createRoot(rootElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
