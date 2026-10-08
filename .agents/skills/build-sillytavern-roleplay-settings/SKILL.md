---
name: build-sillytavern-roleplay-settings
description: Design, build, validate, and locally deploy complete SillyTavern roleplay settings with a playable premise, independent ensembles, selective context, state and reveal gates, model-scaled acceptance fixtures, and one self-contained SillyTavern clone per setting. Use as the lead skill for a whole campaign or dating-sim setting. Do not use for generic fiction, one isolated character, or low-level lorebook repair with no setting-design work.
---

# Build SillyTavern roleplay settings

Create a setting that can produce character-led play without requiring the
player to outline the next plot beat. Preserve the desired experience in a
compact setting blueprint, then compile only the context needed for the current
scene.

This skill owns whole-setting design: the dramatic engine, player contract,
route topology, ensemble, opening state, staged discovery, and acceptance
scenes. When import-ready cards, World Info, source compilers, or local
installation are requested, also use
`$build-sillytavern-character-lorebooks` for current SillyTavern schemas,
retrieval mechanics, packaging, and deployment. Do not duplicate that skill's
platform field reference here.

## Completion contract and active instructions

For a whole-setting build, load `$build-sillytavern-character-lorebooks` by
that exact name before authoring platform artifacts. Record both active skill
names, every selected required reference, and the current numbered pass in the
setting blueprint's build-and-handoff section. After a compaction checkpoint,
reload each still-active skill and reference from its current source before
continuing. A generated conversation summary is continuity evidence, not a
substitute for governing instructions.

Choose the completion boundary before substantial authoring:

If the current checkout is already the user-designated world instance, reuse
it. Provisioning means filling missing pieces of that instance, not cloning
another copy inside it. Inspect existing source and data before creating files.

- **Blueprint-only** ends with an accepted implementation-ready blueprint.
- **Import-only** ends with generated, deterministically verified artifacts and
  import instructions for an explicitly selected external installation.
- **Local playable build** ends only when a self-contained setting clone exists,
  its ignored configuration and local dependencies are present, the setting is
  deployed into that clone, its native visible launcher exists, and offline
  acceptance checks pass.

When the user asks for a complete or working setting for local play and an
owner-designated SillyTavern fork is discoverable, default to the local playable
build. Provision the setting clone as the first filesystem milestone so later
work has a real destination. Do not claim completion from a blueprint or import
package while that deployment remains absent.

## Select the requested depth

- **Blueprint:** Produce an implementation-ready setting blueprint without
  imports. Use `assets/setting-blueprint-template.md` when no project-owned
  format exists.
- **Build:** Complete the blueprint, authored sources, narrator card,
  lorebook/state layers, acceptance fixtures, import package, and the selected
  deployment boundary. This is the default when the user asks to create a
  working setting.
- **Adapt:** Preserve the authority of an existing franchise, book, game, or
  campaign while creating an original playable pocket, cast, and pressures.
- **Audit:** Compare an existing setting against the quality and context gates
  below. Do not rewrite it unless asked.

Read `references/setting-design.md` for a new setting, major adaptation,
ensemble, route design, opening, or whole-setting audit. Read
`references/model-context-and-state.md` when the target includes a local
model, Semantic Play, long-campaign memory, gated cast or secrets, prompt
budgeting, model presets, or live qualification. Read
`references/setting-clones.md` whenever the request includes a clean or
separate local setting, switching between settings, a launcher,
setting-specific presets or extensions, or local deployment.

## 1. Gather authority and constraints

Inspect the active repository, its instructions, existing setting authority,
artifacts, compilers, tests, installed SillyTavern version, and target runtime.
When platform behavior matters, use the character/lorebook skill's
fingerprinted compatibility fast path; do not independently rediscover the
same card or World Info contract in this setting-design pass.
Keep accepted facts, play-established facts, provisional connective material,
model proposals, and external reference material distinct.

A named model, installed weight, endpoint, or running server is compatibility
context only. It is not permission to load weights, infer, download, start,
stop, restart, or reconfigure anything. Routine setting verification is
offline and deterministic unless the user explicitly authorizes live model
testing in the current task.

Collect only decisions that materially shape the setting. Useful high-impact
questions concern:

- genre, continuity, and what may be invented;
- the player's starting premise and authorship level;
- open routes versus a committed campaign direction;
- tone, relationship interests, and content boundaries;
- ensemble shape and how forgiving departures should be;
- target model, context envelope, and optional interaction systems.

When several answers are missing, ask one question at a time with two or three
real alternatives plus an Other path, preferably recommending one. If the
user invites reasonable liberties, choose reversible defaults, record them,
and continue instead of conducting an exhaustive interview.

## 2. Freeze the play promise

Write one sentence stating what the player repeatedly gets to experience. It
must survive changes to names, interface, provider, and first-scene details.

Then record:

- what the player exclusively controls;
- what the narrator and non-player cast control;
- the setting's recurring source of pressure;
- what makes routes materially different;
- the tone and relationship contract;
- what the system must keep absent until discovered;
- what must remain possible: refusal, retreat, failure, recovery, route change,
  quiet, or other user-valued freedoms.

Do not mistake a plot outline for a play promise. A strong setting creates
decisions from people, institutions, obligations, places, and incomplete
knowledge even when no chapter sequence has been authored.

## 3. Build a playable pressure system

Design a bounded setting pocket rather than an encyclopedia. Establish:

1. an immediate disruption, need, invitation, debt, danger, or opportunity;
2. two or more actors with defensible but incompatible answers;
3. concrete benefits and costs for each meaningful route;
4. a reason the situation cannot be solved by one obvious conversation;
5. room for the player's values and relationships to change the outcome.

For an adapted franchise, use broad canon or model-weight knowledge as texture,
not campaign authority. Author the local divergence, cast, current crisis,
reveal gates, and consequences that must remain reliable.

Do not label one route good, one evil, and one consequence-free neutrality.
Give each route internal disagreement, people worth caring about, a temptation,
a cost, and a credible reason to reconsider it.

Default to fiction-first uncertainty and lightweight semantic actions. Do not
invent attributes, dice, combat math, or a per-turn state protocol unless the
user wants a game system and the application can own its bookkeeping. When a
rules layer is requested, keep its authoritative results outside narrator
prose and make failure, partial success, preparation, and withdrawal legible.

## 4. Start without requiring a played prologue

Default to a **continuity seed** unless the user specifically wants live
workshop play. The seed contains only enough accepted past to make the opening
relationally and causally alive:

- a small set of facts that just happened or have long mattered;
- one to three active relationships with concrete history or obligation;
- the current location, time, present cast, conditions, and possessions;
- commitments, discoveries, and unresolved threads;
- the immediate situation and an opening for player action.

Author this seed directly from the approved blueprint. It is accepted authored
setup, not fabricated evidence of play. A cold open may instead begin before
relationships form. A played prologue is an optional calibration mode whose
harvest remains a proposal until reviewed; it is never required to make the
setting good.

## 5. Design people as independent story vectors

For every continuing character define the smallest useful combination of:

- practical role and visible competence;
- present desire and independent obligation;
- moral belief that can produce defensible disagreement;
- contradiction, blind spot, or cost of that belief;
- boundary and reason to refuse, leave, or return;
- quest pressure that can move without the protagonist;
- relationship possibilities without guaranteed attraction or loyalty;
- a situation-specific introduction and at least one causal fallback;
- public core, conditional facets, mutable state, and secret visibility.

Design a relational ecology, not a romance catalogue. Attraction, friendship,
rivalry, mentorship, incompatibility, and disinterest remain independent.
Apply explicit age, authority, consent, and content boundaries. A candidate is
not a companion until play creates a reason for continued proximity.

Keep the starting cast small. For local models, the safe default is one active
future introduction packet at a time; established group scenes may contain
more people when the player deliberately enters them. Future candidates and
their quests remain prompt-absent until admitted. Do not use a numbered queue
that teleports the next candidate into a generic location.

## 6. Separate setting truth, retrieval, and state

Use three core context layers:

1. **Permanent narrator contract:** player agency, viewpoint, causal honesty,
   response behavior, and only setting truths required every turn.
2. **Setting description (Character Description field):** the full cast of
   characters, places, institutions, relationships, concepts, and world
   facts, written as a cohesive reference document. This is the default
   approach when context headroom is sufficient. Only use a separate
   SillyTavern lorebook when retrieval is genuinely needed — for very
   large casts, secrets that must stay out of context until discovered,
   or conditional facets that activate on specific triggers.
3. **Chat-owned state:** current scene, present cast, conditions, possessions,
   relationships, commitments, discoveries, introduced identities, and open
   threads.

Retrieval is not persistence. Unreviewed summaries, embeddings, and model
claims do not establish accepted state. A summary edited and accepted by the
owner can be the chat's continuity record; it does not automatically change
source canon. A separate structured ledger is optional. Facts that must be unknown to the model
stay out of assembled context until an explicit state transition admits them.
Facts the model may know but must withhold need a separate disclosure contract.

Prefer deterministic state and retrieval over model bookkeeping. Do not require
the roleplay model to emit hidden JSON or XML every turn. Any model-assisted
state extraction must be a reviewable proposal bound to the exact transcript
and state revision, with explicit user approval before persistence.

When using the Character Description field for setting info (no separate
lorebook), write characters, places, and world facts as a single cohesive
document with clear section headings. This is simpler to author and maintain,
and works well for settings that fit within the model's context window.

## 7. Write a local-model-friendly narrator contract

Keep the core contract model-neutral and compact. Use stable terms and direct
sentences. Explain observable behavior rather than stacking synonyms.

At minimum, specify:

- viewpoint, tense, prose texture, and knowledge limits;
- the hard boundary against writing the player's unspoken thoughts, dialogue,
  attraction, consent, or irreversible choices;
- causal continuity, physical positions, timing, and consequence scope;
- how terse observation, inventory, status, recall, dialogue, action,
  continuation, and explicit spotlight requests should differ;
- the cast-admission and secret-visibility rules;
- how out-of-character control and optional story-direction syntax work;
- relationship and content boundaries;
- a natural stopping condition that leaves the next decision to the player.

Separate response richness from permission to advance. An observation can be
emotionally or visually detailed while holding the current beat. A direct
question can be short without becoming shallow. Avoid hard word ceilings when
the actual requirement is no scene progression.

Use zero to two compact symbolic examples only when they teach behavior more
efficiently than instructions. Make them setting-neutral and explicitly
non-canon; local models may recycle names, props, and phrases from examples.

## 8. Author in bounded passes

Use the setting blueprint as a checkpoint so both local and frontier models can
perform the work reliably. Complete and review these bounded passes:

1. authority, intent, player contract, and boundaries;
2. setting pocket, recurring pressure, and route matrix;
3. continuity seed or cold-open state;
4. initial cast and institutions;
5. future ensemble and introduction gates;
6. places, mysteries, state, and retrieval matrix;
7. narrator contract, first message, and optional symbolic examples;
8. source compilation, deterministic fixtures, and package handoff.

Keep the pass number and completion evidence in the blueprint rather than only
in conversational reasoning. Before resuming any pass after compaction, reload
the active skills and the references named for that pass.

Do not ask a local model to invent, normalize, compile, and validate the whole
setting in one generation. Persist accepted outputs between passes and provide
only the current section plus its dependencies. Frontier models may explore
more candidates per pass, but the accepted artifact must remain equally
compact, explicit, and testable.

## 9. Build the package and setting clone

Prefer one authored source of truth and deterministic generated outputs. When
the active project has a setting-pack schema or compiler, extend it rather than
inventing a parallel format. Otherwise complete the blueprint template and use
`$build-sillytavern-character-lorebooks` to create the current card, World
Info, chat-state seed, compiler, tests, and import artifacts.

For a working local deployment, use one complete clone of the owner-designated
SillyTavern fork per setting. The canonical fork/template and every setting
clone are siblings; each clone owns its application code, dependencies,
ignored configuration, user data, plugins/extensions, setting source, generated
artifacts, and adapter state. Create the clone before the long authoring passes,
then build and deploy inside it.

The normal contract is:

1. clone the canonical fork at a recorded revision into the setting directory;
2. install dependencies locally and seed the clone's ignored `config.yaml`
   from the owner-designated standard or the verified release default;
3. create fresh user data for a new setting, seeding only declared non-secret
   standard settings and presets; never copy chats, credentials, or unrelated
   setting content;
4. keep authored source, compiler, tests, generated artifacts, installed card
   and World Info, and setting-owned adapter state in or beneath the setting
   clone;
5. launch through that clone's native visible `Start.bat` or equivalent, using
   the ordinary port unless simultaneous instances were explicitly requested;
6. verify the clone is self-contained and that starting or updating it cannot
   mutate a sibling setting.

Do not add a profile manifest, root setting selector, special launch argument,
shared mutable data root, or unique port by default. Do not derive a new setting
by copying another setting clone's populated data. When migrating an existing
setting, preserve its content and state exactly while moving it into a clean
clone. Keep the model backend outside the setting launcher: a connection preset
is compatibility data, not permission to start, stop, or reconfigure inference.
Follow `references/setting-clones.md` for creation, migration, update, launch,
and verification.

Treat Semantic Play, command decks, dialogue adornment, backgrounds, music,
external reference libraries, and vector retrieval as optional adapters. A
setting must remain playable when any presentation or external-service layer
is absent. Inspect the installed adapter contract instead of assuming fields
from one motivating project.

## 10. Verify playability and context behavior

Create deterministic fixtures for at least:

- the opening and its player-agency handoff;
- a quiet generic location that introduces nobody and advances nothing;
- a narrow observation whose detail may vary but whose scene does not advance;
- inventory, status, or recall that invents no genre-default item or fact;
- an attempted action with only its immediate observable consequence;
- an NPC refusal or disagreement that preserves independent motives;
- pressure on each route without silently locking the path;
- a future name, generic venue, or typed marker failing to admit locked cast;
- a secret question before and after its real reveal gate;
- relationship pressure respecting declared boundaries;
- state continuity after the original trigger leaves recent context;
- the worst credible active retrieval cluster and response reserve.

Also apply these whole-setting failure checks:

- If the player must decide the next plot for the narrator, the pressure system
  is too inert.
- If every important person would follow, admire, or romance the protagonist,
  the ensemble lacks independent life.
- If a tavern, market, academy, or ship summons multiple future companions,
  cast staging has failed.
- If routes differ only by labels or morality color, route design has failed.
- If quiet actions always cause a reveal, arrival, or threat, pacing has failed.
- If a large context window merely made permanent lore larger, context design
  has failed.

Run structural, retrieval, prompt-assembly, leakage, budget, and regeneration
checks before any live inference. Report those deterministic results separately
from manual import evidence and explicitly authorized model qualification.

## Handoff

Lead with what is playable: premise, starting situation, active cast, and what
the player can do next. Then list the authoritative blueprint/source, generated
imports, state seed, acceptance fixtures, rebuild command, import order, and
any optional adapters. For a local playable build, also give the clone path and
revision, native launch command, configuration source, installed content and
extensions, preservation/update boundary, and model-backend boundary. Name
assumptions, provisional material, prompt-absent content, and unverified
live-model behavior plainly.
