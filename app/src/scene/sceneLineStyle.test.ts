import { describe, expect, it } from "vitest";

import {
    FIRST_PERSON_LINE_LIFT_M,
    FIRST_PERSON_SCENE_LINE_STYLE,
    MAP_SCENE_LINE_STYLE,
    lineLiftM,
} from "./sceneLineStyle";



describe("lineLiftM", () => {
    it("keeps the line's own lift on the map", () => {
        expect(lineLiftM(2.5, MAP_SCENE_LINE_STYLE)).toBe(2.5);
        expect(lineLiftM(1.5, MAP_SCENE_LINE_STYLE)).toBe(1.5);
    });

    it("uses the override in first person", () => {
        expect(lineLiftM(2.5, FIRST_PERSON_SCENE_LINE_STYLE)).toBe(FIRST_PERSON_LINE_LIFT_M);
    });

    it("map style does not depth test (unchanged tablet look), first person does", () => {
        expect(MAP_SCENE_LINE_STYLE.depth_test).toBe(false);
        expect(FIRST_PERSON_SCENE_LINE_STYLE.depth_test).toBe(true);
    });

    it("first person lift stays between 0.4 and 0.8 m", () => {
        expect(FIRST_PERSON_LINE_LIFT_M).toBeGreaterThanOrEqual(0.4);
        expect(FIRST_PERSON_LINE_LIFT_M).toBeLessThanOrEqual(0.8);
    });
});
