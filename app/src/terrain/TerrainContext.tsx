// React context that shares one terrain geometry and frame with everything drawn on the terrain
// (owner: Malissa, Stage 2). scene/ provides it; layers/, thread/ and route drawing consume it.
//
// Usage inside the R3F <Canvas>:
//   <TerrainProvider processedData={data}> ...terrain mesh, overlays, lines... </TerrainProvider>
//   const { frame, geometry } = useTerrain();
//   <DrapedOverlay texture={myTexture} opacity={0.6} layerOrder={2} />

import { createContext, useContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";

import type { ProcessedData } from "../data/loadProcessed";
import type { TerrainFrame } from "./terrainFrame";
import { createTerrainFrame } from "./terrainFrame";
import { buildTerrainGeometry, DEFAULT_TERRAIN_STEP_CELLS } from "./terrainGeometry";



export interface TerrainContextValue {
    processedData: ProcessedData;
    frame: TerrainFrame;
    geometry: THREE.BufferGeometry;
}


const TerrainContext = createContext<TerrainContextValue | null>(null);



export function TerrainProvider({
    processedData,
    stepCells = DEFAULT_TERRAIN_STEP_CELLS,
    children,
}: {
    processedData: ProcessedData;
    stepCells?: number;
    children: ReactNode;
}) {
    const frame = useMemo(
        () => createTerrainFrame(processedData.meta.grid, processedData.float32Layers.heightmap),
        [processedData],
    );
    const geometry = useMemo(() => buildTerrainGeometry(frame, stepCells), [frame, stepCells]);

    useEffect(() => {
        return () => geometry.dispose();
    }, [geometry]);

    const value = useMemo(() => ({ processedData, frame, geometry }), [processedData, frame, geometry]);
    return <TerrainContext.Provider value={value}>{children}</TerrainContext.Provider>;
}


export function useTerrain(): TerrainContextValue {
    const value = useContext(TerrainContext);
    if (value === null) {
        throw new Error("useTerrain() must be used inside <TerrainProvider>");
    }
    return value;
}



// Draws a texture on the terrain surface using the shared geometry. Higher layerOrder draws on top.
// Depth writes are off and a polygon offset pulls it towards the camera, so there is no z-fighting.
export function DrapedOverlay({
    texture,
    opacity,
    layerOrder,
}: {
    texture: THREE.Texture;
    opacity: number;
    layerOrder: number;
}) {
    const { geometry } = useTerrain();
    return (
        <mesh geometry={geometry} renderOrder={layerOrder}>
            <meshBasicMaterial
                map={texture}
                transparent
                opacity={opacity}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-1 - layerOrder}
                polygonOffsetUnits={-4 - layerOrder}
                toneMapped={false}
            />
        </mesh>
    );
}
