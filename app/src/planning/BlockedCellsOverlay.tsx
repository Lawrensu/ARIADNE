// Draws the cells blocked at runtime (store blockedCellIndices, for example a test hazard) on the
// terrain, so a reroute is visibly explained (owner: Malissa, Stage 2).

import { useEffect, useMemo } from "react";

import { useAriadneStore } from "../state/store";
import { DrapedOverlay, useTerrain } from "../terrain/TerrainContext";
import { createGridOverlayTexture } from "../terrain/terrainGeometry";



// Placeholder colour until the Stage 3 palette: magenta, distinct from the no-go red stripes.
const BLOCKED_CELL_RGBA: [number, number, number, number] = [230, 60, 200, 230];
// Above the layer overlays (which use orders up to about 10), below lines.
const BLOCKED_CELLS_LAYER_ORDER = 15;



export function BlockedCellsOverlay() {
    const { processedData } = useTerrain();
    const blockedCellIndices = useAriadneStore((state) => state.blockedCellIndices);
    const grid = processedData.meta.grid;

    const texture = useMemo(() => {
        if (blockedCellIndices.length === 0) {
            return null;
        }
        const rgba = new Uint8Array(grid.width * grid.height * 4);
        for (const index of blockedCellIndices) {
            rgba.set(BLOCKED_CELL_RGBA, index * 4);
        }
        return createGridOverlayTexture(grid, rgba);
    }, [blockedCellIndices, grid]);

    useEffect(() => {
        return () => {
            if (texture !== null) {
                texture.dispose();
            }
        };
    }, [texture]);

    if (texture === null) {
        return null;
    }
    return <DrapedOverlay texture={texture} opacity={1} layerOrder={BLOCKED_CELLS_LAYER_ORDER} />;
}
