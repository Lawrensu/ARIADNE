// How the route, science plan and Thread lines sit in the scene, per camera (D-032 follow-up).
//
// The tablet map looks straight down (or from high above), so its lines float 1.5 to 2.5 m above the
// terrain and ignore depth: they always show on top. From the visor's eye height (1.7 m) the same
// lines would sit at eye level and show through hills, like lines hanging in the sky. In first person
// the lines hug the ground and are hidden behind hills (depth tested).
//
// MarswalkCanvas provides the style from its cameraKind; the line components read it with
// useSceneLineStyle() and use lineLiftM() for their height.

import { createContext, useContext } from "react";



// Lift above the terrain in first person. The terrain mesh has a vertex every 4 m, so a bilinear
// height sample can sit slightly under the mesh between vertices. 0.6 m clears that on bumpy ground
// and still reads as lying on the ground from eye height (1.7 m).
export const FIRST_PERSON_LINE_LIFT_M = 0.6;



export interface SceneLineStyle {
    // When not null, replaces every line's own lift above the terrain, metres.
    lift_m_override: number | null;
    // True: lines are hidden behind terrain. False: lines are drawn on top of everything.
    depth_test: boolean;
}


export const MAP_SCENE_LINE_STYLE: SceneLineStyle = { lift_m_override: null, depth_test: false };

export const FIRST_PERSON_SCENE_LINE_STYLE: SceneLineStyle = {
    lift_m_override: FIRST_PERSON_LINE_LIFT_M,
    depth_test: true,
};



export const SceneLineStyleContext = createContext<SceneLineStyle>(MAP_SCENE_LINE_STYLE);



export function useSceneLineStyle(): SceneLineStyle {
    return useContext(SceneLineStyleContext);
}


// The lift a line uses: the style's override when it has one, else the line's own default.
export function lineLiftM(defaultLiftM: number, style: SceneLineStyle): number {
    if (style.lift_m_override === null) {
        return defaultLiftM;
    }
    return style.lift_m_override;
}
