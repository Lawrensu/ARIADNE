import { describe, expect, it } from "vitest";

import { CHOOSER_PAGE, pageForPath, TABLET_PAGE, VISOR_PAGE } from "./appRoutes";



describe("pageForPath", () => {
    it("shows the chooser at the root and for an empty path", () => {
        expect(pageForPath("/")).toBe(CHOOSER_PAGE);
        expect(pageForPath("")).toBe(CHOOSER_PAGE);
    });

    it("shows the tablet app at /tablet with or without a trailing slash", () => {
        expect(pageForPath("/tablet")).toBe(TABLET_PAGE);
        expect(pageForPath("/tablet/")).toBe(TABLET_PAGE);
    });

    it("shows the visor page at /visor with or without a trailing slash", () => {
        expect(pageForPath("/visor")).toBe(VISOR_PAGE);
        expect(pageForPath("/visor/")).toBe(VISOR_PAGE);
    });

    it("falls back to the chooser for any other path", () => {
        expect(pageForPath("/tablet/extra")).toBe(CHOOSER_PAGE);
        expect(pageForPath("/visor/extra")).toBe(CHOOSER_PAGE);
        expect(pageForPath("/Tablet")).toBe(CHOOSER_PAGE);
        expect(pageForPath("/unknown")).toBe(CHOOSER_PAGE);
    });
});
