// Draws every visible grid overlay as a texture draped on the terrain (owner: Malissa, Stage 2).
// Render inside the scene's <TerrainProvider>, inside the R3F <Canvas>.

import { useEffect, useMemo } from "react";

import { useAriadneStore } from "../state/store";
import { createGridOverlayTexture } from "../terrain/terrainGeometry";
import { DrapedOverlay, useTerrain } from "../terrain/TerrainContext";
import type { GridOverlayLayerId } from "./overlayRgba";
import { buildOverlayRgba } from "./overlayRgba";



// Bottom to top. Higher layerOrder draws on top, so no-go is last and always readable.
// Orders start at 1 so they sit above the terrain mesh itself.
export const OVERLAY_DRAW_ORDER: GridOverlayLayerId[] = [
    "viewshed_rover",
    "mineralogy_class",
    "thermal_inertia",
    "sky_view_factor",
    "slope_degrees",
    "no_go",
];



// One overlay. Mounted only while visible: the texture is built once on mount and disposed on unmount.
function OverlayLayer({ layerId, layerOrder }: { layerId: GridOverlayLayerId; layerOrder: number }) {
    const { processedData } = useTerrain();
    const overlayOpacity = useAriadneStore((state) => state.overlayOpacity);

    const texture = useMemo(() => {
        const rgba = buildOverlayRgba(layerId, processedData);
        return createGridOverlayTexture(processedData.meta.grid, rgba);
    }, [layerId, processedData]);

    useEffect(() => {
        return () => texture.dispose();
    }, [texture]);

    return <DrapedOverlay texture={texture} opacity={overlayOpacity} layerOrder={layerOrder} />;
}



export function LayerOverlays() {
    const visibleOverlays = useAriadneStore((state) => state.visibleOverlays);

    return (
        <>
            {OVERLAY_DRAW_ORDER.map((layerId, index) => {
                if (!visibleOverlays[layerId]) {
                    return null;
                }
                return <OverlayLayer key={layerId} layerId={layerId} layerOrder={index + 1} />;
            })}
        </>
    );
}
