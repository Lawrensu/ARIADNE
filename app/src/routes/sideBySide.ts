// Side-by-side mode for the chooser (visual_direction.md 7): the current tab becomes the tablet
// display and the visor opens as a separate window on the right half of the screen. Pure helpers
// (visorWindowFeatures) are tested in sideBySide.test.ts; openSideBySide takes the browser window
// as a parameter so the same logic can be checked without a browser.

import { TABLET_PATH, VISOR_PATH } from "./appRoutes";



export const SIDE_BY_SIDE_OPENED = "opened";
export const SIDE_BY_SIDE_BLOCKED = "blocked";
export const VISOR_WINDOW_NAME = "ariadne_visor";

export type SideBySideResult = typeof SIDE_BY_SIDE_OPENED | typeof SIDE_BY_SIDE_BLOCKED;

export interface ScreenInfo {
    availLeft?: number;
    availTop?: number;
    availWidth: number;
    availHeight: number;
}

export interface SideBySideWindow {
    open(url: string, target: string, features: string): object | null;
    location: { assign(url: string): void };
    screen: ScreenInfo;
}



export function visorWindowFeatures(screenInfo: ScreenInfo): string {
    const half = Math.floor(screenInfo.availWidth / 2);
    const left = Math.round(readAvailLeft(screenInfo) + half);
    const top = Math.round(readAvailTop(screenInfo));
    const height = Math.round(screenInfo.availHeight);
    return `popup,left=${left},top=${top},width=${half},height=${height}`;
}



export function openSideBySide(win: SideBySideWindow = window): SideBySideResult {
    const features = visorWindowFeatures(win.screen);
    const visorWindow = win.open(VISOR_PATH, VISOR_WINDOW_NAME, features);
    if (visorWindow === null) {
        return SIDE_BY_SIDE_BLOCKED;
    }
    win.location.assign(TABLET_PATH);
    return SIDE_BY_SIDE_OPENED;
}



function readAvailLeft(screenInfo: ScreenInfo): number {
    if (typeof screenInfo.availLeft === "number") {
        return screenInfo.availLeft;
    }
    return 0;
}



function readAvailTop(screenInfo: ScreenInfo): number {
    if (typeof screenInfo.availTop === "number") {
        return screenInfo.availTop;
    }
    return 0;
}
