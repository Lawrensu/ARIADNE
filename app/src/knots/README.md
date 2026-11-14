# Knots (Stage 3)

Knot card and Knot list for the five science stops, plus the local copies of the Curiosity photos (D-024). The card shows the contract values from `data/processed/knots.json` exactly; it computes no science numbers.

Files:
- `KnotCard.tsx`: exports `KnotCard` (no props) and `KnotCardContent` with props `{ knot: Knot }`. `KnotCard` reads `isKnotCardOpen`, `selectedKnotId` and `processedData` from the store, finds the Knot and renders nothing when either is missing. The card is a fixed overlay (`z-50`, about 640 px wide on desktop, full width bottom sheet on phone, square corners, 1 px phosphor frame, dark backdrop). Layout: first photo on top with its credit line, name, science text, measurements as label/value rows with provenance, tasks with check boxes (a "?" holds the carried-load note), then `Route here` and `Close` (48 px). It closes with `setSelectedKnot(null)`, Escape or a tap on the backdrop.
- `KnotList.tsx`: exports `KnotList` (no props). Reads `processedData`, `completedTaskIds` and `setSelectedKnot`; one 48 px row per Knot with name, `done/total tasks` and a chevron. Width-fluid, no outer frame and no title (the DATA sheet supplies both).
- `knotPhotos.ts`: exports `localPhotoPath(knotId, photoIndex)` for `/knots/<knot_id>_<index>.jpg` and `photoFilesForKnots(knots)` for the expected local filenames.
- `knotPhotos.test.ts`: checks the mapping against the real `knots.json` and the files on disk, and renders the card content for every real Knot.
- `app/public/knots/`: the 14 Curiosity JPEGs and `CREDITS.md`.

Wiring for the main agent:
1. Render `<KnotCard />` once at the app root, outside the map: it is the overlay and closes itself.
2. Place `<KnotList />` in the DATA sheet (Knots section).
3. Opening a card calls `setSelectedKnot(knot_id)`, for example from the map markers or the list.
4. `Route here` calls `planRoute(start, knotEndpoint)` from `planning/routingService.ts`: start is the astronaut position (`"Current position"`) when set, otherwise `meta.staging_point` (`"Rover"`).
