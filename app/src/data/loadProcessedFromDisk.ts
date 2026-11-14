// Node-only loader for Vitest: reads data/processed/ straight from disk with the same parsing
// code as the browser. Never import this from browser code.

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ProcessedData } from "./loadProcessed";
import { loadProcessedData } from "./loadProcessed";



// app/src/data -> repo root -> data/processed
const thisDirectory = dirname(fileURLToPath(import.meta.url));
export const PROCESSED_DIRECTORY_ON_DISK = resolve(thisDirectory, "..", "..", "..", "data", "processed");


let cachedData: Promise<ProcessedData> | null = null;


export function loadProcessedDataFromDisk(): Promise<ProcessedData> {
    if (cachedData === null) {
        const fetchBytes = async (fileName: string) => {
            const bytes = await readFile(resolve(PROCESSED_DIRECTORY_ON_DISK, fileName));
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        };
        const resolveUrl = (fileName: string) => resolve(PROCESSED_DIRECTORY_ON_DISK, fileName);
        cachedData = loadProcessedData(fetchBytes, resolveUrl);
    }
    return cachedData;
}
