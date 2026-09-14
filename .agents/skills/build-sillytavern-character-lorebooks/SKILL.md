---
name: build-sillytavern-character-lorebooks
description: Create, revise, audit, or package SillyTavern character cards and context-efficient World Info/lorebooks, including reactive people, places, objects, relationships, secrets, chat-bound state, source-authored compilers, import-ready JSON or PNG, retrieval tests, and optional model-specific presets. Use for one character, narrator or world card, lorebook architecture, setting artifact compilation, prompt-budget work, play-state curation, or repairs. For a whole campaign or dating-sim setting, load build-sillytavern-roleplay-settings first and use this as its artifact skill. Do not use for generic fiction with no SillyTavern artifact.
---

# Build SillyTavern character cards and lorebooks

Create a playable import package whose authored source can be maintained and regenerated. Treat prompt behavior, retrieval behavior, truth provenance, and import compatibility as separate contracts.

This is the platform-artifact skill, not the lead workflow for a whole campaign
setting. When the request includes the premise, ensemble, routes, opening,
state/reveal architecture, and local play installation together, load
`$build-sillytavern-roleplay-settings` first and follow its completion boundary.

## Select the task mode

- **Brief:** Produce an implementation-ready plan without creating imports. Use `assets/build-brief-template.md` when a durable brief is useful.
- **Build:** Create or update authored source, compiler, tests, generated imports, and concise import instructions.
- **Audit:** Inspect an existing card or lorebook for schema, context cost, activation quality, agency, provenance, and play-state problems. Do not rewrite it unless asked.
- **Curate:** Convert play output into factual chronicle state and reviewable proposals without silently changing source canon.

If the user asks for a working package, continue through generation and verification rather than stopping at a plan.

## Gather authority before authoring

1. Read applicable workspace instructions and preserve unrelated work.
2. Locate existing character/lorebook source, generated exports, tests, setting authority, content boundaries, and model/runtime constraints.
3. Read `references/sillytavern-design.md` whenever building, revising, or auditing actual artifacts.
4. Read `references/reactive-lore-design.md` when the request involves layered characters or locations, contextual behavior, evolving state, secrets, conditional memories, or similarly reactive entities.
5. Fingerprint a local SillyTavern checkout with `node <skill-root>/scripts/probe-sillytavern-contract.mjs <checkout>` when schema or retrieval details matter. If it reports `known`, read the named compatibility reference and use that fast path without auditing the application source. If it reports `changed` or `unknown`, inspect only the mismatched contract-owning files or required import behavior, then preserve the verified delta in a versioned reference. Do not treat remembered JSON field names as current authority.

A named model, API, backend, installed weight file, or running server is compatibility context only. It is not authorization to download or load a model, start or stop a server, change runtime configuration, or send inference requests.

Do not register or advertise this personal skill in a target repository's `AGENTS.md`, indexes, or routing documents unless the user explicitly asks. Still follow that repository's normal rules for artifacts created inside it.

## Freeze the play contract

Before writing lore, state or record:

- one-sentence intent anchor;
- what the card portrays and what it must never control;
- authoritative sources, permitted inference, and explicit exclusions;
- truth classifications and their promotion rules;
- declared model/API compatibility target, tokenizer, context size, and SillyTavern version;
- deliverables, generated/source boundaries, and acceptance scenes.

Separate the desired experience from its first mechanism. Mark inferred connective material honestly instead of letting it masquerade as sourced lore.

## Design the context in layers

Use three scopes by default:

1. **Permanent card + tiny foundation:** identity, role, agency, narration contract, and only the rules needed in every exchange.
2. **Retrieved lorebook:** standalone entries for people, places, institutions, concepts, and relationships that matter only when activated.
3. **Chat-bound state:** current location/time, relationships, injuries, possessions, discoveries, consequences, and unresolved threads for this conversation.

Keep provenance, source paths, classifications, and revision metadata in authored source or a sidecar ledger. Insert only the concise truth/status marker the model needs to reason correctly.

Each retrieved entry should:

- cover one coherent subject and still make sense alone;
- use specific names, aliases, phrases, or selective secondary keys;
- avoid generic high-frequency keys;
- connect recursively to only a small intentional neighborhood;
- use deterministic 100% activation for established facts;
- use stickiness only for an active person, place, or similarly continuous concern.

Start with keyword retrieval. Add vector or probabilistic retrieval only after measured misses show why it is needed.

When a subject has substantial backstory or state-dependent behavior, keep its stable core small and retrieve coherent facets such as relationships, remembered events, local behavior, discoveries, or current conditions. Do not encode an entire biography, location history, or object lifecycle as one always-on entry.

## Author the card

Keep the core card model-neutral. Put backend-specific formatting or sampling in a separate optional preset.

For narrator/world cards, define:

- viewpoint, tense, prose texture, dialogue ownership, and knowledge limits;
- a hard boundary against choosing the player's thoughts, dialogue, or irreversible actions;
- causal honesty: no drama by fiat, secret leakage, or silent danger equalization;
- how uncertainty is adjudicated without inventing an unnecessary replacement ruleset;
- a first message that starts play and alternate greetings for materially different entry modes;
- compact examples only when they teach behavior more efficiently than prose instructions.

For ordinary character cards, preserve the same agency and knowledge discipline while clearly separating the character's identity, motives, boundaries, voice, relationships, and scenario from world lore.

## Build maintainable artifacts

Prefer compact authored source plus a deterministic compiler over hand-maintained duplicate JSON.

- Give source entries stable semantic IDs; derive platform UIDs deterministically.
- Validate source before generation: IDs, keys, content, insertion order, positions, probabilities, and supported option values.
- Emit the exact artifacts the user needs. Common outputs are one character JSON with one primary embedded lorebook, a standalone copy of that lorebook, a small chat-bound chronicle, concise import instructions, and an optional model preset.
- Do not activate the standalone book alongside its embedded duplicate.
- Keep generated output in the repository's normal generated/dist location and tell maintainers to edit source, not exports.
- When a local SillyTavern checkout is present or the user asks for easy local installation, also emit a linkable data-tree layout and manifest as described in `references/sillytavern-design.md`. Keep UI-import-only files separate from files that SillyTavern can read directly from its user-data folders.
- This link workflow installs individual artifacts into an already-selected SillyTavern user-data root. It does not create or own a self-contained setting clone, clone-local configuration/dependencies/data/plugins, or a native setting launcher. When those are requested, use `$build-sillytavern-roleplay-settings` as the lead skill and its setting-clone workflow.
- Mirror only the individual deployable files under paths such as `sillytavern-data/worlds/`, `sillytavern-data/characters/`, or `sillytavern-data/OpenAI Settings/`. Never replace or symlink an entire SillyTavern user-data directory.
- Use `scripts/link-sillytavern-exports.ps1` with the generated manifest to install individual links. Generate the layout and manifest by default when a sibling installation is discoverable; create the links themselves only when the user asks for local installation or deployment.
- Add no extension merely to simulate persistence when a manual or existing chat-lore workflow meets the request.
- If a portrait or PNG card is requested, use an appropriate image workflow and a current card encoder/export path; do not fake binary metadata by renaming JSON.
- When host configuration or PNG tooling is unavailable, use the existing compiler's portable/JSON-only mode if supported. Keep the output separate, verify generated modules as well as source, and record omitted packaging steps. A portable bundle is not an installed extension or a storage-ready PNG; do not fabricate host assets to complete it.
- Do not place a character-card JSON directly in SillyTavern's `characters` storage folder when the installed release expects PNG cards. Leave JSON in an `imports/` directory for UI import, or generate a genuine storage-ready PNG.

## Preserve truth and curation boundaries

- Never promote play invention or model output into canon automatically.
- Never claim prose roleplay is deterministic simulation evidence or mechanic verification.
- Never expose distant/secret source truth merely because it exists in prompt context.
- Distinguish a fact the model may know but must withhold from a fact the model must not receive before discovery. Instructions can govern disclosure of the former; the latter must stay out of assembled context until an explicit state or retrieval gate admits it.
- Never claim the model updated a lorebook or external state unless a real tool or user performed that write.
- When curating play, separate established facts, model inventions, conflicts, memorable entities, candidate additions, supporting scenes, and the concise factual chronicle. Keep literary retelling separate.

## Verify the result

Run structural, deterministic prompt-assembly, and retrieval checks by default. Use authored acceptance scenes as fixtures; do not run them through a model unless the user explicitly requests live model testing in the current task. Use the full matrix in `references/sillytavern-design.md`.

Do not download, load, start, stop, restart, reconfigure, or send requests to a model or backend as routine verification. Access to an installed or already-running runtime does not change this boundary. Authorization to create, import, audit, or "test" a package does not imply authorization for live inference; the user must explicitly ask for live model or backend testing. Authorization for inference does not imply permission to alter runtime state.

At minimum, verify:

- JSON parses; format/version is current; entry object keys and UIDs agree;
- source IDs are unique; activation keys are non-empty; duplicate normalized keys are absent or explicitly intentional and tested;
- embedded and standalone lore contain the intended same main entries;
- a proper noun activates its entry, recursion stays bounded under a simulated closure that includes constant-entry content and recursive entry content, and ordinary conversation activates nothing unrelated;
- prompt inspection contains neither source-ledger clutter nor forbidden material;
- permanent tokens and worst credible active lore fit the actual target tokenizer/context;
- assembled greeting and scenario fixtures contain the intended agency, knowledge, causality, and truth-class contracts;
- reactive subjects preserve their stable identity across facet changes, activate only the applicable layer, do not leak pre-reveal facts, and follow the declared persistence path;
- imports work in the user's current SillyTavern release when access to it is available;

For a fingerprinted known release, the compatibility probe plus deterministic
fixtures is the normal schema/retrieval check. Do not reread the same source
tree as ritual freshness work. For a changed or unknown release, report the
specific mismatches and the narrow surfaces inspected.

Report deterministic checks separately from manual import evidence and any explicitly requested live testing. Without authorized inference, describe model behavior as unverified rather than trying to prove it.

When authoring model presets, use the lead setting skill's
[model preset and request evidence guidance](../build-sillytavern-roleplay-settings/references/model-context-and-state.md#model-presets-and-request-evidence).
It covers final custom-body effects, reasoning history, response reserve and the
boundary between transport tests and full browser assembly.

## Hand off for use

Lead with the playable result. List the imports in order, explain which lorebook scope each belongs to, warn against enabling duplicates, give the regenerate and optional link commands, report the measured context envelope, and name any provisional or unresolved content. Keep implementation detail secondary unless the user needs it for maintenance.
