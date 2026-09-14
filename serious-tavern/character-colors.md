# Character Colors and bundled authoring guidance

Status: implemented in the development branch; offline tests and isolated
browser rendering verified. No live instance was migrated, no model called,
and nothing published.

## Ownership and scope

The two skills under `.agents/skills/` were copied as ordinary files from the
WorldCreator development revision `66a534c`, including their own references,
templates and helper scripts. This fork owns its bundled versions; there is no
runtime link or automatic synchronization to that checkout. Root `AGENTS.md`
routes whole-setting, artifact and application-code tasks and records the
owner's edited-summary workflow. The bundled copies clarify that accepted
summaries can hold continuity and an already-designated instance should be
reused. No global skills or agent configuration changed.

Character Colors takes the pure adornment modules from WorldCreator's
SemanticPlay source at `76d5997` (unchanged in `66a534c`). Those two modules are
byte-preserved; the renderer is extracted from the same extension with isolated
CSS/data names. SeriousTavern owns this presentation implementation. The old
SemanticPlay snapshot is not removed, installed or rewritten by this change.

The palette uses FNV-1a over normalized names, modulo nine accessible pairs
designed for a dark background. Names and aliases share a canonical color;
color uniqueness is not guaranteed. Pronoun attribution remains conservative.
Optional identity settings are visual preferences stored in this instance's
extension settings, not accepted story state or prompt content. Nothing scans
hidden cards or imports a world's secret cast into these settings.

## Behavior comparison

| Contract | Status and check |
| --- | --- |
| Name hash, palette, quotes, aliases, pronouns, safe optional markup | Same pure modules; 19 inherited behavioral tests pass |
| Text-safe DOM rendering, Markdown preservation, restoration | Extracted renderer; isolated browser fixture passes |
| Default enablement and settings | Deliberate change: standalone built-in extension, enabled unless disabled; optional identity editor |
| Identity source | Deliberate change: visual settings and message author; no dependency on scene/present state |
| Semantic intent, prompt control, state writes, retrieval, soundtrack | Deliberately absent; no imports/hooks for these capabilities |
| Legacy coexistence | Defers to explicit active SemanticPlay adornment metadata or existing legacy roots; no migration |
| Full application and real chat/theme combinations | Not verified; isolated fixture uses real extension modules with host API doubles |

The browser fixture uses headless installed Edge in a disposable process, with
every page/module request intercepted from local files. It starts no web or
model server and aborts unexpected requests. It checks default rendering,
idempotent initialization, optional alias settings, rejection of malformed
identity edits, exact restored HTML, preserved emphasis/code/links, edit/swipe
render events, legacy handoff, and unchanged transcript/metadata. The browser
is closed in `finally`. An inspected screenshot is available locally at
`cache/character-colors.png`; it is a fixture, not a deployed-world screenshot.

## Reproduction and results

- `npm run test:serious`: 27/27 pass (8 fork contracts + 19 inherited visuals).
- `node --test serious-tavern/test/character-colors.browser.mjs`: passes.
  Requires local `tests/` dependencies and an installed Edge channel; override
  `SERIOUS_BROWSER_CHANNEL` for another installed Playwright browser channel.
  No browser download occurs. Set `SERIOUS_COLORS_SCREENSHOT` for a screenshot.
- Bundled card/lore compatibility probe: known 1.18.0 contract, four owning
  files checked. Entrypoints and UI YAML parse; local references resolve.
- JavaScript syntax and changed-source whitespace checks pass. Python skill
  quick_validate remains unavailable because PyYAML is absent; YAML/link checks
  do not constitute independent model-based skill qualification.

Recorded test output is in `evidence/character-colors/`. Earlier 150 passing
request/converter checks remain relevant; this display extension does not change
that request path. Broader SemanticPlay audit findings remain backlog, not a
prerequisite for colors or manually curated continuity.
