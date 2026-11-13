# AGENTS.md

This is the single instruction file for every coding agent working in this repo (Claude Code, opencode, Codex, Cursor, and others). Read it first, completely.


## What this repo is

ARIADNE (Astronaut Route Intelligence And Data for Navigation & Exploration, "Ari") is a hackathon project for the NASA challenge "Interplanetary Survival Guide: Martian Map" (14 to 15 November 2026). It is a map and suit display for one astronaut on one ~2 × 2 km Marswalk patch in Gale Crater (boxwork / Gediz Vallis). It layers real NASA data and gives a planned route and a guaranteed way home (The Thread). The human-facing overview is `README.md`.

The three hard goals for everything you build: **light, accurate, hard to break.**


## Read order at session start

1. `AGENTS.md` (this file).
2. `docs/handoff.md`: current stage, gate checklists, known issues, next steps.
3. `docs/contracts.md`: exact file formats between stages.
4. The latest relevant entries in `docs/log/` (at least your person's file).
5. The docs your task needs (see "Doc ownership" below).

If a file is missing, say so to your human rather than guessing its content. Do not assume anything, clarify with your human if needed.


## Directory map

```
README.md                    Human-facing project page: problem, ARIADNE, site, features, scope, team, status
AGENTS.md                    This file: entry point for every agent (read order, map, ownership, protocols)
CLAUDE.md                    Contains only "@AGENTS.md" (Claude Code import)
.gitignore                   Git ignore rules (raw data, Python/Node artefacts, env files)
docs/
  system_design.md           Architecture, local grid, components, data flow, algorithms, folder layout
  development_conventions.md Code, doc and git conventions
  design_principles.md       UX principles and visual identity
  contracts.md               Exact file formats between stages (source of truth for data formats)
  data_sources.md            Every dataset: product ID, URL, resolution, licence, processing, status
  decisions.md               Append-only decision log
  handoff.md                 Current stage, gate checklists, known issues, next steps
  stage_0_guide.md           Stage 0 prep, session agenda and proposals (working guide, not a source of truth)
  log/
    person_a.md              End-of-session entries from Person A's agents
    person_b.md              End-of-session entries from Person B's agents
    person_c.md              End-of-session entries from Person C's agents
pipeline/                    Person A: Python (uv) data and algorithms pipeline. Empty placeholder for now (.gitkeep)
app/                         Persons B and C: React + Vite + TypeScript + React Three Fiber app. Empty placeholder for now (.gitkeep)
data/
  raw/                       Downloaded source data (git-ignored) (.gitkeep)
  processed/                 Pipeline outputs per contracts.md; sharing method TBD (Stage 0) (.gitkeep)
```

Doc file names are lowercase snake_case, except `README.md`, `AGENTS.md` and `CLAUDE.md`.


## Doc ownership

1. `README.md`
   - Source of truth for: public project description (problem, idea, site, features, scope, team, status).
   - Read when: orienting a human or new reader.
   - Updated by: any person or their main agent.
   - Update when: scope, team, status or features change.
2. `AGENTS.md`
   - Source of truth for: agent rules (read order, directory map, ownership, workflow, protocols).
   - Read when: start of every session.
   - Updated by: proposed by the main agent, approved by a human.
   - Update when: a process, folder or rule changes.
3. `CLAUDE.md`
   - Source of truth for: nothing. It only contains `@AGENTS.md`.
   - Read when: never edited.
   - Updated by: nobody (do not add instructions here).
   - Update when: never.
4. `docs/system_design.md`
   - Source of truth for: architecture, local grid, components, data flow, algorithms, folder layout.
   - Read when: before designing or changing any component or algorithm.
   - Updated by: a person's main agent, once the matching decision is accepted.
   - Update when: a decision changes the architecture or algorithms.
5. `docs/development_conventions.md`
   - Source of truth for: code, doc and git conventions.
   - Read when: before writing any code or doc.
   - Updated by: a person's main agent, with team agreement.
   - Update when: the team agrees a convention change.
6. `docs/design_principles.md`
   - Source of truth for: UX principles, feature vocabulary, the two-view concept, colour states and visual identity.
   - Read when: before any UI or visual work.
   - Updated by: a person's main agent (usually Person C's), with team agreement.
   - Update when: a design decision is accepted.
7. `docs/contracts.md`
   - Source of truth for: exact file formats between stages, walking-time formula, test vectors.
   - Read when: before any code that reads or writes pipeline outputs.
   - Updated by: proposed by the main agent, approved by a human.
   - Update when: a format change is approved (deprecate-only for fields in use).
8. `docs/data_sources.md`
   - Source of truth for: every dataset (product ID, URL, resolution, licence, processing, status).
   - Read when: before using, downloading or citing a dataset.
   - Updated by: the main agent of whoever touches the dataset (usually Person A).
   - Update when: a dataset is added, downloaded, processed or its status changes.
9. `docs/decisions.md`
   - Source of truth for: decision log (append-only), including open and accepted decisions.
   - Read when: before changing anything the team already decided.
   - Updated by: proposed by the main agent, approved by a human.
   - Update when: a decision is proposed or accepted. Never edit past entries, add new ones.
10. `docs/handoff.md`
    - Source of truth for: current stage, gate checklists, known issues, next steps.
    - Read when: start of every session.
    - Updated by: the main agent of the stage owner.
    - Update when: stage status, checklist, known issue or next step changes.
11. `docs/stage_0_guide.md`
    - Source of truth for: nothing. Working guide for Stage 0; results go to decisions, contracts and handoff.
    - Read when: preparing for or running Stage 0.
    - Updated by: any person or their main agent.
    - Update when: Stage 0 prep changes. Frozen once Stage 0 is signed off.
12. `docs/log/person_a.md`
    - Source of truth for: Person A's session history.
    - Read when: picking up Person A's work.
    - Updated by: Person A's main agent only.
    - Update when: end of every session.
13. `docs/log/person_b.md`
    - Source of truth for: Person B's session history.
    - Read when: picking up Person B's work.
    - Updated by: Person B's main agent only.
    - Update when: end of every session.
14. `docs/log/person_c.md`
    - Source of truth for: Person C's session history.
    - Read when: picking up Person C's work.
    - Updated by: Person C's main agent only.
    - Update when: end of every session.

Sub-agents do not edit `contracts.md`, `decisions.md`, `handoff.md` or any `log/` file. See "Delegating to sub-agents".


## Source-of-truth precedence

When docs disagree, the higher one wins:

1. `docs/contracts.md` (data formats)
2. `docs/decisions.md` (latest accepted entry)
3. `docs/system_design.md`
4. `docs/development_conventions.md`
5. `docs/design_principles.md`
6. `README.md`

Any disagreement you find is a bug. Stop, report it to your human, and propose a fix in `docs/decisions.md`. Do not silently pick one. When a decision is accepted, every affected doc is updated in the same change.


## Workflow: sequential stages

Each stage starts only when the previous stage's gate is passed. While waiting, the next person does non-code prep only (research, content, design). Live status is in `docs/handoff.md`.

Stages:
1. Stage 0
   - Owner: whole team (humans).
   - Work: confirm patch and staging point; choose 4 to 5 Knots; finalise `contracts.md` (including walking-time formula and test vectors) and sign off; decide how processed data is shared (Git LFS vs shared drive).
   - Folders: `docs/` only.
2. Stage 1
   - Owner: Lawrence
   - Work: data and algorithms pipeline: ingest, crop, reproject to the local grid, derive slope/roughness/rocks/sky-view/sand, traversal penalty, return field, environment timeline, Knots in grid coordinates, export, contract validator.
   - Folders: `pipeline/`, `data/`.
3. Stage 2
   - Owner: {insert name}
   - Work: app shell, Labyrinth view (3D), Planning Table, layer switching, runtime routing (A*, Theta*, D* Lite), Thread rendering.
   - Folders: `app/`.
4. Stage 3
   - Owner: {insert name}
   - Work: Suit HUD, alerts, Knot cards, simulation clock and scenario engine, CRT look polish, demo and pitch.
   - Folders: `app/`.

Docs under `docs/` may be updated by any stage according to "Doc ownership".

Gate definition: contract validator passes, visual check done, the `docs/handoff.md` checklist for that stage ticked, the branch merged into `dev` with the integration check passed, and human sign-off.


## Git workflow

Branches:
1. `main`: production. Only Lawrence merges into it, from `dev`, after the final check.
2. `dev`: integration. Lawrence merges teammates' branches here, and his agent checks everything works together.
3. `dev-{firstname}`: one personal branch per teammate, for example `dev-lawrence`. All your work happens here.

Flow:
1. Before starting, update your branch from `dev` so you build on the latest integrated work.
2. Work and commit on your own `dev-{firstname}` branch.
3. When your stage's gate checklist passes, push your branch and tell Lawrence.
4. Lawrence pulls it into `dev`. His agent merges it and runs the integration check (validator, tests, build, visual check).
5. When `dev` is stable, Lawrence merges `dev` into `main`.

Rules for agents:
- Commit only to your person's `dev-{firstname}` branch.
- Never push to or merge into `dev` or `main`, unless you are Lawrence's agent doing integration and Lawrence asked for it.
- Never force-push `dev` or `main`.
- Never add agent attribution lines (for example "Co-Authored-By") to commit messages.


## Session protocol

Start:
- Read in the order given in "Read order at session start".
- Confirm which stage is current and which person you are working for.

During:
- Stay inside your stage's folders.
- Anything that changes a contract or a decision: propose it in `docs/decisions.md` and ask the human. Do not just do it.
- Verify your work (tests, the contract validator, a visual check) before calling it done.

End:
- Append an entry to your person's `docs/log/person_x.md` using the template at the top of that file (heading: date and time, tool or agent, short title; fields: Changed, Verified (how), Broken or open, Next step, Delegated to sub-agents).
- Update `docs/handoff.md` if the stage status changed.


## Delegating to sub-agents

Each teammate's main agent is an **orchestrator** and is **encouraged** to delegate to smaller sub-agents. Examples: Claude Code subagents (the Agent/Task tool), opencode subagents, or the equivalent in any other tool. Delegation keeps the main context small and speeds up independent work.

Rules:
- The main agent plans, splits the work into independent tasks, and reviews every result before accepting it.
- Sub-agents start with no context. Every delegation brief names the files to touch, the docs to read (at least `AGENTS.md`, `docs/contracts.md` for data work, and `docs/development_conventions.md`), and what "done" looks like.
- Parallel sub-agents never edit the same file.
- Use smaller or cheaper models for mechanical tasks: searching, boilerplate, format conversion, writing tests against a spec. Keep the main model for design, algorithms and review.
- Only the main agent edits `docs/contracts.md` (proposal only; a human approves), `docs/decisions.md`, `docs/handoff.md`, and its person's `docs/log/` file. Sub-agents never do.
- The main agent verifies sub-agent output (runs tests, the validator, a visual check) before reporting work as done.

Delegation brief template:

```
Goal:                     <one or two sentences: what to produce and why>
Files you may touch:      <explicit list of paths>
Files you must not touch: <explicit list; always includes contracts.md, decisions.md, handoff.md, log/*>
Docs to read first:       AGENTS.md, docs/development_conventions.md, <docs/contracts.md for data work>, <others>
Constraints:              <stage folders, naming, local grid only, no contract changes, etc.>
Definition of done:       <observable checks: tests pass, validator passes, file exists with given content>
Report back with:         <files changed, how it was verified, anything ambiguous or broken>
```


## Non-negotiable rules

- The app uses the local grid only. No lat/lon math in the app; lat/lon appears only for display (from `meta.json`). All georeferencing is done once, in Python.
- Never change contracts without approval. Contract fields and string constants in use are deprecate-only, never renamed or removed.
- Label model-derived values "est." and keep provenance on every number (dataset, product ID, resolution, timestamp, uncertainty). Never fake precision.
- Use descriptive string constants (for example `"no_go"`, `"slope_degrees"`, `"solar_particle_event_alert"`), not enums.
- Use `uv` for Python.
- Stay in your stage's folders (see Workflow).
- Do not commit large data to git unless Stage 0 chose Git LFS. Raw data is git-ignored.
- Do not write application code before the event starts if the hackathon rules forbid it.
- Work only on your personal `dev-{firstname}` branch; only Lawrence merges into `dev` and `main` (see "Git workflow").
- No agent attribution lines ("Co-Authored-By") in commit messages.


## Conventions summary

Code:
- Readability over conciseness: no clever code; break complex conditions into explicit cases.
- Python: `main.py` is a runnable application, `run.py` is a script; absolute internal imports (for example `from ariadne_pipeline.terrain import compute_slope`).
- Code spacing: 4 empty lines between sections, 2 empty lines between classes and functions.
- Avoid premature optimisation; split a module only when scanning several files is easier than one.

Docs:
- Doc spacing: 2 empty lines between the end of a section and the next section header, 1 empty line between paragraphs.
- No dashes as punctuation: no em or en dashes, no spaced hyphens. Use a comma, colon, full stop or parentheses.
- Use lists instead of tables.
- Be concise yet understandable for both humans and agents.

Full details: `docs/development_conventions.md`.


## Tool notes

Claude Code reads `CLAUDE.md`, which only imports this file with `@AGENTS.md`. opencode, Codex, Cursor and most other agents read `AGENTS.md` directly. So this file is the single instruction file: never put instructions only in `CLAUDE.md`.
