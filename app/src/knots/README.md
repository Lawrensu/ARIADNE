# Knots (Stage 3)

Knot card and Knot list for the five science stops, plus the local copies of the Curiosity photos (D-024). The card shows the contract values from `data/processed/knots.json` exactly; it computes no science numbers.

Files:
- `KnotCard.tsx`: exports `KnotCard` (no props) and `KnotCardContent` with props `{ knot: Knot }`. `KnotCard` reads `isKnotCardOpen`, `selectedKnotId` and `processedData` from the store, finds the Knot and renders nothing when either is missing. The card is a fixed overlay (`z-50`, about 640 px wide on desktop, full width bottom sheet on phone) and closes with `setSelectedKnot(null)`.
- `KnotList.tsx`: exports `KnotList` (no props). Reads `processedData`, `completedTaskIds` and `setSelectedKnot`; shows all Knots with photo count, task count and done count.
- `knotPhotos.ts`: exports `localPhotoPath(knotId, photoIndex)` for `/knots/<knot_id>_<index>.jpg` and `photoFilesForKnots(knots)` for the expected local filenames.
- `knotPhotos.test.ts`: checks the mapping against the real `knots.json` and the files on disk, and renders the card content for every real Knot.
- `app/public/knots/`: the 14 Curiosity JPEGs and `CREDITS.md`.

Wiring for the main agent:
1. Render `<KnotCard />` once at the app root, outside the map: it is the overlay and closes itself.
2. Place `<KnotList />` in the Plan panel.
3. Opening a card calls `setSelectedKnot(knot_id)`, for example from the map markers or the list.
4. `Route here` calls `planRoute(start, knotEndpoint)` from `planning/routingService.ts`: start is the astronaut position (`"Current position"`) when set, otherwise `meta.staging_point` (`"Rover"`).
