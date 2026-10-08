# Working in SeriousTavern

This repository is the reusable SeriousTavern fork and carries local authoring
skills. A world may use its own complete clone of this repository. Start by
reading the user's task, checking `git status`, and locating any existing world
blueprint/source before changing files. Do not assume this checkout is a new
world or overwrite a populated instance.

## Choose the relevant guidance

- For a whole world or campaign, use
  [.agents/skills/build-sillytavern-roleplay-settings/SKILL.md](.agents/skills/build-sillytavern-roleplay-settings/SKILL.md)
  first, then the artifact skill when producing cards or lorebooks.
- For one character, lorebook, import, or curation task, use
  [.agents/skills/build-sillytavern-character-lorebooks/SKILL.md](.agents/skills/build-sillytavern-character-lorebooks/SKILL.md).
- For application code or defaults, inspect the relevant source/tests and
  [serious-tavern/README.md](serious-tavern/README.md). Do not load the world-design
  workflow for an ordinary code fix. Read
  [development evidence](serious-tavern/development.md) only when it bears on the task.

Load only task-relevant references. These are ordinary local Markdown skills:
an agent without automatic skill discovery can follow the links directly.
They instruct the authoring agent, not the roleplay model; do not inject these
files or test diagnostics into the world's prompt.

Character Colors is a built-in, default-enabled display extension at
`public/scripts/extensions/character-colors/`. It hashes names for consistent
colors and supports optional aliases in Extensions settings. It does not need
SemanticPlay, a state ledger, or extra prompt instructions. Preserve that
separation when changing presentation.

Swipe Pregeneration is a built-in, default-enabled extension at
`public/scripts/extensions/swipe-pregen/`. It preserves the visible reply during
manual swipe generation and supports sequential batches. Read
[its source and verification notes](serious-tavern/swipe-pregen.md) before
changing it. Keep generation explicit and preserve native prompts, reasoning,
swipes and cancellation. Updates are reviewed with the fork, not auto-installed.

ComfyUI API is a built-in, default-enabled manual image extension at
`public/scripts/extensions/comfyui-api/`, with scoped server transport at
`src/endpoints/comfyui-bridge.js`. Read
[its implementation notes](serious-tavern/comfyui-api.md) before changing it.
Its editable source lives in the sibling SillyTavern `Plugins/ComfyUI_API`
project; refresh the generated copy with that project's deployment command.
Do not edit a generated copy without reconciling the authored source. Model
prompt instructions and custom field values are user settings; never replace
them during deployment or insert authoring instructions into them.

## Keep authoring and play simple

The owner's normal continuity workflow is to request a summary, edit it, and
place the accepted version in a dedicated context slot. Support this workflow.
An unreviewed model summary is a proposal; an owner-accepted summary is a
continuity record for that chat, without automatically rewriting source canon.

Use a compact narration contract, relevant lore, accepted continuity and recent
dialogue. Avoid duplicating the same facts across context slots. Preserve the
owner's prompt and manual choices. Add automatic memory, state extraction,
embeddings or extra adapters only for a requested feature or demonstrated need.
The existing bootstrap offers an optional memory bundle; do not apply it merely
because the skills are present. SemanticPlay is optional and is not bundled as
an installed runtime here. Never make the model maintain a ledger every turn.

Preserve player agency and declared content boundaries. A typed secret name or
marker must not grant access to gated lore. Keep unrevealed material out of
context when it must be unknown to the model.

## Work in the intended instance

One self-contained instance per world is the normal operating model. Reuse the
current instance when the user designates it as the world being authored. Create
a separate sibling clone only for a new independent world when requested by the
task; do not create nested clones or a shared profile selector by default.
Keep dependencies, configuration, data and installed adapters local to that
instance. Separate directories do not isolate browser localStorage on the same
origin; report relevant extension storage limitations.

Edit authored source and regenerate exports through their existing compiler.
Preserve chats, credentials, accepted content, user settings and unrelated edits.
Installing content, starting the application, migrating a world and publishing
changes are distinct actions; follow the current task's scope. A configured
model endpoint or launcher grants no authority to start, change or call it.

## Offline checks and handoff

For relevant fork changes, install dependencies locally with
`npm ci --ignore-scripts --no-audit --no-fund` at the root and, for request tests,
in `tests/`. Do not run bootstrap or `Start.bat` as a test prerequisite.

- `npm run test:serious` checks fork settings and native preset contracts.
- `npm run test:serious:requests` checks intercepted requests and converters;
  no model is contacted. Its optional generated SemanticPlay case requires
  `SERIOUS_SEMANTIC_BUNDLE`; a fresh clone skips that case explicitly.
- `npm run test:serious:colors` checks real visual modules in an isolated
  headless browser fixture. It requires the `tests/` dependencies and installed
  Edge by default, starts no application server and closes its test browser.
- `npm run test:serious:swipes` checks the bundled extension with native manifest
  discovery and an isolated browser fixture using simulated generation.
- For cards/lorebooks, use the bundled compatibility probe and the skill's
  deterministic source, retrieval and regeneration checks.

Run checks appropriate to the change. Distinguish static/generated/transport
evidence from browser and live-model evidence. Keep unrequested improvements
as backlog. Hand back a short summary of changed files, checks, how to use the
result, and material remaining limits.
