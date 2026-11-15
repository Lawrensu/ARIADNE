// The main 3D canvas: terrain, markers and the active camera (Planning Table or Labyrinth view).
// Children are rendered inside the TerrainProvider, so layer overlays, the Thread line and route
// lines can call useTerrain() and share the terrain geometry.

import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";

import { useAriadneStore } from "../state/store";
import { TerrainProvider } from "../terrain/TerrainContext";
import { FirstPersonCamera, LabyrinthCamera, PlanningTableCamera } from "./CameraRig";
import { MAP_COLOURS } from "./mapStyle";
import type { SceneMarker } from "./markers";
import { FIRST_PERSON_SCENE_LINE_STYLE, MAP_SCENE_LINE_STYLE, SceneLineStyleContext } from "./sceneLineStyle";
import { SceneMarkers } from "./SceneMarkers";
import { TerrainMesh } from "./TerrainMesh";



// "map": the Planning Table (2D) or Labyrinth view (3D) camera, from viewMode.
// "first_person": the visor's eye-level camera that walks with the astronaut (D-032).
export type MarswalkCameraKind = "map" | "first_person";


export interface MarswalkCanvasProps {
    children?: ReactNode;
    // Default "map". "first_person" renders the visor camera instead of the 2D/3D cameras and leaves
    // viewMode untouched (D-032).
    cameraKind?: MarswalkCameraKind;
    onMarkerSelect?: (marker: SceneMarker) => void;
}


export function MarswalkCanvas({ children, cameraKind = "map", onMarkerSelect }: MarswalkCanvasProps) {
    const processedData = useAriadneStore((state) => state.processedData);
    const viewMode = useAriadneStore((state) => state.viewMode);

    if (processedData === null) {
        return null;
    }

    // Lines hug the ground and hide behind hills in first person; the map keeps its floating lines.
    let lineStyle = MAP_SCENE_LINE_STYLE;
    if (cameraKind === "first_person") {
        lineStyle = FIRST_PERSON_SCENE_LINE_STYLE;
    }

    return (
        <Canvas
            dpr={[1, 2]}
            flat
            gl={{ antialias: true, stencil: true }}
            style={{ position: "absolute", inset: 0 }}
        >
            <color attach="background" args={[MAP_COLOURS.screen_black]} />
            <TerrainProvider processedData={processedData}>
                <SceneLineStyleContext.Provider value={lineStyle}>
                    <TerrainMesh />
                    <SceneMarkers onMarkerSelect={onMarkerSelect} />
                    {cameraKind === "first_person" ? (
                        <FirstPersonCamera key="first_person" />
                    ) : viewMode === "planning_table" ? (
                        <PlanningTableCamera key="planning_table" />
                    ) : (
                        <LabyrinthCamera key="labyrinth_view" />
                    )}
                    {children}
                </SceneLineStyleContext.Provider>
            </TerrainProvider>
        </Canvas>
    );
}
