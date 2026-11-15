import { describe, expect, it, vi } from "vitest";

import { TABLET_PATH, VISOR_PATH } from "./appRoutes";
import {
    openSideBySide,
    SIDE_BY_SIDE_BLOCKED,
    SIDE_BY_SIDE_OPENED,
    type ScreenInfo,
    type SideBySideWindow,
    VISOR_WINDOW_NAME,
    visorWindowFeatures,
} from "./sideBySide";



function fakeWindow(screen: ScreenInfo, visorOpened: boolean) {
    const assign = vi.fn();
    const open = vi.fn(() => (visorOpened ? {} : null));
    const win: SideBySideWindow = {
        open,
        location: { assign },
        screen,
    };
    return { win, open, assign };
}



describe("visorWindowFeatures", () => {
    it("puts the visor on the right half of a 1920 x 1040 screen", () => {
        const features = visorWindowFeatures({ availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040 });
        expect(features).toBe("popup,left=960,top=0,width=960,height=1040");
    });

    it("offsets the right half by availLeft on a second monitor", () => {
        const features = visorWindowFeatures({ availLeft: 1920, availTop: 0, availWidth: 1920, availHeight: 1080 });
        expect(features).toBe("popup,left=2880,top=0,width=960,height=1080");
    });

    it("rounds an odd available width down to whole pixels", () => {
        const features = visorWindowFeatures({ availLeft: 0, availTop: 0, availWidth: 1921, availHeight: 1040 });
        expect(features).toBe("popup,left=960,top=0,width=960,height=1040");
    });
});



describe("openSideBySide", () => {
    it("opens the visor on the right half and moves this tab to the tablet", () => {
        const { win, open, assign } = fakeWindow({ availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040 }, true);

        const result = openSideBySide(win);

        expect(result).toBe(SIDE_BY_SIDE_OPENED);
        expect(open).toHaveBeenCalledWith(VISOR_PATH, VISOR_WINDOW_NAME, "popup,left=960,top=0,width=960,height=1040");
        expect(assign).toHaveBeenCalledWith(TABLET_PATH);
    });

    it("treats missing availLeft and availTop as zero", () => {
        const screen = { availWidth: 1920, availHeight: 1040 } as ScreenInfo;
        const { win, open } = fakeWindow(screen, true);

        openSideBySide(win);

        expect(open).toHaveBeenCalledWith(VISOR_PATH, VISOR_WINDOW_NAME, "popup,left=960,top=0,width=960,height=1040");
    });

    it("reports blocked and does not move this tab when the popup is refused", () => {
        const { win, assign } = fakeWindow({ availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040 }, false);

        const result = openSideBySide(win);

        expect(result).toBe(SIDE_BY_SIDE_BLOCKED);
        expect(assign).not.toHaveBeenCalled();
    });
});
