// Viewport helper for the responsive shell (owner: Letta, Stage 3; sheet breakpoint added in the
// redesign, D-031). Media queries match the breakpoints in D-029: phone below 768 px, tablet 768 to
// 1279 px, desktop 1280 px and wider. Mode sheets dock as a left card from 1024 px (D-031).

import { useEffect, useState } from "react";



// From this width the PLAN and DATA sheets float as a left card; below it they are bottom sheets.
export const SHEET_DOCKED_MEDIA_QUERY = "(min-width: 1024px)";



export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState<boolean>(() => window.matchMedia(query).matches);

    useEffect(() => {
        const mediaQueryList = window.matchMedia(query);
        function onChange() {
            setMatches(mediaQueryList.matches);
        }
        onChange();
        mediaQueryList.addEventListener("change", onChange);
        return () => mediaQueryList.removeEventListener("change", onChange);
    }, [query]);

    return matches;
}



export interface Viewport {
    isPhone: boolean;
    isDesktop: boolean;
    // True from 1024 px: mode sheets are a floating left card instead of a bottom sheet.
    isSheetDocked: boolean;
}



export function useViewport(): Viewport {
    const isPhone = useMediaQuery("(max-width: 767px)");
    const isDesktop = useMediaQuery("(min-width: 1280px)");
    const isSheetDocked = useMediaQuery(SHEET_DOCKED_MEDIA_QUERY);
    return { isPhone, isDesktop, isSheetDocked };
}
