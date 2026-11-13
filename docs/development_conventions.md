# ARIADNE development conventions

Source of truth for: code, documentation and git conventions for the whole team and every agent.

If this file disagrees with docs/contracts.md or an accepted entry in docs/decisions.md, those win. Report the conflict.


## General principles

- Prefer readability over conciseness. Write code that is understood at a glance; avoid clever implementations.
- Avoid premature optimisation. Design for complexity but introduce it incrementally.
- Split a module into sub-modules only when scanning several files is less effort than finding code in one large file.
- Stay inside your stage's folders. Anything that changes a contract or a decision is proposed in docs/decisions.md and confirmed by a human.


## Code

Applies to Python (pipeline) and TypeScript (app).

Break complex if/else logic into explicit condition cases rather than simplifying it algebraically. Use nested ifs where applicable.

Bad (compact, needs thought):

```python
passable = not (slope > 25 or (is_rock and not is_small))
```

Good (each case readable):

```python
if slope_degrees > max_slope_degrees:
    passable = False
else:
    if is_rock:
        if rock_is_small:
            passable = True
        else:
            passable = False
    else:
        passable = True
```


## State and constants

Be verbose when storing application or data state. Use descriptive strings for constants instead of enums, so they are self-documenting in data files, logs and the UI.

Good:

```python
hazard_level = "no_go"                       # also "go", "caution"
layer_id = "slope_degrees"
scenario_event = "solar_particle_event_alert"
```

Bad:

```python
hazard_level = HazardLevel.RED               # meaning is hidden
layer_id = 3
```

Deprecate-only rule: once a string constant or a contract field is in use, it is never renamed or removed, only deprecated. Exceptions need a full team review, recorded in docs/decisions.md.


## Python specifics

- Run Python with `uv` (for example `uv run python run.py`).
- Module naming: `main.py` is a runnable application; `run.py` is a script. The pipeline is a script, so `pipeline/run.py`; the validator is `pipeline/validate/run.py`.
- Internal imports use absolute package paths, never relative imports.

Good:

```python
from ariadne_pipeline.terrain import compute_slope
```

Bad:

```python
from .terrain import compute_slope
from terrain import compute_slope
```


## Spacing

Code:

- 5 line breaks, which means 4 empty lines, between sections.
- 3 line breaks, which means 2 empty lines, between classes and between functions.

Example for code:

```python
def compute_slope(heightmap):
    ...


def compute_roughness(heightmap):
    ...
```

Docs:

- 3 line breaks, which means 2 empty lines, between the end of a section and the next section header.
- 2 line breaks, which means 1 empty line, between paragraphs and between a list and the next label line.
- Never 3 or more empty lines in a row.


## Writing docs

Docs must be readable by both humans and agents.

Rules:

1. No dashes as punctuation.
   - Do not use the em dash, the en dash or a spaced hyphen. Use a comma, colon, full stop, parentheses or a new bullet.
   - Write ranges with "to": "14 to 15", not "14-15".
   - Allowed: "-" as a bullet marker, in hyphenated words (no-go, row-major) and in code.
2. Use numbered points and bullet lists instead of tables.
   - Put a label line ending in a colon, then numbered items, with nested "-" bullets for attributes.
   - Use numbers when order or count matters; use "-" bullets otherwise.
3. Be concise yet understandable.
   - Lead with the point.
   - One idea per bullet.
   - Explain jargon in a few words the first time it appears in a file.

Pattern:

```
Tech stack:
1. Frontend
   - React, Vite, TypeScript
2. Pipeline
   - Python with uv
```

File naming: doc files are named in lowercase snake_case, except README.md, AGENTS.md and CLAUDE.md.


## Git

Branches:
1. `main`: production. Only Lawrence merges into it, from `dev`.
2. `dev`: integration. Lawrence merges personal branches here and runs the integration check.
3. `dev-{firstname}`: one personal branch per teammate, for example `dev-lawrence`.

Commits:
- Small, focused commits: one logical change each, with a message saying what and why.
- No agent attribution lines (for example "Co-Authored-By") in commit messages.

Other rules:
- Never commit `data/raw`. It is git-ignored. How `data/processed` is shared (Git LFS vs shared drive) is TBD, Stage 0, whole team.
- When a decision is accepted, update every affected doc in the same change.


## Verification

An agent never reports work as done without running the relevant check, and it says which check it ran:

- the contract validator (`pipeline/validate/run.py`) for pipeline output and data files;
- tests (for example the shared walking-time test vectors from docs/contracts.md) for algorithms;
- a visual check (QGIS alignment for pipeline output, the running app for UI) for anything seen.

When a main agent delegates to sub-agents, it verifies their output the same way before accepting it. If no check could be run, the report says so explicitly instead of claiming success.
