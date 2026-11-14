// LAYERS popover over the map (owner: Malissa, D-031 follow-up chosen by Malissa): the layer toggles,
// their colour keys and the opacity slider, without leaving MAP, so the astronaut stays in view.
// Opened by the LAYERS button in the control legend. "Full key" opens the marker and line legend.
// Bottom right above the control legend; full width on a phone. Closes on Escape or the close button.

import { useEffect } from "react";

import { LayerPanel } from "../layers";
import { useAriadneStore } from "../state/store";



const HEADER_BUTTON_CLASS =
    "flex h-12 min-w-12 shrink-0 items-center justify-center border-l border-ariadne-border px-3 text-xs uppercase tracking-wider text-ariadne-text hover:text-ariadne-accent";



export function LayersPopover() {
    const isOpen = useAriadneStore((state) => state.isLayersPopoverOpen);
    const setLayersPopoverOpen = useAriadneStore((state) => state.setLayersPopoverOpen);
    const setMapLegendOpen = useAriadneStore((state) => state.setMapLegendOpen);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setLayersPopoverOpen(false);
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, setLayersPopoverOpen]);

    if (!isOpen) {
        return null;
    }

    return (
        <section
            className="pointer-events-auto absolute bottom-[4.25rem] right-2 z-40 flex max-h-[60%] w-[calc(100%-1rem)] flex-col border border-ariadne-accent bg-ariadne-panel text-ariadne-text sm:right-3 sm:w-[19rem] lg:bottom-[5.5rem]"
            role="dialog"
            aria-label="Map layers"
        >
            <div className="flex shrink-0 items-center justify-between border-b border-ariadne-border pl-3">
                <h2 className="text-xs uppercase tracking-widest text-ariadne-accent">Layers</h2>
                <span className="flex">
                    <button type="button" className={HEADER_BUTTON_CLASS} onClick={() => setMapLegendOpen(true)}>
                        Full key
                    </button>
                    <button type="button" className={HEADER_BUTTON_CLASS} aria-label="Close layers" onClick={() => setLayersPopoverOpen(false)}>
                        ✕
                    </button>
                </span>
            </div>
            <div className="ariadne-scroll min-h-0 overflow-y-auto overflow-x-hidden p-2">
                <LayerPanel />
            </div>
        </section>
    );
}
