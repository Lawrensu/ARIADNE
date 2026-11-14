// Gale Crater regional context inset: the Viking mosaic with a clearly visible Marswalk patch marker.
// The patch is only about 20 x 19 px of the 2000 x 2000 px image, so the true rectangle is drawn
// together with a ring and crosshair lines that stay a fixed size on screen.

import { Html, OrthographicCamera } from "@react-three/drei";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import * as THREE from "three";

import type { RegionalContext } from "../data/contracts";
import { useAriadneStore } from "../state/store";
import { pixelRectToPlaneRect } from "./sceneMath";
import type { PlaneRect } from "./sceneMath";



const MARKER_COLOUR = "#e0892f";
const MARKER_BACKING_COLOUR = "#120c08";
const RING_RADIUS_PX = 13;
const RING_STROKE_PX = 2.5;
const CROSSHAIR_LENGTH_PX = 20;
const OUTLINE_STROKE_PX = 1.5;
const VIKING_SOURCE_NAME = "Viking MDIM 2.1 Colorized Global Mosaic";
const MARKER_RENDER_ORDER = 10;



// A flat rectangle (width x height) centred on a plane position, drawn above the image.
function FlatRect({
    centreX,
    centreY,
    width,
    height,
    colour,
    order,
}: {
    centreX: number;
    centreY: number;
    width: number;
    height: number;
    colour: string;
    order: number;
}) {
    return (
        <mesh position={[centreX, centreY, 1]} renderOrder={order}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial color={colour} depthTest={false} toneMapped={false} />
        </mesh>
    );
}


// Ring, crosshair and rectangle outline, sized in screen pixels (divided by the zoom to get plane units).
function PatchMarker({ patchRect, pixelsPerUnit }: { patchRect: PlaneRect; pixelsPerUnit: number }) {
    const unitsPerPx = 1 / pixelsPerUnit;
    const ringOuter = RING_RADIUS_PX * unitsPerPx;
    const ringStroke = RING_STROKE_PX * unitsPerPx;
    const crosshairLength = CROSSHAIR_LENGTH_PX * unitsPerPx;
    const crosshairStart = ringOuter + crosshairLength / 2;
    const backingExtra = 2 * unitsPerPx;

    // The rectangle outline is never thinner than OUTLINE_STROKE_PX on screen.
    const outlineStroke = OUTLINE_STROKE_PX * unitsPerPx;
    const outlineWidth = Math.max(patchRect.width, 3 * unitsPerPx);
    const outlineHeight = Math.max(patchRect.height, 3 * unitsPerPx);
    const cx = patchRect.centre_x;
    const cy = patchRect.centre_y;

    const crosshairs = [
        { x: cx, y: cy + crosshairStart, width: ringStroke, height: crosshairLength },
        { x: cx, y: cy - crosshairStart, width: ringStroke, height: crosshairLength },
        { x: cx + crosshairStart, y: cy, width: crosshairLength, height: ringStroke },
        { x: cx - crosshairStart, y: cy, width: crosshairLength, height: ringStroke },
    ];

    return (
        <group>
            {/* Dark backing under the ring and crosshair so they read on any background. */}
            <mesh position={[cx, cy, 1]} renderOrder={MARKER_RENDER_ORDER}>
                <ringGeometry args={[ringOuter - ringStroke - backingExtra, ringOuter + backingExtra, 48]} />
                <meshBasicMaterial color={MARKER_BACKING_COLOUR} depthTest={false} toneMapped={false} />
            </mesh>
            {crosshairs.map((bar, index) => (
                <FlatRect
                    key={`backing_${index}`}
                    centreX={bar.x}
                    centreY={bar.y}
                    width={bar.width + 2 * backingExtra}
                    height={bar.height + 2 * backingExtra}
                    colour={MARKER_BACKING_COLOUR}
                    order={MARKER_RENDER_ORDER}
                />
            ))}
            <mesh position={[cx, cy, 1]} renderOrder={MARKER_RENDER_ORDER + 1}>
                <ringGeometry args={[ringOuter - ringStroke, ringOuter, 48]} />
                <meshBasicMaterial color={MARKER_COLOUR} depthTest={false} toneMapped={false} />
            </mesh>
            {crosshairs.map((bar, index) => (
                <FlatRect
                    key={`bar_${index}`}
                    centreX={bar.x}
                    centreY={bar.y}
                    width={bar.width}
                    height={bar.height}
                    colour={MARKER_COLOUR}
                    order={MARKER_RENDER_ORDER + 1}
                />
            ))}
            {/* True patch rectangle outline: four thin bars. */}
            <FlatRect centreX={cx} centreY={cy + outlineHeight / 2} width={outlineWidth + outlineStroke} height={outlineStroke} colour={MARKER_COLOUR} order={MARKER_RENDER_ORDER + 2} />
            <FlatRect centreX={cx} centreY={cy - outlineHeight / 2} width={outlineWidth + outlineStroke} height={outlineStroke} colour={MARKER_COLOUR} order={MARKER_RENDER_ORDER + 2} />
            <FlatRect centreX={cx + outlineWidth / 2} centreY={cy} width={outlineStroke} height={outlineHeight + outlineStroke} colour={MARKER_COLOUR} order={MARKER_RENDER_ORDER + 2} />
            <FlatRect centreX={cx - outlineWidth / 2} centreY={cy} width={outlineStroke} height={outlineHeight + outlineStroke} colour={MARKER_COLOUR} order={MARKER_RENDER_ORDER + 2} />
            <Html position={[cx, cy - ringOuter - crosshairLength, 1]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
                <div
                    style={{
                        transform: "translateY(14px)",
                        whiteSpace: "nowrap",
                        padding: "1px 5px",
                        fontSize: 12,
                        color: "var(--color-ariadne-text)",
                        background: "rgba(18, 12, 8, 0.85)",
                        border: "1px solid var(--color-ariadne-border)",
                    }}
                >
                    Marswalk patch
                </div>
            </Html>
        </group>
    );
}


function GaleContextScene({ context, imageUrl }: { context: RegionalContext; imageUrl: string }) {
    const viewportSize = useThree((state) => state.size);
    const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
    const texture = useLoader(THREE.TextureLoader, imageUrl);

    useLayoutEffect(() => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = maxAnisotropy;
        texture.needsUpdate = true;
    }, [texture, maxAnisotropy]);

    // Fit the whole image into the panel: pixelsPerUnit is screen pixels per image pixel.
    const pixelsPerUnit = Math.min(viewportSize.width / context.width_px, viewportSize.height / context.height_px);
    const patchRect = pixelRectToPlaneRect(context.width_px, context.height_px, context.patch_rect_px);

    return (
        <>
            <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={pixelsPerUnit} near={0.1} far={100} />
            <mesh>
                <planeGeometry args={[context.width_px, context.height_px]} />
                <meshBasicMaterial map={texture} toneMapped={false} />
            </mesh>
            <PatchMarker patchRect={patchRect} pixelsPerUnit={pixelsPerUnit} />
        </>
    );
}


export function GaleContextInset() {
    const processedData = useAriadneStore((state) => state.processedData);
    const isVisible = useAriadneStore((state) => state.isGaleContextVisible);

    if (!isVisible || processedData === null) {
        return null;
    }
    const context = processedData.meta.regional_context;
    const imageUrl = processedData.galeContextUrl;
    if (context === undefined || imageUrl === null) {
        return null;
    }

    const vikingSource = processedData.meta.sources.find((source) => source.source_dataset === VIKING_SOURCE_NAME);
    let caption = "Regional context: Gale Crater";
    if (vikingSource !== undefined) {
        caption = `${vikingSource.source_dataset}. ${vikingSource.licence_credit}`;
    }

    // Fluid: as wide as the sheet, the image keeps its aspect ratio. No frame and no title:
    // the DATA sheet supplies both. Credit line and "N up" stay under the image.
    return (
        <figure className="m-0 w-full" aria-label="Gale Crater regional context">
            <div className="relative w-full border border-ariadne-border" style={{ aspectRatio: `${context.width_px} / ${context.height_px}` }}>
                <Canvas dpr={[1, 2]} flat>
                    <color attach="background" args={["#120c08"]} />
                    <GaleContextScene context={context} imageUrl={imageUrl} />
                </Canvas>
            </div>
            <figcaption className="mt-1 text-xs leading-snug text-ariadne-dim">
                <span className="uppercase tracking-wider text-ariadne-muted">N up. </span>
                {caption}
            </figcaption>
        </figure>
    );
}
