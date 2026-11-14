// CRT effects (owner: Letta, Stage 3): scanlines, slight curvature, grain and vignette.
// One toggle in the system menu (gear, D-031) turns all of them on or off, and they are off by
// default so the demo stays legible (D-029, system_design.md "Visual identity"). The overlay never
// takes pointer events, so taps always reach the controls underneath.

import { useAriadneStore } from "../state/store";



export function CrtOverlay() {
    const crtEffectsEnabled = useAriadneStore((state) => state.crtEffectsEnabled);

    if (!crtEffectsEnabled) {
        return null;
    }

    return (
        <div className="crt-overlay" aria-hidden="true" data-testid="crt-overlay">
            <div className="crt-scanlines" />
            <div className="crt-grain" />
            <div className="crt-vignette" />
            <div className="crt-curvature" />
        </div>
    );
}
