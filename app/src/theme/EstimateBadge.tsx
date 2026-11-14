// "est." badge (owner: Letta, Stage 3): every model-derived value carries it, both beside the
// number and inside the provenance view (system_design.md, "Never fake precision").

export function EstimateBadge({ label = "est." }: { label?: string }) {
    return (
        <span className="ml-1 shrink-0 border border-ariadne-dim px-1 text-[length:var(--ariadne-text-xs)] uppercase text-ariadne-dim">
            {label}
        </span>
    );
}
