// The main 3D canvas: terrain, markers and the active camera (Planning Table or Labyrinth view).
// Children are rendered inside the TerrainProvider, so layer overlays, the Thread line and route
// lines can call useTerrain() and share the terrain geometry.

import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";

import { useAriadneStore } from "../state/store";
import { TerrainProvider } from "../terrain/TerrainContext";
import { LabyrinthCamera, PlanningTableCamera } from "./CameraRig";
import type { SceneMarker } from "./markers";
import { SceneMarkers } from "./SceneMarkers";
import { TerrainMesh } from "./TerrainMesh";



export interface MarswalkCanvasProps {
    children?: ReactNode;
    onMarkerSelect?: (marker: SceneMarker) => void;
}


export function MarswalkCanvas({ children, onMarkerSelect }: MarswalkCanvasProps) {
    const processedData = useAriadneStore((state) => state.processedData);
    const viewMode = useAriadneStore((state) => state.viewMode);

    if (processedData === null) {
        return null;
    }

    return (
        <Canvas
            dpr={[1, 2]}
            flat
            gl={{ antialias: true }}
            style={{ position: "absolute", inset: 0 }}
        >
            <color attach="background" args={["#050a06"]} />
            <TerrainProvider processedData={processedData}>
                <TerrainMesh />
                <SceneMarkers onMarkerSelect={onMarkerSelect} />
                {viewMode === "planning_table" ? <PlanningTableCamera key="planning_table" /> : <LabyrinthCamera key="labyrinth_view" />}
                {children}
            </TerrainProvider>
        </Canvas>
    );
}
