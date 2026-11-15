// Picks the page for the current address (owner: Lawrence, D-031 follow-up). Read once at start:
// navigation between pages is a plain link, which reloads the app at the new address.

import { App } from "../App";
import { VisorApp } from "../visor/VisorApp";
import { ChooserPage } from "./ChooserPage";
import { pageForPath, TABLET_PAGE, VISOR_PAGE } from "./appRoutes";



export function RouteSwitch() {
    const page = pageForPath(window.location.pathname);
    if (page === TABLET_PAGE) {
        return <App />;
    }
    if (page === VISOR_PAGE) {
        return <VisorApp />;
    }
    return <ChooserPage />;
}
