// Loads the pipeline outputs (docs/contracts.md section 2) into one typed object.
// Order: meta.json first, then every grid layer by its meta.json layers[] entry, then the JSON files.
// Grid sizes always come from meta.json; nothing is hard-coded.
//
// The loader takes a "fetch bytes" function so the same code runs in the browser (HTTP fetch)
// and in Vitest on Node (read from disk, see loadProcessedFromDisk.ts).

import type {
    EnvironmentTimeline,
    Float32LayerId,
    Knot,
    LayerEntry,
    Meta,
    Rock,
    Shelter,
    Uint8LayerId,
} from "./contracts";
import { FLOAT32_LAYER_IDS, UINT8_LAYER_IDS } from "./contracts";



export interface ProcessedData {
    meta: Meta;
    float32Layers: Record<Float32LayerId, Float32Array>;
    uint8Layers: Record<Uint8LayerId, Uint8Array>;
    layerEntries: Record<string, LayerEntry>;
    rocks: Rock[];
    knots: Knot[];
    shelters: Shelter[];
    environmentTimeline: EnvironmentTimeline;
    textureUrl: string;
    galeContextUrl: string | null;
}


export type FetchBytes = (fileName: string) => Promise<ArrayBuffer>;


export type LoadProgress = (message: string) => void;



const SUPPORTED_CONTRACT_MAJOR_VERSION = "1";


function isPlatformLittleEndian(): boolean {
    const probe = new Uint16Array([0x0102]);
    const bytes = new Uint8Array(probe.buffer);
    return bytes[0] === 0x02;
}


// Reads raw little-endian float32 values (contracts.md 1.2). On a big-endian platform each value
// is read through a DataView so the result is still correct.
export function decodeFloat32LittleEndian(buffer: ArrayBuffer): Float32Array {
    if (isPlatformLittleEndian()) {
        return new Float32Array(buffer);
    }
    const view = new DataView(buffer);
    const values = new Float32Array(buffer.byteLength / 4);
    for (let i = 0; i < values.length; i++) {
        values[i] = view.getFloat32(i * 4, true);
    }
    return values;
}


function decodeJson<T>(buffer: ArrayBuffer): T {
    const text = new TextDecoder("utf-8").decode(buffer);
    return JSON.parse(text) as T;
}


function findLayerEntry(meta: Meta, layerId: string): LayerEntry {
    const entry = meta.layers.find((layer) => layer.layer_id === layerId);
    if (entry === undefined) {
        throw new Error(`meta.json has no layers[] entry with layer_id "${layerId}"`);
    }
    return entry;
}


function checkGridByteLength(meta: Meta, entry: LayerEntry, buffer: ArrayBuffer): void {
    let bytesPerValue: number;
    if (entry.dtype === "float32") {
        bytesPerValue = 4;
    } else {
        bytesPerValue = 1;
    }
    const expectedBytes = meta.grid.width * meta.grid.height * bytesPerValue;
    if (buffer.byteLength !== expectedBytes) {
        throw new Error(
            `${entry.file}: expected ${expectedBytes} bytes (${meta.grid.width} x ${meta.grid.height} x ${bytesPerValue}), got ${buffer.byteLength}`,
        );
    }
}


function checkContractVersion(meta: Meta): void {
    const major = meta.contract_version.split(".")[0];
    if (major !== SUPPORTED_CONTRACT_MAJOR_VERSION) {
        throw new Error(
            `meta.json contract_version ${meta.contract_version} is not supported (app expects ${SUPPORTED_CONTRACT_MAJOR_VERSION}.x)`,
        );
    }
}



export async function loadProcessedData(
    fetchBytes: FetchBytes,
    resolveUrl: (fileName: string) => string,
    onProgress: LoadProgress = () => {},
): Promise<ProcessedData> {
    onProgress("Reading meta.json");
    const meta = decodeJson<Meta>(await fetchBytes("meta.json"));
    checkContractVersion(meta);

    const layerEntries: Record<string, LayerEntry> = {};
    for (const entry of meta.layers) {
        layerEntries[entry.layer_id] = entry;
    }

    // All grids are requested at once (much faster over HTTP); progress counts finished files.
    const gridLayerCount = FLOAT32_LAYER_IDS.length + UINT8_LAYER_IDS.length;
    let finishedGridCount = 0;
    const fetchGrid = async (layerId: string): Promise<ArrayBuffer> => {
        const entry = findLayerEntry(meta, layerId);
        const buffer = await fetchBytes(entry.file);
        checkGridByteLength(meta, entry, buffer);
        finishedGridCount += 1;
        onProgress(`grid layers ${finishedGridCount} of ${gridLayerCount} (${entry.file})`);
        return buffer;
    };
    onProgress(`grid layers 0 of ${gridLayerCount}`);
    const float32Buffers = await Promise.all(FLOAT32_LAYER_IDS.map((layerId) => fetchGrid(layerId)));
    const uint8Buffers = await Promise.all(UINT8_LAYER_IDS.map((layerId) => fetchGrid(layerId)));

    const float32Layers = {} as Record<Float32LayerId, Float32Array>;
    FLOAT32_LAYER_IDS.forEach((layerId, position) => {
        float32Layers[layerId] = decodeFloat32LittleEndian(float32Buffers[position]);
    });

    const uint8Layers = {} as Record<Uint8LayerId, Uint8Array>;
    UINT8_LAYER_IDS.forEach((layerId, position) => {
        uint8Layers[layerId] = new Uint8Array(uint8Buffers[position]);
    });

    onProgress("Loading rocks, Knots, shelters and environment timeline");
    const [rocksBuffer, knotsBuffer, sheltersBuffer, timelineBuffer] = await Promise.all([
        fetchBytes("rocks.json"),
        fetchBytes("knots.json"),
        fetchBytes("shelters.json"),
        fetchBytes("environment_timeline.json"),
    ]);

    let galeContextUrl: string | null = null;
    if (meta.regional_context !== undefined) {
        galeContextUrl = resolveUrl(meta.regional_context.file);
    }

    // science_tasks is new in v1.1.0 (contracts.md 3.12); older files simply have no tasks.
    const knots = decodeJson<Knot[]>(knotsBuffer).map((knot) => {
        if (Array.isArray(knot.science_tasks)) {
            return knot;
        }
        return { ...knot, science_tasks: [] };
    });

    return {
        meta,
        float32Layers,
        uint8Layers,
        layerEntries,
        rocks: decodeJson<Rock[]>(rocksBuffer),
        knots,
        shelters: decodeJson<Shelter[]>(sheltersBuffer),
        environmentTimeline: decodeJson<EnvironmentTimeline>(timelineBuffer),
        textureUrl: resolveUrl(meta.texture.file),
        galeContextUrl,
    };
}



// Browser entry point: files are served from public/data/ (copied by scripts/copyProcessedData.mjs).
export const PROCESSED_DATA_BASE_URL = `${import.meta.env.BASE_URL}data/`;


export async function loadProcessedDataOverHttp(onProgress?: LoadProgress): Promise<ProcessedData> {
    const resolveUrl = (fileName: string) => `${PROCESSED_DATA_BASE_URL}${fileName}`;
    const fetchBytes: FetchBytes = async (fileName) => {
        const response = await fetch(resolveUrl(fileName));
        if (!response.ok) {
            throw new Error(`Could not load ${fileName}: HTTP ${response.status}. Run "npm run copy-data".`);
        }
        return response.arrayBuffer();
    };
    return loadProcessedData(fetchBytes, resolveUrl, onProgress);
}
