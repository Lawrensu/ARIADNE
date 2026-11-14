// Local paths for the Knot photos (owner: Letta, Stage 3). The images are copied into
// app/public/knots/ with their credits (CREDITS.md), so the demo never needs the network (D-024).
// The name is stable: <knot_id>_<index>.jpg, with index in the order of the photos array in
// data/processed/knots.json, starting at 1.

import type { Knot } from "../data/contracts";



// Vite serves files in app/public/ at the site root, so /knots/<file> works in dev and in the build.
const KNOTS_PUBLIC_PATH = "/knots";

const PHOTO_FILE_EXTENSION = "jpg";



export function localPhotoPath(knotId: string, photoIndex: number): string {
    return `${KNOTS_PUBLIC_PATH}/${knotId}_${photoIndex}.${PHOTO_FILE_EXTENSION}`;
}


// Every local filename the Knots need, in Knot order and photo order. The test checks this against
// the real knots.json and against the files on disk.
export function photoFilesForKnots(knots: Knot[]): string[] {
    const files: string[] = [];
    for (const knot of knots) {
        for (let photoIndex = 1; photoIndex <= knot.photos.length; photoIndex++) {
            files.push(`${knot.knot_id}_${photoIndex}.${PHOTO_FILE_EXTENSION}`);
        }
    }
    return files;
}
