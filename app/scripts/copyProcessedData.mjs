// Copies the pipeline outputs from data/processed/ into app/public/data/ so Vite serves them.
// Runs before dev, build and test (npm "pre" scripts). The copy is git-ignored.
//
// Only the files the app reads are copied, to keep the payload inside the ~30 MB budget.
// roughness_m.bin is left out on purpose: the app does not display it and it is 3.8 MB.
// To ship another file, add it to FILES_THE_APP_READS.

import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";



const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(scriptDirectory, "..");
const processedDirectory = resolve(appDirectory, "..", "data", "processed");
const publicDataDirectory = resolve(appDirectory, "public", "data");

const FILES_THE_APP_READS = [
    "meta.json",
    "heightmap.bin",
    "slope_degrees.bin",
    "traversal_penalty.bin",
    "return_field.bin",
    "sky_view_factor.bin",
    "thermal_inertia.bin",
    "mineralogy_class.bin",
    "viewshed_rover.bin",
    "texture_hirise.jpg",
    "gale_context.jpg",
    "rocks.json",
    "knots.json",
    "shelters.json",
    "environment_timeline.json",
];



if (!existsSync(join(processedDirectory, "meta.json"))) {
    console.error(`copy-data: ${processedDirectory}/meta.json not found. Pull dev to get data/processed/.`);
    process.exit(1);
}

mkdirSync(publicDataDirectory, { recursive: true });

let totalBytes = 0;
for (const fileName of FILES_THE_APP_READS) {
    const sourcePath = join(processedDirectory, fileName);
    if (!existsSync(sourcePath)) {
        console.error(`copy-data: missing ${sourcePath}`);
        process.exit(1);
    }
    copyFileSync(sourcePath, join(publicDataDirectory, fileName));
    totalBytes += statSync(sourcePath).size;
}

console.log(`copy-data: copied ${FILES_THE_APP_READS.length} files (${(totalBytes / 1e6).toFixed(2)} MB) to public/data/`);
