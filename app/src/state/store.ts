// The app's single Zustand store (D-024: Malissa owns the shape, Letta adds slices in separate files).
//
// Each slice lives in its own file under src/state/ and exports a type and a creator:
//   dataSlice.ts        processed pipeline data and load status
//   viewSlice.ts        Planning Table or Labyrinth view, Gale context panel
//   layersSlice.ts      overlay toggles and opacity
//   routeSlice.ts       route endpoints, fast and safe route plans, blocked cells
//   simSlice.ts         simulation clock state
//   scienceSlice.ts     science plan stops and result, completed tasks (carried load, D-027)
//   uiSlice.ts          panel tab, drawer state, CRT toggle (Stage 3)
//   viewResetSlice.ts   reset-view requests for both cameras (Stage 3)
//   walkSlice.ts        astronaut position, heading and walk phase (Stage 3)
//   hudSlice.ts         Suit HUD open state and on-demand sheet (Stage 3)
//   knotsSlice.ts       selected Knot card (Stage 3)
//   alertsSlice.ts      active alerts (Stage 3)
//   scenarioSlice.ts    scripted scenario run bookkeeping (Stage 3)
//
// Never rename or remove fields of the existing slices (deprecate-only, D-012).

import { create } from "zustand";

import type { AlertsSlice } from "./alertsSlice";
import { createAlertsSlice } from "./alertsSlice";
import type { DataSlice } from "./dataSlice";
import { createDataSlice } from "./dataSlice";
import type { HudSlice } from "./hudSlice";
import { createHudSlice } from "./hudSlice";
import type { KnotsSlice } from "./knotsSlice";
import { createKnotsSlice } from "./knotsSlice";
import type { LayersSlice } from "./layersSlice";
import { createLayersSlice } from "./layersSlice";
import type { RouteSlice } from "./routeSlice";
import { createRouteSlice } from "./routeSlice";
import type { ScenarioSlice } from "./scenarioSlice";
import { createScenarioSlice } from "./scenarioSlice";
import type { ScienceSlice } from "./scienceSlice";
import { createScienceSlice } from "./scienceSlice";
import type { SimSlice } from "./simSlice";
import { createSimSlice } from "./simSlice";
import type { UiSlice } from "./uiSlice";
import { createUiSlice } from "./uiSlice";
import type { ViewResetSlice } from "./viewResetSlice";
import { createViewResetSlice } from "./viewResetSlice";
import type { ViewSlice } from "./viewSlice";
import { createViewSlice } from "./viewSlice";
import type { WalkSlice } from "./walkSlice";
import { createWalkSlice } from "./walkSlice";



export type AriadneState = DataSlice &
    ViewSlice &
    LayersSlice &
    RouteSlice &
    SimSlice &
    ScienceSlice &
    UiSlice &
    ViewResetSlice &
    WalkSlice &
    HudSlice &
    KnotsSlice &
    AlertsSlice &
    ScenarioSlice;



export const useAriadneStore = create<AriadneState>()((...args) => ({
    ...createDataSlice(...args),
    ...createViewSlice(...args),
    ...createLayersSlice(...args),
    ...createRouteSlice(...args),
    ...createSimSlice(...args),
    ...createScienceSlice(...args),
    ...createUiSlice(...args),
    ...createViewResetSlice(...args),
    ...createWalkSlice(...args),
    ...createHudSlice(...args),
    ...createKnotsSlice(...args),
    ...createAlertsSlice(...args),
    ...createScenarioSlice(...args),
}));
