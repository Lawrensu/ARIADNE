// The "phosphor hologram" terrain material (visual_direction.md 6.3): a small ShaderMaterial that
// recolours the HiRISE photo per pixel on the GPU. The maths and every constant come from
// phosphorTerrain.ts (tested there); the GLSL functions below have the same names as their twins.
//
// Nothing new is downloaded: the shader reads the HiRISE texture that was already loaded and a
// one-byte-per-cell no-go mask built once from traversal_penalty (about 1 MB, a few ms).

import * as THREE from "three";

import type { GridDefinition } from "../data/contracts";
import type { LuminanceStretch, RgbBytes } from "./phosphorTerrain";
import {
    GRID_FADE_END_PX,
    GRID_FADE_START_PX,
    GRID_LINE_WIDTH_PX,
    GRID_OPACITY,
    GRID_RGB,
    GRID_SPACING_M,
    HATCH_BASE_PERIOD_M,
    HATCH_LINE_WIDTH_PX,
    HATCH_OPACITY,
    HATCH_RGB,
    HATCH_TARGET_PERIOD_PX,
    NO_GO_BRIGHT_RGB,
    NO_GO_DARK_RGB,
    NO_GO_MASK_THRESHOLD,
    RELIEF_SHADE_MAX,
    RELIEF_SHADE_MIN,
    RELIEF_SHADE_STRENGTH,
    WALKABLE_BRIGHT_RGB,
    WALKABLE_DARK_RGB,
    buildNoGoMaskSouthRowFirst,
    rgbBytesToUnit,
} from "./phosphorTerrain";



const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;


const FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uHiriseMap;
uniform sampler2D uNoGoMask;
uniform float uLuminanceLow;
uniform float uLuminanceHigh;
uniform vec3 uWalkableDark;
uniform vec3 uWalkableBright;
uniform vec3 uNoGoDark;
uniform vec3 uNoGoBright;
uniform vec3 uHatchColour;
uniform float uHatchOpacity;
uniform float uHatchLineWidthPx;
uniform float uHatchTargetPeriodPx;
uniform float uHatchBasePeriodM;
uniform vec3 uGridColour;
uniform float uGridOpacity;
uniform float uGridSpacingM;
uniform float uGridLineWidthPx;
uniform float uGridFadeStartPx;
uniform float uGridFadeEndPx;
uniform vec3 uSunDirection;
uniform float uReliefStrength;
uniform float uReliefMin;
uniform float uReliefMax;
uniform float uNoGoThreshold;
uniform float uPixelRatio;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

float lineCoverage(float coordinateM, float periodM, float metresPerPixel, float lineWidthPx) {
    float distanceToLineM = abs(fract(coordinateM / periodM + 0.5) - 0.5) * periodM;
    float distanceToLinePx = distanceToLineM / max(metresPerPixel, 1e-6);
    float halfWidthPx = 0.5 * lineWidthPx;
    return 1.0 - smoothstep(halfWidthPx - 0.5, halfWidthPx + 0.5, distanceToLinePx);
}

float reliefShade(float sunDotNormal, float sunDotUp) {
    if (sunDotUp <= 0.0) {
        return 1.0;
    }
    float relative = max(sunDotNormal, 0.0) / sunDotUp;
    return clamp(1.0 + uReliefStrength * (relative - 1.0), uReliefMin, uReliefMax);
}

float hatchCoverage(vec3 worldPosition) {
    float coordinate = (worldPosition.x + worldPosition.z) * 0.70710678;
    float metresPerPixel = fwidth(coordinate);
    float wantedPeriodM = uHatchTargetPeriodPx * uPixelRatio * metresPerPixel;
    float level = max(log2(wantedPeriodM / uHatchBasePeriodM), 0.0);
    float levelFloor = floor(level);
    float levelBlend = level - levelFloor;
    float finePeriodM = uHatchBasePeriodM * exp2(levelFloor);
    float lineWidthPx = uHatchLineWidthPx * uPixelRatio;
    float fine = lineCoverage(coordinate, finePeriodM, metresPerPixel, lineWidthPx);
    float coarse = lineCoverage(coordinate, finePeriodM * 2.0, metresPerPixel, lineWidthPx);
    return mix(fine, coarse, levelBlend);
}

float gridCoverage(vec3 worldPosition) {
    float lineWidthPx = uGridLineWidthPx * uPixelRatio;
    float metresPerPixelX = fwidth(worldPosition.x);
    float metresPerPixelZ = fwidth(worldPosition.z);
    float alongX = lineCoverage(worldPosition.x, uGridSpacingM, metresPerPixelX, lineWidthPx);
    float alongZ = lineCoverage(worldPosition.z, uGridSpacingM, metresPerPixelZ, lineWidthPx);
    float metresPerPixel = max(metresPerPixelX, metresPerPixelZ);
    float spacingPx = uGridSpacingM / max(metresPerPixel, 1e-6) / uPixelRatio;
    float fade = smoothstep(uGridFadeStartPx, uGridFadeEndPx, spacingPx);
    return max(alongX, alongZ) * fade;
}

void main() {
    vec3 texel = texture2D(uHiriseMap, vUv).rgb;
    float luminance = dot(texel, vec3(0.2126, 0.7152, 0.0722));
    float rampPosition = clamp((luminance - uLuminanceLow) / max(uLuminanceHigh - uLuminanceLow, 1e-4), 0.0, 1.0);

    vec3 normal = normalize(vWorldNormal);
    float shade = reliefShade(dot(normal, uSunDirection), uSunDirection.y);
    rampPosition = clamp(rampPosition * shade, 0.0, 1.0);

    vec3 walkable = mix(uWalkableDark, uWalkableBright, rampPosition);
    vec3 noGoBase = mix(uNoGoDark, uNoGoBright, rampPosition);
    vec3 noGoHatched = mix(noGoBase, uHatchColour, hatchCoverage(vWorldPosition) * uHatchOpacity);

    float noGoMaskValue = texture2D(uNoGoMask, vUv).r;
    float noGoWeight = smoothstep(uNoGoThreshold - 0.15, uNoGoThreshold + 0.15, noGoMaskValue);
    vec3 ground = mix(walkable, noGoHatched, noGoWeight);

    vec3 colour = mix(ground, uGridColour, gridCoverage(vWorldPosition) * uGridOpacity);
    gl_FragColor = vec4(colour, 1.0);
}
`;



// sRGB bytes straight into a vec3 (no THREE.Color: that would convert to linear). The shader writes
// these values unchanged, so what is listed in phosphorTerrain.ts is what appears on screen.
function unitVector(color: RgbBytes): THREE.Vector3 {
    const unit = rgbBytesToUnit(color);
    return new THREE.Vector3(unit[0], unit[1], unit[2]);
}


export function createNoGoMaskTexture(grid: GridDefinition, traversalPenalty: Float32Array): THREE.DataTexture {
    const mask = buildNoGoMaskSouthRowFirst(grid, traversalPenalty);
    const texture = new THREE.DataTexture(mask, grid.width, grid.height, THREE.RedFormat, THREE.UnsignedByteType);
    // Rows are grid.width bytes long, which is not a multiple of 4.
    texture.unpackAlignment = 1;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
    return texture;
}


export interface PhosphorTerrainMaterialInput {
    hiriseTexture: THREE.Texture;
    noGoMaskTexture: THREE.Texture;
    luminanceStretch: LuminanceStretch;
    // Unit vector from the terrain towards the sun (sceneMath.sunDirectionVector).
    sunDirection: THREE.Vector3;
    pixelRatio: number;
}


export function createPhosphorTerrainMaterial(input: PhosphorTerrainMaterialInput): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
            uHiriseMap: { value: input.hiriseTexture },
            uNoGoMask: { value: input.noGoMaskTexture },
            uLuminanceLow: { value: input.luminanceStretch.low },
            uLuminanceHigh: { value: input.luminanceStretch.high },
            uWalkableDark: { value: unitVector(WALKABLE_DARK_RGB) },
            uWalkableBright: { value: unitVector(WALKABLE_BRIGHT_RGB) },
            uNoGoDark: { value: unitVector(NO_GO_DARK_RGB) },
            uNoGoBright: { value: unitVector(NO_GO_BRIGHT_RGB) },
            uHatchColour: { value: unitVector(HATCH_RGB) },
            uHatchOpacity: { value: HATCH_OPACITY },
            uHatchLineWidthPx: { value: HATCH_LINE_WIDTH_PX },
            uHatchTargetPeriodPx: { value: HATCH_TARGET_PERIOD_PX },
            uHatchBasePeriodM: { value: HATCH_BASE_PERIOD_M },
            uGridColour: { value: unitVector(GRID_RGB) },
            uGridOpacity: { value: GRID_OPACITY },
            uGridSpacingM: { value: GRID_SPACING_M },
            uGridLineWidthPx: { value: GRID_LINE_WIDTH_PX },
            uGridFadeStartPx: { value: GRID_FADE_START_PX },
            uGridFadeEndPx: { value: GRID_FADE_END_PX },
            uSunDirection: { value: input.sunDirection.clone().normalize() },
            uReliefStrength: { value: RELIEF_SHADE_STRENGTH },
            uReliefMin: { value: RELIEF_SHADE_MIN },
            uReliefMax: { value: RELIEF_SHADE_MAX },
            uNoGoThreshold: { value: NO_GO_MASK_THRESHOLD },
            uPixelRatio: { value: input.pixelRatio },
        },
    });
}
