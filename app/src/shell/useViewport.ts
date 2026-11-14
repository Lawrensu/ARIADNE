// Viewport helper for the responsive shell (owner: Letta, Stage 3). Media queries match the
// breakpoints in D-029: phone below 768 px, tablet 768 to 1279 px, desktop 1280 px and wider.

import { useEffect, useState } from "react";



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
}



export function useViewport(): Viewport {
    const isPhone = useMediaQuery("(max-width: 767px)");
    const isDesktop = useMediaQuery("(min-width: 1280px)");
    return { isPhone, isDesktop };
}
