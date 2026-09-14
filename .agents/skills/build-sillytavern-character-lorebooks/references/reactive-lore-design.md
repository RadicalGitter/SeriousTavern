# Reactive lore and memory design

Read this reference when a SillyTavern package needs layered characters or locations, contextual behavior, evolving discoveries, secret-aware retrieval, relationship memories, stateful objects, or other subjects that should react to play without occupying permanent context.

Use these patterns for any setting. A subject may be a person, place, group, object, creature, mystery, custom, event, or relationship. Do not introduce domain-specific generators unless the user requests one.

## Define what reactive means

Translate the requested experience into observable context behavior before choosing World Info fields. For each subject, identify:

- what remains true in every scene;
- which facets matter only near a person, place, topic, event, or state;
- who knows each fact and who may reveal it;
- what can change during a chat;
- what persists across chats, and who performs that write;
- what must happen before a hidden fact enters model context;
- what should expire, become ineligible, or be replaced.

Do not equate retrieval with persistence. Keyword activation can recall authored material, but it does not record that a relationship changed, an object was spent, or a secret was discovered. Assign every mutable fact to an actual owner: authored source, chat-bound lore, supported automation, external state, or an explicit manual curation step.

## Decompose subjects into facets

Prefer a small stable core plus conditional facets over a monolithic entry.

1. **Core:** identity, durable traits, public role, and the few facts needed whenever the subject appears.
2. **Context facets:** behavior or knowledge relevant around particular people, places, institutions, topics, or viewpoints.
3. **History facets:** compact memories or causes that matter when a present trigger makes them relevant; avoid dumping a chronological biography.
4. **State facets:** current relationship, damage, ownership, occupancy, alertness, discovery, transformation, or other chat-specific condition.
5. **Secret facets:** hidden truth, clues, false beliefs, and reveal consequences kept distinct.
6. **Color facets:** optional interchangeable details that add variety without changing established facts.

Apply the same shape at different scales:

- A person can have a public core, relationship-specific behavior, remembered incidents, private motives, and current trust or injury.
- A location can have a stable identity, district or room facets, inhabitants, time- or event-sensitive conditions, concealed areas, and current consequences.
- An object can have an observed identity, known uses, owner-specific meaning, hidden properties, activation conditions, and mutable charges or damage.
- A relationship can be its own subject when the pair's shared history or current dynamic would bloat either participant's core.

Do not create facets merely to fill a taxonomy. Merge layers that share the same activation, visibility, persistence, and revision lifecycle.

## Design secrets by model visibility

Classify each secret before authoring entries:

### Model-visible, unrevealed

The model may receive the truth because it needs to portray informed behavior, foreshadowing, deception, or private motivation. State explicitly:

- which characters know it;
- what evidence may be shown;
- what must not be stated or confirmed;
- what event permits disclosure.

This is a behavioral promise, not access control. Use direct-question, mistaken-accusation, unrelated-scene, and pressure-to-explain fixtures to inspect the assembled prompt for unintended disclosure. This cannot prove model compliance without explicitly authorized live testing.

### Prompt-absent until discovered

If even indirect model use would spoil the experience, do not insert the truth before discovery. Author separate layers:

- a public or apparent entry;
- one or more clue entries containing only perceivable evidence;
- the hidden truth in a disabled, gated, or separately maintained entry;
- a post-discovery entry describing what is now established and what changes.

The gate must correspond to real state. A phrase that happened to appear in recent chat is not durable discovery state unless the design intentionally accepts that limitation. Prefer a chat-lore update or verified automation when the fact must remain known after the triggering words leave scan range.

### Character-relative knowledge

Separate objective setting truth from beliefs held by particular characters. A mistaken belief should not be written as unqualified truth merely because it drives behavior. Use viewpoint-specific content and verify that the wrong character or persona does not receive it.

## Choose activation deliberately

Verify the installed SillyTavern version before relying on exact field names or semantics. Select the smallest mechanism that expresses the requirement:

- direct proper-name or alias keys for the subject core;
- secondary or exclusion filters for a facet that requires or forbids additional context;
- bounded recursion for a small intentional neighborhood;
- prioritized groups when one mutually exclusive state layer should win;
- stickiness for a continuous active concern, not durable storage;
- delay or cooldown for message-relative timing where approximate chat-local timing is acceptable;
- character, persona, chat, or generation filters for genuine scope boundaries;
- automation only when a verified script or extension must perform an actual state transition.

Do not use probability for established facts or required state. Do not use embeddings as a substitute for explicit reveal gates. Do not rely on prompt instructions to protect material that must be absent from the model.

Separate admission, current relevance, and budget selection. An introduced-person
list grants eligibility; it must not itself trigger every known biography, even
indirectly through historical relationship notes. Prefer current input and present
subjects while preserving genuine mandatory scene context. Test crowded casts
with changed names and ordering. For deterministic selectors, expose a local
ID/reason trace of admission, relevance, exclusivity and final budget omissions;
account for wrapper text and keep the trace out of the model prompt.

## Represent state in authored source

Extend the source entry shape only as far as the compiler and tests can support. A reactive package may need fields equivalent to:

```text
subjectId
facetId
facetKind
truthClass
knowledgeHolders
modelVisibility
activationIntent
requiresState
excludesState
supersedes
persistenceOwner
content
```

These are source concepts, not assumed SillyTavern JSON fields. Compile them into mechanisms supported by the installed release, and preserve richer planning metadata outside prompt content.

Give states stable semantic IDs. Keep state transitions explicit and reviewable rather than inferring them from prose after generation. When no automation exists, generate a concise chat-state update for the user to approve or apply.

An approved value must survive the complete write path or fail visibly before
mutation. Keep retained facts separate from bounded prompt projection. If storage
is also bounded, validate the entire proposed result before incrementing revision,
marking freshness, or clearing the proposal; never report successful truncation.
Exercise capacity, overlength values, duplicates, no-ops and rejected mixed
batches through the real approval caller. Existing oversized data needs an
explicit compatibility decision, not silent normalization on the next write.

## Plan activation as a matrix

For a complex package, record representative facets before authoring the full corpus:

| Subject/facet | Trigger context | Required state | Excluded state | Model visibility | Persistence owner | Expected active neighbors |
| --- | --- | --- | --- | --- | --- | --- |
| stable core | direct subject mention | none | none | visible | authored source | small local cluster |
| contextual facet | subject plus context | applicable condition | conflicting condition | visible | authored or chat lore | core only |
| clue | perceivable evidence | not discovered | discovered | visible | authored source | public layer |
| hidden truth | explicit reveal gate | discovered | none | absent before gate | chat lore or automation | post-reveal layer |
| current state | active subject or scene | current state ID | superseding state | visible | chat lore | core plus one facet |

Use the matrix to detect two different errors: a fact that cannot activate when needed, and a fact that can activate before it is allowed.

## Verify transitions, not just entries

Test assembled-prompt, retrieval, and state behavior across a deterministic sequence without model inference:

1. **Before contact:** the subject does not activate from ordinary conversation.
2. **Initial contact:** the core and only the relevant public facets activate.
3. **Context change:** the correct relationship, location, or condition facet joins without loading unrelated history.
4. **Pre-reveal pressure:** direct questions and plausible guesses do not leak prompt-absent truth.
5. **Discovery:** the declared gate makes the revealed layer eligible through the real persistence path.
6. **After discovery:** the new state survives beyond the original trigger when persistence was promised.
7. **Replacement or expiry:** superseded facets stop activating and timed material expires as designed.
8. **Wrong scope:** another character, persona, or chat does not inherit private state accidentally.

Also test the worst credible cluster for token budget and recursive fan-out. Report separately what structural simulation proved, what prompt inspection showed, what automation actually changed, and what remains dependent on model compliance and therefore unverified without explicitly authorized live testing.

## Avoid false memory claims

Describe the result precisely:

- Retrieved lore improves selective recall by putting relevant authored facts back into context.
- Chat-bound state can preserve curated facts within the chosen conversation.
- Timed effects can maintain temporary activation for a bounded number of messages.
- A model does not gain durable memory merely because an entry told it to remember.
- Cross-chat or external persistence exists only when a real storage or automation path was implemented and verified.
