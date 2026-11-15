# Visor view (/visor)

The helmet visor display (D-032): terrain at eye level with a minimal glowing overlay. Export: `VisorApp()` from `VisorApp.tsx`; the router mounts it at `/visor`.

Files:
- `VisorApp.tsx`: loads the data, mounts the clock, walk and sync drivers once, renders the world and the HUD.
- `VisorHud.tsx`: layout of the glass overlay (header, compass, alert and minimap, next step, task, readings).
- `VisorHeader.tsx`, `VisorCompass.tsx`, `VisorReadings.tsx`, `VisorAlert.tsx`, `VisorMinimap.tsx`: the overlay pieces.
- `VisorWorldMarkers.tsx`: floating Knot, shelter and rover markers inside the canvas.
- `useVisorState.ts`: read-only hooks (target, current task, three readings) built on `hud/hudMath.ts`.
- `visorMath.ts` and `visorMath.test.ts`: pure helpers (minimap projection, bearing words, label text) and their tests.
- `visor.css`: the glass look (vignette, hairlines, glow on numbers only, 64 px buttons).

Rules: local grid only; every model value carries "est."; the visor never changes routing, the Thread, the plan or the walk numbers.
