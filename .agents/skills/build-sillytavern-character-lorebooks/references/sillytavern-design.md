# SillyTavern card and lorebook design reference

Read this file when building, revising, or auditing actual SillyTavern artifacts.

## Compatibility fast path and official sources

Before reading application source, run:

```text
node <skill-root>/scripts/probe-sillytavern-contract.mjs <SillyTavern checkout>
```

Resolve the script relative to this skill. When the probe reports `known`, read
the returned versioned reference and use it as the platform contract. Do not
repeat a source audit. When it reports `changed`, inspect only the listed
mismatched contract files and test the affected behavior. When it reports
`unknown`, establish only the contract surfaces required by the task, then add
a verified versioned reference and fingerprint rather than making the next
agent rediscover them.

Official sources for an unknown or changed contract are:

- Character design: <https://docs.sillytavern.app/usage/core-concepts/characterdesign/>
- World Info: <https://docs.sillytavern.app/usage/core-concepts/worldinfo/>
- Advanced formatting: <https://docs.sillytavern.app/usage/core-concepts/advancedformatting/>
- Character management/import: <https://docs.sillytavern.app/usage/characters/>
- SillyTavern source: <https://github.com/SillyTavern/SillyTavern>

For an unrecognized release, prefer evidence in this order:

1. a successful export from the user's installed release;
2. current official source and documentation;
3. a tested package already importing into that same release;
4. this reference's design heuristics.

The bundled compatibility references are evidence for their exact fingerprints,
not eternal schema guarantees. The probe makes that boundary cheap and
explicit.

## Package shape

A maintainable package normally contains:

```text
source/                 compact authored entries and card data
build.*                 deterministic compiler
test/                   source, format, retrieval, and budget checks
generated-or-dist/      import-ready artifacts
  imports/
    Name.character.json
  sillytavern-data/
    worlds/Name.json
    worlds/Name - Chronicle.json
    characters/Name.png              only when genuinely encoded
    OpenAI Settings/optional-model.json
  sillytavern-links.json
  import instructions
```

Adapt names and directories to the owning repository. The important boundary is authored source versus generated imports.

Use one source entry shape that can compile to both the embedded character-book representation and SillyTavern's standalone World Info representation. Use a matching versioned contract or inspect the narrow changed surface; do not copy an unverified historical field list. Preserve unknown extension fields when revising an artifact unless there is evidence they are obsolete.

The `imports/` and `sillytavern-data/` split is intentional. `imports/` contains files accepted through the UI or import API. `sillytavern-data/` mirrors only storage-ready files that can be linked directly into the current user's data tree.

## Linkable local installation

This section installs generated artifacts into a data root that has already
been selected. It does not create a self-contained SillyTavern clone, install
that clone's dependencies, seed its ignored configuration, own its plugins or
adapter state, or provide its native launcher. When the request includes those
responsibilities, use `$build-sillytavern-roleplay-settings` as the lead skill
and read its [setting-clone reference](../../build-sillytavern-roleplay-settings/references/setting-clones.md); keep this manifest as the per-file
content installation layer inside that setting clone.

When a sibling/local SillyTavern checkout is available, inspect its actual version, `dataRoot`, user handle, and directory constants. Never assume the layout from memory. Current installations commonly resolve user content beneath:

```text
<dataRoot>/<user-handle>/worlds/
<dataRoot>/<user-handle>/characters/
<dataRoot>/<user-handle>/OpenAI Settings/
<dataRoot>/<user-handle>/TextGen Settings/
<dataRoot>/<user-handle>/context/
<dataRoot>/<user-handle>/instruct/
<dataRoot>/<user-handle>/sysprompt/
```

Verify the relevant subset against the installed source. A disabled-user-accounts installation commonly uses `default-user`; user-account installations may not.

Build a project-owned mirror and manifest rather than writing generated files directly into SillyTavern:

```json
{
  "userHandle": "default-user",
  "links": [
    {
      "source": "sillytavern-data/worlds/Example.json",
      "destination": "worlds/Example.json"
    },
    {
      "source": "sillytavern-data/characters/Example.png",
      "destination": "characters/Example.png"
    }
  ]
}
```

Resolve `source` relative to the manifest. Resolve `destination` only beneath the selected SillyTavern user's data root. Use `assets/link-manifest.template.json` as a starting point and `scripts/link-sillytavern-exports.ps1` to create file links safely.

Link individual files, never the whole `worlds`, `characters`, preset, user, or data directory. Refuse to overwrite an existing ordinary file or a link to another source. A symbolic link keeps regenerated artifacts live. If Windows link creation is unavailable, use the script's explicit copy fallback and rerun it after regeneration; report that copied files are snapshots, not live links.

Direct placement must match the installed storage format. Current releases may store World Info and presets as JSON while requiring stored characters to be PNG cards; inspect the installed source before generating the manifest. A `.character.json` remains useful for UI import but must not be linked into `characters/` when that directory expects PNG, as though renaming changed its format. Generate a genuine PNG card through a current encoder/export route before linking it there.

After linking, restart/reload SillyTavern as required by the installed version and confirm the item appears. A linked standalone lorebook still needs to be bound to its intended character, persona, or chat in the UI. Linking does not establish that association by itself.

## Context architecture

Permanent character fields are paid on every generation. First messages are normally initial-chat material; example messages can be displaced as context fills depending on settings. Put enduring identity and behavioral constraints in permanent fields, scene-setting in greetings, and situational world knowledge in World Info.

For a verified 8K narrative runtime, use these conservative starting targets:

- permanent card plus constant foundation: at most about 900 tokenizer tokens combined;
- active World Info budget: about 1,400-1,600 tokens;
- ordinary entry: about 70-160 tokens;
- scan depth: four recent messages;
- recursive activation: at most two additional passes;
- sticky duration: two to four messages for active places or important people;
- factual probability: 100%;
- vectorized retrieval: off until keyword misses provide evidence.

These are starting constraints, not universal truths. Measure with a locally available target tokenizer when that does not require a model download or inference runtime; otherwise use a documented estimate and label it. For larger contexts, first preserve more chat and output room; do not bloat permanent definitions merely because space exists.

Budget at least four cases:

1. opening request;
2. ordinary scene with one location and one person active;
3. worst credible recursive cluster;
4. curation request with current chat state.

Count the actual assembled prompt when the application exposes prompt inspection. A whitespace count is only a rough warning.

## Entry construction

Make every entry comprehensive enough to stand alone because keys, titles, comments, and source metadata may not be inserted with its content.

Prefer keys such as:

- proper names and spelling variants;
- distinctive titles or institutions;
- multiword concepts that people naturally mention;
- specific relationships or technical terms;
- regex only where the matching behavior is worth testing.

Avoid broad keys such as `city`, `magic`, `road`, `king`, `food`, or `friend`. If a common word is necessary, combine it with secondary keys, case/whole-word settings, or a more selective phrase.

Use recursion as a small graph, not a lore dump. A place may activate its region and one governing institution. It should not transitively load every person and neighboring site. Test both the intended cluster and its maximum depth.

Use constant entries only for the play contract or universally necessary definitions. Insertion order changes prompt influence; choose it deliberately and test the assembled prompt. Do not use random inclusion groups for established facts. Random groups are suitable only for explicitly interchangeable color or variation.

## Truth and provenance

Give authored source entries fields equivalent to:

```text
id
title
classification
confidence/status
source references and revision
keys and optional secondary keys
content
insertion/activation settings
```

Suggested truth classes:

- `canon`: accepted setting material with a named authority;
- `design`: play or narration principle, not an in-world fact;
- `provisional`: invented connective material for this package or run;
- `play`: established only in the active conversation;
- `proposal`: extracted candidate awaiting review.

Not every project needs every class. Define promotion explicitly. A label is not enough if source provenance is missing, and source provenance should not consume prompt tokens unless the model needs it.

## Character-card discipline

Use the permanent description/personality/scenario space for the smallest complete identity and behavior contract. Avoid repeating the same instruction across every field unless a measured model failure justifies reinforcement.

Use `{{char}}` and `{{user}}` macros only according to the current card/persona semantics. Keep the first message fully in character and immediately playable. Alternate greetings should represent distinct starting situations, not superficial rewrites.

For narrator/world cards:

- narrate what can be perceived, inferred, remembered, or reasonably suspected;
- never decide the user's unspoken thoughts, speech, choices, or irreversible bodily actions;
- let NPC dialogue belong to NPCs rather than an omniscient chorus;
- usually stop at a meaningful opening for action without a videogame menu;
- preserve established causality and allow retreat, refusal, negotiation, surrender, preparation, and failure where the fiction supports them;
- reveal secret context only through viewpoint-appropriate evidence.

For a person-character card, apply the same rules while making the character's own motives, voice, limits, memory, and autonomy concrete.

## Chat state and curation

Use chat-bound lore for state that belongs to one conversation:

- current place and approximate time;
- current group;
- important relationships, promises, and obligations;
- meaningful injuries, possessions, and transformations;
- established discoveries and lasting consequences;
- unresolved threads.

Do not pretend the model can persist edits. Either use an existing supported automation/tool or make the manual update step explicit.

A curation command should leave fiction and return distinct sections:

1. facts established during play;
2. details invented by the model;
3. conflicts, ambiguities, or uncertain claims;
4. memorable people, places, objects, and events;
5. candidate additions;
6. supporting scenes for each candidate;
7. concise factual chronicle ready for the chosen update path;
8. optional literary retelling, clearly separate.

## Structural verification

Automate checks for:

- valid JSON and current top-level format/version;
- unique stable source IDs;
- normalized duplicate activation keys reported as errors unless the overlap is explicitly declared and covered by an expected-cluster test;
- deterministic UID assignment and exact standalone object-key/UID agreement;
- non-empty content and keys for non-constant entries;
- supported insertion positions, roles, recursion flags, probability values, and orders;
- parity between main source entries and embedded/standalone outputs;
- separation of the chat chronicle from reusable setting lore;
- absence of hidden provenance or forbidden source material in generated prompt content;
- deterministic regeneration and no stale generated files;
- tokenizer budgets for permanent content and representative activation clusters.
- a retrieval simulation that uses the configured case/whole-word/regex rules, constant entries, recursive entry content, recursion exclusions, sticky behavior, maximum recursion, and token budget closely enough to catch an unexpectedly connected lore graph;
- a manifest whose sources exist, destinations remain inside the selected user-data root, extensions match the installed storage format, and no destination collision is hidden;

## Deterministic prompt verification

Use source fixtures, retrieval simulation, and assembled-prompt inspection without model inference to verify:

- a proper name activates exactly its intended entry or small cluster;
- aliases activate the same subject;
- common conversation produces no unrelated activation;
- two nearby subjects do not recursively load the whole book;
- an empty or ordinary prompt plus constant entries does not recursively make most of the book eligible;
- sticky activation expires when expected;
- the opening fixture fits the target context and contains the intended play contract;
- a first-contact fixture activates the intended character and location material;
- an information-limited fixture does not insert hidden truth;
- disagreement/refusal fixtures contain the required character-agency instructions;
- danger fixtures contain the intended causality contract without an automatic fairness instruction;
- a continuity/state fixture assembles a consistent state update;
- a curation fixture keeps facts, inventions, evidence, and proposals separate;
- linked lorebooks/presets appear after reload and a linked PNG character opens correctly, when local deployment is part of the request.

These checks prove artifact and prompt behavior, not generation quality or model compliance.

## Optional live model testing

Live smoke-play is outside routine build, audit, import, and verification work. Do not download or load model weights, start or stop a backend, alter runtime configuration, or send inference requests unless the user explicitly requests live model or backend testing in the current task. A configured target, installed model, available endpoint, or already-running server is not authorization.

If the user explicitly authorizes inference, keep the test within the named target and scenes. Permission to run inference does not grant permission to download weights or start, stop, restart, or reconfigure a runtime; those actions require their own explicit authorization. Test a second model only when the user explicitly requests that comparison. Record any model/backend failure as a failure of the experiment, never as a setting fact.
