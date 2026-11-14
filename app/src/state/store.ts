// The app's single Zustand store (D-024: Malissa owns the shape, Letta adds slices in separate files).
//
// Each slice lives in its own file under src/state/ and exports a type and a creator:
//   dataSlice.ts    processed pipeline data and load status
//   viewSlice.ts    Planning Table or Labyrinth view, Gale context panel
//   layersSlice.ts  overlay toggles and opacity
//   routeSlice.ts   route endpoints, fast and safe route plans, blocked cells
//   simSlice.ts     simulation clock state
//
// EXTENSION POINT for Stage 3 (Letta):
//   1. Create src/state/<name>Slice.ts exporting `interface <Name>Slice` and
//      `const create<Name>Slice: StateCreator<AriadneState, [], [], <Name>Slice>` (copy viewSlice.ts).
//   2. Add `& <Name>Slice` to AriadneState below.
//   3. Add `...create<Name>Slice(...args),` to the create() call below.
//   Never rename or remove fields of the existing slices (deprecate-only, D-012).

import { create } from "zustand";

import type { DataSlice } from "./dataSlice";
import { createDataSlice } from "./dataSlice";
import type { LayersSlice } from "./layersSlice";
import { createLayersSlice } from "./layersSlice";
import type { RouteSlice } from "./routeSlice";
import { createRouteSlice } from "./routeSlice";
import type { SimSlice } from "./simSlice";
import { createSimSlice } from "./simSlice";
import type { ViewSlice } from "./viewSlice";
import { createViewSlice } from "./viewSlice";



export type AriadneState = DataSlice & ViewSlice & LayersSlice & RouteSlice & SimSlice;
// Stage 3 slices are added here, for example: & HudSlice & AlertsSlice



export const useAriadneStore = create<AriadneState>()((...args) => ({
    ...createDataSlice(...args),
    ...createViewSlice(...args),
    ...createLayersSlice(...args),
    ...createRouteSlice(...args),
    ...createSimSlice(...args),
    // Stage 3 slices are added here, for example: ...createHudSlice(...args),
}));
