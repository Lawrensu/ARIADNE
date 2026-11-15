// Page addresses for ARIADNE (owner: Lawrence, D-031 follow-up). One deployed app, three pages:
// "/" is the chooser, "/tablet" is the planning and navigation app, "/visor" is the helmet visor.
// Any unknown address falls back to the chooser, so a mistyped link lands on a working page.

export const CHOOSER_PAGE = "chooser";
export const TABLET_PAGE = "tablet";
export const VISOR_PAGE = "visor";

export type PageId = typeof CHOOSER_PAGE | typeof TABLET_PAGE | typeof VISOR_PAGE;

export const TABLET_PATH = "/tablet";
export const VISOR_PATH = "/visor";



export function pageForPath(pathname: string): PageId {
    if (pathname === "" || pathname === "/") {
        return CHOOSER_PAGE;
    }
    if (pathname === TABLET_PATH || pathname === `${TABLET_PATH}/`) {
        return TABLET_PAGE;
    }
    if (pathname === VISOR_PATH || pathname === `${VISOR_PATH}/`) {
        return VISOR_PAGE;
    }
    return CHOOSER_PAGE;
}
