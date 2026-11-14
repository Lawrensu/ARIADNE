// The simulated astronaut as a small 3D figure standing on the terrain, for the Labyrinth view only
// (the Planning Table keeps the flat circle-with-arrow glyph in AstronautMarker.tsx). ARIADNE's own
// low-poly suited figure: helmet with a dark visor, torso, backpack, arms and legs, in the phosphor
// hologram look (visual_direction.md 6.3): flat phosphor green fill with a phosphor white outline.
// A glowing ring and a short heading arrow on the ground make the position read from far away.
//
// The figure is built from three primitives in code (no model files). It is modelled 1 unit tall,
// facing -z (north), and scaled every frame with the camera distance so it stays about the same
// size on screen (astronautFigureMath.ts). The position is simulated (Mars has no GPS).
//
// Draw calls: body fill, body outline, four limbs x (fill + outline), ground decal = 11.

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { LocalPosition } from "../data/contracts";
import type { WalkPhase } from "../state/walkSlice";
import { figureHeightForCameraDistance, figurePoseAt, headingDegToRotationY } from "./astronautFigureMath";
import { LINE_RENDER_ORDER, MAP_COLOURS } from "./mapStyle";



// Model units: the figure is 1 unit tall, feet at y = 0, front towards -z, back (backpack) to +z.
const OUTLINE_THICKNESS = 0.035;

const TORSO_SIZE = { width: 0.3, height: 0.34, depth: 0.2 };
const TORSO_CENTRE_Y = 0.62;
const BACKPACK_SIZE = { width: 0.26, height: 0.3, depth: 0.12 };
const BACKPACK_CENTRE = { y: 0.64, z: 0.16 };
const HELMET_RADIUS = 0.12;
const HELMET_CENTRE_Y = 0.88;
const VISOR_SIZE = { width: 0.17, height: 0.085, depth: 0.04 };
const VISOR_CENTRE = { y: 0.895, z: -0.105 };

const LEG_RADIUS = 0.07;
const LEG_LENGTH = 0.3;
const HIP_POSITION = { x: 0.08, y: 0.46 };
const ARM_RADIUS = 0.055;
const ARM_LENGTH = 0.24;
const SHOULDER_POSITION = { x: 0.205, y: 0.76 };

// Low-poly on purpose: few segments keep the faceted terminal look and the vertex count small.
const HELMET_WIDTH_SEGMENTS = 10;
const HELMET_HEIGHT_SEGMENTS = 7;
const CAPSULE_CAP_SEGMENTS = 2;
const CAPSULE_RADIAL_SEGMENTS = 8;

// Ground decal: dark casing, bright ring, dark casing (like map lines on their casing), plus a
// short arrow in front pointing the way the figure faces.
const RING_SEGMENTS = 40;
const RING_INNER_CASING_RADIUS = 0.26;
const RING_INNER_RADIUS = 0.29;
const RING_OUTER_RADIUS = 0.34;
const RING_OUTER_CASING_RADIUS = 0.37;
const ARROW_BASE_DISTANCE = 0.41;
const ARROW_TIP_DISTANCE = 0.57;
const ARROW_HALF_WIDTH = 0.08;

// Lift above the sampled terrain height, as a fraction of the figure height, so the feet are not
// buried where the ground under the (scaled up) figure is not flat.
const FIGURE_LIFT_FRACTION = 0.03;
// The label sits this far above the head, as a fraction of the figure height.
const LABEL_ABOVE_HEAD_FRACTION = 0.08;
const LABEL_GAP_PX = 4;

// The ground decal draws without a depth test (it is never buried or z-fighting on sloped ground),
// just above the walk trail. The figure itself is flagged transparent and drawn after every map
// line, so lines never paint over it; it still depth-tests against the terrain.
const GROUND_RENDER_ORDER = LINE_RENDER_ORDER.walk_trail + 1;
const FIGURE_RENDER_ORDER = LINE_RENDER_ORDER.walk_trail + 5;

// Fallback field of view if the active camera is not a perspective camera (view switch frame).
const FALLBACK_FOV_DEG = 40;



interface FigureGeometries {
    body_fill: THREE.BufferGeometry;
    body_outline: THREE.BufferGeometry;
    leg_fill: THREE.BufferGeometry;
    leg_outline: THREE.BufferGeometry;
    arm_fill: THREE.BufferGeometry;
    arm_outline: THREE.BufferGeometry;
    ground: THREE.BufferGeometry;
}


interface FigureMaterials {
    body_fill: THREE.MeshBasicMaterial;
    limb_fill: THREE.MeshBasicMaterial;
    outline: THREE.MeshBasicMaterial;
    ground: THREE.MeshBasicMaterial;
}



// Paints every vertex of a geometry one colour, so several parts can be merged into one mesh.
function paintGeometry(geometry: THREE.BufferGeometry, colourHex: string): THREE.BufferGeometry {
    const colour = new THREE.Color(colourHex);
    const vertexCount = geometry.getAttribute("position").count;
    const colours = new Float32Array(vertexCount * 3);
    for (let index = 0; index < vertexCount; index += 1) {
        colours[index * 3] = colour.r;
        colours[index * 3 + 1] = colour.g;
        colours[index * 3 + 2] = colour.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return geometry;
}


function mergeOrThrow(parts: THREE.BufferGeometry[], what: string): THREE.BufferGeometry {
    const merged = mergeGeometries(parts);
    for (const part of parts) {
        part.dispose();
    }
    if (merged === null) {
        throw new Error(`AstronautFigure: could not merge the ${what} geometry.`);
    }
    return merged;
}


// Torso, backpack and helmet (and the visor on the fill) as one mesh. `grow` enlarges every part
// for the outline shell; the outline has no visor and no vertex colours.
function buildBodyGeometry(grow: number, isOutline: boolean): THREE.BufferGeometry {
    const torso = new THREE.BoxGeometry(TORSO_SIZE.width + 2 * grow, TORSO_SIZE.height + 2 * grow, TORSO_SIZE.depth + 2 * grow);
    torso.translate(0, TORSO_CENTRE_Y, 0);
    const backpack = new THREE.BoxGeometry(
        BACKPACK_SIZE.width + 2 * grow,
        BACKPACK_SIZE.height + 2 * grow,
        BACKPACK_SIZE.depth + 2 * grow,
    );
    backpack.translate(0, BACKPACK_CENTRE.y, BACKPACK_CENTRE.z);
    const helmet = new THREE.SphereGeometry(HELMET_RADIUS + grow, HELMET_WIDTH_SEGMENTS, HELMET_HEIGHT_SEGMENTS);
    helmet.translate(0, HELMET_CENTRE_Y, 0);

    if (isOutline) {
        return mergeOrThrow([torso, backpack, helmet], "body outline");
    }

    const visor = new THREE.BoxGeometry(VISOR_SIZE.width, VISOR_SIZE.height, VISOR_SIZE.depth);
    visor.translate(0, VISOR_CENTRE.y, VISOR_CENTRE.z);
    // Two greens tell the parts apart without lighting: darker suit body, brighter helmet.
    return mergeOrThrow(
        [
            paintGeometry(torso, MAP_COLOURS.signal_green),
            paintGeometry(backpack, MAP_COLOURS.grid_green),
            paintGeometry(helmet, MAP_COLOURS.phosphor_green),
            paintGeometry(visor, MAP_COLOURS.screen_black),
        ],
        "body",
    );
}


// A limb hangs from its pivot (hip or shoulder) at the origin, so rotating the pivot swings it.
// The outline capsule (radius + grow) shares the fill's centre, so it is even all round.
function buildLimbGeometry(radius: number, length: number, grow: number): THREE.BufferGeometry {
    const limb = new THREE.CapsuleGeometry(radius + grow, length, CAPSULE_CAP_SEGMENTS, CAPSULE_RADIAL_SEGMENTS);
    limb.translate(0, -(length / 2 + radius), 0);
    return limb;
}


function buildRing(innerRadius: number, outerRadius: number, colourHex: string): THREE.BufferGeometry {
    const ring = new THREE.RingGeometry(innerRadius, outerRadius, RING_SEGMENTS);
    return paintGeometry(ring, colourHex);
}


// Flat on the ground (xz plane), seen from above.
function buildGroundGeometry(): THREE.BufferGeometry {
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, ARROW_TIP_DISTANCE);
    arrowShape.lineTo(ARROW_HALF_WIDTH, ARROW_BASE_DISTANCE);
    arrowShape.lineTo(-ARROW_HALF_WIDTH, ARROW_BASE_DISTANCE);
    arrowShape.closePath();
    const arrow = paintGeometry(new THREE.ShapeGeometry(arrowShape), MAP_COLOURS.phosphor_white);

    const ground = mergeOrThrow(
        [
            buildRing(RING_INNER_CASING_RADIUS, RING_INNER_RADIUS, MAP_COLOURS.screen_black),
            buildRing(RING_INNER_RADIUS, RING_OUTER_RADIUS, MAP_COLOURS.phosphor_green),
            buildRing(RING_OUTER_RADIUS, RING_OUTER_CASING_RADIUS, MAP_COLOURS.screen_black),
            arrow,
        ],
        "ground decal",
    );
    // Built in the xy plane with the arrow towards +y; laying it down maps +y to -z (the front).
    ground.rotateX(-Math.PI / 2);
    return ground;
}


function buildGeometries(): FigureGeometries {
    return {
        body_fill: buildBodyGeometry(0, false),
        body_outline: buildBodyGeometry(OUTLINE_THICKNESS, true),
        leg_fill: buildLimbGeometry(LEG_RADIUS, LEG_LENGTH, 0),
        leg_outline: buildLimbGeometry(LEG_RADIUS, LEG_LENGTH, OUTLINE_THICKNESS),
        arm_fill: buildLimbGeometry(ARM_RADIUS, ARM_LENGTH, 0),
        arm_outline: buildLimbGeometry(ARM_RADIUS, ARM_LENGTH, OUTLINE_THICKNESS),
        ground: buildGroundGeometry(),
    };
}


// Unlit materials: the map has no scene lights, and flat phosphor colour is the hologram look.
// transparent with opacity 1 looks opaque but moves the figure into the pass after the map lines.
function buildMaterials(): FigureMaterials {
    return {
        body_fill: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, toneMapped: false }),
        limb_fill: new THREE.MeshBasicMaterial({
            color: MAP_COLOURS.phosphor_green,
            transparent: true,
            opacity: 1,
            toneMapped: false,
        }),
        // Inverted hull: a slightly larger shell showing only its back faces reads as an outline.
        outline: new THREE.MeshBasicMaterial({
            color: MAP_COLOURS.phosphor_white,
            side: THREE.BackSide,
            transparent: true,
            opacity: 1,
            toneMapped: false,
        }),
        ground: new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
        }),
    };
}



interface LimbProps {
    pivotRef: RefObject<THREE.Group | null>;
    pivotX: number;
    pivotY: number;
    fillGeometry: THREE.BufferGeometry;
    outlineGeometry: THREE.BufferGeometry;
    materials: FigureMaterials;
}


function Limb({ pivotRef, pivotX, pivotY, fillGeometry, outlineGeometry, materials }: LimbProps) {
    return (
        <group ref={pivotRef} position={[pivotX, pivotY, 0]}>
            <mesh geometry={fillGeometry} material={materials.limb_fill} renderOrder={FIGURE_RENDER_ORDER} />
            <mesh geometry={outlineGeometry} material={materials.outline} renderOrder={FIGURE_RENDER_ORDER} />
        </group>
    );
}



export interface AstronautFigureProps {
    position: LocalPosition;
    // Terrain height (scene y) under the position.
    groundY: number;
    headingDeg: number;
    walkPhase: WalkPhase;
    isSimPlaying: boolean;
    // Shown above the head (an HTML map label); it keeps a constant pixel size.
    label?: ReactNode;
}


export function AstronautFigure({ position, groundY, headingDeg, walkPhase, isSimPlaying, label }: AstronautFigureProps) {
    const geometries = useMemo(() => buildGeometries(), []);
    const materials = useMemo(() => buildMaterials(), []);

    useEffect(() => {
        return () => {
            for (const geometry of Object.values(geometries)) {
                geometry.dispose();
            }
            for (const material of Object.values(materials)) {
                material.dispose();
            }
        };
    }, [geometries, materials]);

    const scaledRef = useRef<THREE.Group>(null);
    const bodyRef = useRef<THREE.Group>(null);
    const groundRef = useRef<THREE.Mesh>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const labelAnchorRef = useRef<THREE.Group>(null);
    const anchorWorld = useMemo(() => new THREE.Vector3(), []);

    useFrame((state) => {
        const scaled = scaledRef.current;
        const body = bodyRef.current;
        const ground = groundRef.current;
        const labelAnchor = labelAnchorRef.current;
        if (scaled === null || body === null || ground === null || labelAnchor === null) {
            return;
        }

        anchorWorld.set(position.x_m, groundY, position.z_m);
        const distanceM = state.camera.position.distanceTo(anchorWorld);
        let fovDeg = FALLBACK_FOV_DEG;
        if (state.camera instanceof THREE.PerspectiveCamera) {
            fovDeg = state.camera.fov;
        }
        const heightM = figureHeightForCameraDistance(distanceM, fovDeg, state.size.height);
        const liftM = heightM * FIGURE_LIFT_FRACTION;

        scaled.scale.setScalar(heightM);
        scaled.position.y = liftM;
        labelAnchor.position.y = liftM + heightM * (1 + LABEL_ABOVE_HEAD_FRACTION);

        const pose = figurePoseAt(walkPhase === "walking", walkPhase === "at_knot", isSimPlaying, state.clock.elapsedTime);
        body.position.y = pose.bob_fraction;
        ground.scale.setScalar(pose.ring_scale);
        if (leftLegRef.current !== null) {
            leftLegRef.current.rotation.x = pose.left_leg_swing_rad;
        }
        if (rightLegRef.current !== null) {
            rightLegRef.current.rotation.x = -pose.left_leg_swing_rad;
        }
        if (leftArmRef.current !== null) {
            leftArmRef.current.rotation.x = pose.left_arm_swing_rad;
        }
        if (rightArmRef.current !== null) {
            rightArmRef.current.rotation.x = pose.right_arm_swing_rad;
        }
    });

    return (
        <group position={[position.x_m, groundY, position.z_m]}>
            <group ref={scaledRef} rotation={[0, headingDegToRotationY(headingDeg), 0]}>
                <mesh ref={groundRef} geometry={geometries.ground} material={materials.ground} renderOrder={GROUND_RENDER_ORDER} />
                <group ref={bodyRef}>
                    <mesh geometry={geometries.body_fill} material={materials.body_fill} renderOrder={FIGURE_RENDER_ORDER} />
                    <mesh geometry={geometries.body_outline} material={materials.outline} renderOrder={FIGURE_RENDER_ORDER} />
                    {/* Left and right as seen by the astronaut, who faces -z: their left is -x. */}
                    <Limb
                        pivotRef={leftLegRef}
                        pivotX={-HIP_POSITION.x}
                        pivotY={HIP_POSITION.y}
                        fillGeometry={geometries.leg_fill}
                        outlineGeometry={geometries.leg_outline}
                        materials={materials}
                    />
                    <Limb
                        pivotRef={rightLegRef}
                        pivotX={HIP_POSITION.x}
                        pivotY={HIP_POSITION.y}
                        fillGeometry={geometries.leg_fill}
                        outlineGeometry={geometries.leg_outline}
                        materials={materials}
                    />
                    <Limb
                        pivotRef={leftArmRef}
                        pivotX={-SHOULDER_POSITION.x}
                        pivotY={SHOULDER_POSITION.y}
                        fillGeometry={geometries.arm_fill}
                        outlineGeometry={geometries.arm_outline}
                        materials={materials}
                    />
                    <Limb
                        pivotRef={rightArmRef}
                        pivotX={SHOULDER_POSITION.x}
                        pivotY={SHOULDER_POSITION.y}
                        fillGeometry={geometries.arm_fill}
                        outlineGeometry={geometries.arm_outline}
                        materials={materials}
                    />
                </group>
            </group>
            {/* Not inside the scaled group: the label keeps its pixel size and does not turn. */}
            <group ref={labelAnchorRef}>
                {label !== undefined ? (
                    <Html zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
                        <div
                            style={{
                                position: "absolute",
                                left: 0,
                                bottom: LABEL_GAP_PX,
                                transform: "translateX(-50%)",
                                pointerEvents: "none",
                            }}
                        >
                            {label}
                        </div>
                    </Html>
                ) : null}
            </group>
        </group>
    );
}
