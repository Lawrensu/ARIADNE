// The one shared "?" help toggle (visual_direction.md 6.1, D-031).
// The rule: labels stay short, and any longer explanation sits behind a small "?" that the user opens.
// Two shapes are exported:
//   InfoToggle: the "?" button plus its help body, for use inside a flex-wrap row (the body takes a full line).
//   InfoHeadingRow: a heading on the left, the "?" on the right, the help body underneath.
// Used by: KnotCard (Tasks), RoutePlannerPanel, SciencePlanPanel, MarsClock, ModeSheet.
import { useState } from "react";
import type { ReactNode } from "react";


const BORDERED_BUTTON_CLASS =
    "ariadne-tap min-w-12 border border-ariadne-border text-sm text-ariadne-muted hover:border-ariadne-accent";

const BOXED_GLYPH_BUTTON_CLASS =
    "flex h-12 w-12 shrink-0 items-center justify-center text-ariadne-dim hover:text-ariadne-accent";

const HELP_BODY_CLASS = "basis-full border-l border-ariadne-border pl-2 text-xs text-ariadne-muted";



export type InfoToggleButtonVariant = "bordered" | "boxed_glyph";


export interface InfoToggleProps {
    // Names what the help is about. The button reads "<label>: more info" to screen readers.
    label: string;
    children: ReactNode;
    // "bordered" (default): 48 px wide bordered "?". "boxed_glyph": 48 px target with a 24 px boxed "?".
    buttonVariant?: InfoToggleButtonVariant;
    // Pushes the button to the right end of a flex row (ml-auto).
    pushRight?: boolean;
}


export interface InfoHeadingRowProps {
    title: string;
    label: string;
    children: ReactNode;
}


interface InfoButtonProps {
    label: string;
    isOpen: boolean;
    onToggle: () => void;
    buttonVariant: InfoToggleButtonVariant;
    pushRight: boolean;
}



function InfoButton({ label, isOpen, onToggle, buttonVariant, pushRight }: InfoButtonProps) {
    let className = BORDERED_BUTTON_CLASS;
    if (buttonVariant === "boxed_glyph") {
        className = BOXED_GLYPH_BUTTON_CLASS;
    }
    if (pushRight) {
        className = `${className} ml-auto`;
    }

    let glyph: ReactNode = "?";
    if (buttonVariant === "boxed_glyph") {
        glyph = <span className="flex h-6 w-6 items-center justify-center border border-current text-xs">?</span>;
    }

    return (
        <button type="button" className={className} aria-label={`${label}: more info`} aria-expanded={isOpen} onClick={onToggle}>
            {glyph}
        </button>
    );
}


export function InfoToggle({ label, children, buttonVariant = "bordered", pushRight = false }: InfoToggleProps) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <>
            <InfoButton
                label={label}
                isOpen={isOpen}
                onToggle={() => setIsOpen(!isOpen)}
                buttonVariant={buttonVariant}
                pushRight={pushRight}
            />
            {isOpen && <div className={HELP_BODY_CLASS}>{children}</div>}
        </>
    );
}


export function InfoHeadingRow({ title, label, children }: InfoHeadingRowProps) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div>
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-widest text-ariadne-muted">{title}</span>
                <InfoButton
                    label={label}
                    isOpen={isOpen}
                    onToggle={() => setIsOpen(!isOpen)}
                    buttonVariant="bordered"
                    pushRight={false}
                />
            </div>
            {isOpen && <div className={HELP_BODY_CLASS}>{children}</div>}
        </div>
    );
}
