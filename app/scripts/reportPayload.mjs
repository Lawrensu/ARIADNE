// Reports the size of the production build in dist/: raw bytes and gzip bytes (what a static
// host with compression sends). Budget: about 30 MB (docs/system_design.md, Performance budget).
// Run after "npm run build".

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";



const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const distDirectory = resolve(scriptDirectory, "..", "dist");
const BUDGET_MB = 30;


function listFiles(directory) {
    const files = [];
    for (const entry of readdirSync(directory)) {
        const fullPath = join(directory, entry);
        if (statSync(fullPath).isDirectory()) {
            files.push(...listFiles(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
}



let totalRawBytes = 0;
let totalGzipBytes = 0;
for (const filePath of listFiles(distDirectory)) {
    const content = readFileSync(filePath);
    const gzipBytes = gzipSync(content, { level: 6 }).length;
    totalRawBytes += content.length;
    totalGzipBytes += gzipBytes;
    const name = relative(distDirectory, filePath).replaceAll("\\", "/");
    console.log(`${name.padEnd(40)} raw ${(content.length / 1e6).toFixed(2)} MB   gzip ${(gzipBytes / 1e6).toFixed(2)} MB`);
}

const totalRawMb = totalRawBytes / 1e6;
const totalGzipMb = totalGzipBytes / 1e6;
console.log(`TOTAL raw ${totalRawMb.toFixed(2)} MB, gzip ${totalGzipMb.toFixed(2)} MB (budget about ${BUDGET_MB} MB)`);
