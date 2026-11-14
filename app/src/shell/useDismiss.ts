// Closes a small overlay (system menu, info popover) on Escape or on a tap outside it
// (owner: Lawrence, redesign D-031). Taps on an element matching ignoreSelector (the button that
// toggles the overlay) are left to that button, so it does not close and reopen in one tap.

import { useEffect } from "react";
import type { RefObject } from "react";



export function useDismiss(
    containerRef: RefObject<HTMLElement | null>,
    isOpen: boolean,
    onDismiss: () => void,
    ignoreSelector?: string,
): void {
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onDismiss();
            }
        }

        function onPointerDown(event: PointerEvent) {
            const container = containerRef.current;
            if (container === null) {
                return;
            }
            if (event.target instanceof Node && container.contains(event.target)) {
                return;
            }
            if (ignoreSelector !== undefined && event.target instanceof Element) {
                if (event.target.closest(ignoreSelector) !== null) {
                    return;
                }
            }
            onDismiss();
        }

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("pointerdown", onPointerDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("pointerdown", onPointerDown);
        };
    }, [containerRef, isOpen, onDismiss, ignoreSelector]);
}
