# Model, context, and state design for roleplay settings

Read this reference when the setting targets a local model, uses Semantic Play
or another state layer, needs long-campaign memory, gates future cast or
secrets, includes model presets, or will undergo live qualification.

## Contents

- Local-first architecture
- Authoring with local and frontier models
- Context layers and budgets
- Model presets and request evidence
- Narrator contract design
- Semantic response scope
- State ownership
- Cast and reveal gates
- Retrieval and external knowledge
- Memory and compression
- Optional adapters
- Deterministic verification
- Live qualification

## Local-first architecture

Move bookkeeping, permissions, retrieval, and display into deterministic code
or explicit user-owned state whenever the application can do them more
reliably than the roleplay model. Let the model spend capacity on language,
character reasoning, uncertain consequences, and scene portrayal.

The same package should work with a capable local model and a frontier model.
Do not create a vague frontier contract and a rigid local rewrite. Create one
compact semantic contract, deterministic context assembly, and optional
provider presets. A stronger model may supply more nuance; it does not receive
more authority over truth or state.

Use capability tiers:

1. **Portable baseline:** narrator card, keyword lore, explicit chat-state
   seed, manual curation, and deterministic fixtures.
2. **Managed local play:** application-owned intent hints, state gates,
   introduction admission, and reviewable state proposals.
3. **Optional enrichment:** summaries, vectors, reference libraries,
   backgrounds, music, or other presentation adapters.

Failure in a higher tier must fall back to ordinary roleplay rather than block
the baseline.

## Authoring with local and frontier models

Local authoring succeeds when the task surface is bounded and accepted work is
persisted between passes.

- Give the model the setting blueprint section being edited, the intent anchor,
  and only directly dependent accepted sections.
- Ask for a small number of strong candidates rather than exhaustive lists.
- Separate ideation, selection, normalization, compilation, and validation.
- Use stable field names and explicit truth/status labels.
- Require the model to state uncertainty instead of filling every blank.
- Review and save one coherent pass before beginning the next.
- Run deterministic checks outside the model.

Do not ask one generation to ingest a large canon corpus, invent a campaign,
write every character, generate imports, and validate retrieval. If a local
model needs correction, identify the failed contract and rerun only that
section. Avoid repeatedly pasting the entire setting back into its context.

A frontier model can compare more alternatives or reconcile more source
material in one pass, but still writes the same blueprint and passes the same
gates. Fluency is not evidence that state, canon, or retrieval is correct.

## Context layers and budgets

Budget the assembled prompt, not the source repository. Define and measure:

- permanent narrator and foundation content;
- ordinary active lore for one scene;
- worst credible gated or recursive cluster;
- chat-state snapshot;
- example-message cost;
- recent verbatim chat retention;
- response and reasoning reserve where applicable.

Treat a large context window primarily as room for high-quality recent play,
not permission to make permanent definitions larger. Keep constant contracts
few, compact, and non-recursive. Put one coherent subject or facet in each
retrieved entry. Keep cross-references intentional and shallow.

Start with deterministic keyword and state retrieval. Add embeddings only
after representative fixtures show meaningful misses and the experiment
measures relevance, leakage, latency, and prompt cost. A vector match cannot
authorize a reveal.

Use the target tokenizer when it is already locally available without loading
model weights; otherwise label estimates. Follow
`$build-sillytavern-character-lorebooks` for current artifact-level budget and
retrieval checks.

## Model presets and request evidence

Keep the owner's prose prompt separate from connection compatibility work.
When the owner supplies the narration prompt, preserve it; fix transport,
retrieval and state behavior without introducing a competing narration contract.

Inspect the chosen release's native preset mapping and final serialized request.
A launcher default, preset label or UI control alone does not establish the
effective value: custom body merges, exclusions and message post-processing can
change it. Check model alias, endpoint, sampler values, role order, response
allowance and any structured-output schema through the actual request route,
using an intercepted transport for offline verification. Include streaming and
quiet state-harvest paths when the setting uses them. Retain native card, lore
and history markers; change role conversion only for a demonstrated backend need.

Distinguish thinking generation, historical reasoning reinsertion, and saved
reasoning display/storage. If the owner requests no reasoning preservation,
configure both backend/template preservation and application history reinsertion.
Do not infer permission to erase saved reasoning or modify an external launcher.
Capture the outgoing override and report any unmodified launcher contradiction;
offline serialization does not prove that a running backend honors the flag.

Derive context and generation reserve from the selected target, not a previous
model's preset. Subtracting response allowance is budget arithmetic, not a
tokenizer measurement. Keep exact aliases, ports, samplers and response limits
in project-owned presets; a passing transport test does not make them optimal.

Report evidence at its actual level: source fixtures, generated-module checks,
final serialized transport, full browser assembly, and live model evaluation.
Passing supplied messages through a real backend handler does not verify the
browser's card/lore/summary assembly or extension event order.

## Narrator contract design

Local models benefit from short, stable operational vocabulary. Define terms
once and use them consistently. Prefer positive instructions paired with the
specific forbidden over clusters of near-synonyms.

Organize the contract by responsibility:

1. identity and setting authority;
2. player-agency and viewpoint boundary;
3. response scope and stopping condition;
4. causal and character independence;
5. cast, reveal, and relationship gates;
6. optional markup or control syntax;
7. setting-specific commitments and exclusions.

Avoid repeating every rule in description, personality, scenario, system
prompt, and lorebook. Reinforce only a demonstrated weak point. Put backend
template, sampling, reasoning, and output parameters in a separate preset.

Examples should be scarce. Zero is valid. When used, teach a contrast that the
contract alone did not reliably convey. Setting-neutral examples reduce but do
not eliminate imitation risk.

## Semantic response scope

Terse natural language should remain valid roleplay input. Separate at least
these dimensions:

- **progression:** hold the current beat, resolve an attempt, advance one beat,
  or allow a bounded spotlight;
- **detail:** direct, contextual, ordinary, or heightened;
- **presentation:** factual answer, descriptive prose, dialogue, or staged
  moment;
- **scope:** one referent, current scene, or a broader explicit review.

An inspection can be richly detailed while progression remains held. A direct
inventory or status question can be concise even during a tense scene. An
action resolves the attempt and immediate observable consequence, then stops
before the player's next decision. Dialogue allows the addressed characters to
answer without forcing a separate plot development.

Do not use hard word counts as a substitute for scope. Paragraph structure and
a clear stopping condition usually preserve quality better across contexts.

If no intent layer exists, encode the distinctions in the narrator card and
optional Quick Replies. If Semantic Play or an equivalent layer exists, pass a
small request-local control note without rewriting saved chat prose.

## State ownership

Chat state should be legible, compact, and owned outside model prose. A useful
baseline includes:

- phase and path signals;
- current time and location;
- present and introduced identities;
- known possessions and conditions;
- commitments and relationship facts;
- discoveries and resolved uncertainties;
- open threads;
- exact admission or reveal markers;
- the transcript revision through which volatile scene facts were reviewed.

Separate durable facts from volatile scene snapshots. A commitment or
relationship remains accepted until play changes it; location or present cast
may become stale after one turn. Recent verbatim chat outranks an older scene
snapshot, and the interface should make staleness visible.

The model may propose a state change only when:

- the operation is explicitly requested;
- allowed fields are schema-bounded;
- each change cites transcript evidence;
- the proposal is tied to the exact transcript fingerprint and state revision;
- intervening edits, swipes, messages, or state changes invalidate it;
- the user selects and applies changes;
- reveal markers, hidden truth, presentation, and external spending remain
  outside model authority.

Do not hide state output inside every roleplay response. That increases prompt
cost, leaks implementation detail, and invites malformed or fictional updates.

## Cast and reveal gates

There are two independent gates:

1. **Admission:** whether an introduction packet or hidden truth may enter
   context now.
2. **Introduction/discovery:** whether the resulting person or fact has become
   established in play and may be retrieved later.

A raw player message must not self-admit a marker by typing its name. The
application selects managed entries from accepted state, and the raw message is
only scan input. Locked entries remain absent in both content and identifiers.

For future cast:

- give every introduction a state condition tied to a situation;
- place competing introductions in one exclusive group when only one should be
  unresolved;
- keep the person's ordinary core gated by the introduced-identity list;
- add aliases and display metadata only after introduction;
- record a causal fallback rather than a fixed queue position.

For secrets, distinguish model-visible unrevealed motives from prompt-absent
truth. The latter needs a real state gate and a post-discovery layer. Retrieval
probability, embeddings, instruction wording, or recency do not provide access
control.

## Retrieval and external knowledge

Use setting-authored lore for campaign-specific facts and divergences. External
knowledge can provide bounded texture when its authority and precedence are
explicit:

    accepted campaign facts > reviewed play state > authored setting lore
    > bounded external reference > model recollection

An external library should be read-only by default, admit only a small excerpt,
label provenance, and never become state. Prefer exact aliases and explicit
inspection before semantic retrieval. Do not give the roleplay model an
unbounded search tool merely because retrieval is available; this can increase
latency, distract from present reasoning, and import conflicting canon.

## Memory and compression

When the owner already requests, edits and places a summary in a dedicated
context slot, use that as the continuity workflow. Preserve recent dialogue
alongside the accepted summary and select only relevant lore. Do not add an
automatic memory engine or parallel state ledger just to formalize the same
facts. Record the summarized span where useful and avoid overlapping duplicate
summaries. Preserve source canon separately; summary editing does not silently
rewrite it. If an adapter uses structured reveal gates, those gates still need
explicit accepted changes rather than inference from summary wording.

Automatic memory layers are derived caches, not a second canon. Preserve recent verbatim
chat as long as the measured context envelope permits. Do not compress on an
arbitrary small turn count merely because summarization exists.

When compression is needed:

- keep accepted state and reveal gates outside the summary;
- preserve decisions, promises, causes, unresolved uncertainty, and changing
  relationships over decorative prose;
- retain exact wording only when wording itself matters;
- record what span the summary covers;
- make replacement or rollback possible;
- inspect actual prompt occupancy and summary loss before tuning cadence.

Vector memory may improve recall but cannot decide truth, progression, or
disclosure.

## Optional adapters

Setting packs may provide optional metadata for:

- deterministic identity color and dialogue markup;
- a MUD-like command deck;
- exact-location background projection;
- local reference lookup;
- soundtrack scene briefs and explicit generation approval;
- image, voice, or visual-novel presentation.

Keep each adapter one-way and authority-limited. Display never edits transcript
or state. A background maps accepted location to an allowlisted local asset,
not the reverse. Music and image providers receive only public positive
whitelists, never hidden setting truth or raw private chat. External submission
requires explicit approval and failure never blocks text play.

Inspect the active project's adapter schemas. Do not copy one setting's marker
names, file layout, dialogue wrapper, color palette, or provider configuration
into a global skill.

## Deterministic verification

Before inference, test the assembled behavior with source fixtures:

| Fixture | Expected behavior |
| --- | --- |
| ordinary quiet turn | only permanent contract; no unrelated lore or arrival |
| proper name | one public subject core and intentional neighbors |
| common venue | no future cast activation |
| typed marker | no managed state admission |
| admitted introduction | one packet from its exclusive group |
| person not introduced | public core absent even if name is typed |
| person introduced | public core eligible by name or alias |
| pre-reveal question | prompt-absent truth absent |
| post-reveal state | revealed layer present and prior layer superseded |
| observation | progression held; player interiority absent |
| attempted action | immediate consequence only |
| inventory or status | established facts only; no genre defaults |
| refusal | NPC boundary and alternative remain possible |
| route visit | path remains open unless commitment is explicit |
| worst active cluster | within budget with response reserve |
| regeneration | authored source produces byte-stable generated artifacts |

Inspect prompt contents, not only retrieval IDs. Confirm raw input cannot break
wrappers or be copied into managed context. Validate unknown values, oversized
state, duplicate keys, recursion fan-out, and stale generated files.

These checks prove structure and context assembly. They do not prove prose
quality or model compliance.

## Live qualification

Run live inference only after explicit current-task authorization. Use a small
matrix of representative scenes rather than unbounded play:

- narrow inspection in a tense and a quiet context;
- mixed action and dialogue;
- player refusal or unexpected route choice;
- NPC disagreement and boundary maintenance;
- quiet generic location with locked cast;
- direct secret pressure before reveal;
- relationship pressure at declared boundaries;
- continuity after enough chat to stress memory;
- malformed optional markup and safe fallback;
- an ordinary long-form scene for voice and pacing.

Record the exact card, lore, state, preset, model, quantization, backend,
template, sampler, reasoning mode, context, seed where supported, and prompt
assembly. Separate deterministic passes, automated surface checks, and human
quality review. A fluent response does not repair a failed gate, and one failed
generation does not justify silently changing campaign truth.
