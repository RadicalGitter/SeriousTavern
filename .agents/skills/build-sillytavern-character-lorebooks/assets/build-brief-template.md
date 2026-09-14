# Character card and lorebook build brief

## Outcome

**Mode:** [brief / build / audit / curate]

**Intent anchor:** [One sentence describing the playable experience and why retrieval is needed.]

**Success looks like:** [What can the user import or play when this is finished?]

## Runtime target

- SillyTavern version: [installed release or verification target]
- API/backend: [text completion or chat completion route]
- Compatibility target: [model or model family; informational only]
- Artifact portability target: [none / named formats or model families]
- Context size: [tokens]
- Tokenizer: [tokenizer]
- Prompt inspection available: [yes/no]
- Live inference authorized: [no by default / exact explicit request]
- Runtime-state actions authorized: [none by default / exact permitted actions]

## Authority and truth

**Authoritative sources:**

- [source + exact section/revision]

**Permitted inference:** [What may be invented to make the card playable?]

**Explicit exclusions:**

- [content, campaign, privacy, spoiler, or write boundary]

**Truth classes and promotion:**

| Class | Meaning | May become authoritative when |
| --- | --- | --- |
| [class] | [meaning] | [review/admission rule] |

## Deliverables

- [ ] Authored source
- [ ] Deterministic compiler
- [ ] Character card with primary embedded lorebook
- [ ] Standalone main lorebook
- [ ] Chat-bound state/Chronicle lorebook
- [ ] Optional model preset
- [ ] Import instructions
- [ ] Structural and retrieval tests

**Source location:** [path]

**Generated location:** [path]

**Regenerate command:** [command]

## Character or narrator contract

- Role/identity: [who or what the card portrays]
- Player/user agency boundary: [what it must never decide]
- Viewpoint and knowledge boundary: [what can be known or revealed]
- Voice and prose behavior: [style, tense, dialogue]
- Causality and uncertainty: [how consequences and unknown mechanics are handled]
- First greeting: [entry mode]
- Alternate greetings: [materially different entry modes]
- Examples: [only behaviors that need demonstration]

## Context layers

### Permanent foundation

[Only identity and rules needed on every generation.]

### Retrieved lore

- [subject family, expected entry count, and connections]

### Chat-bound state

- [facts that belong only to one conversation]

### Curation

[Command or workflow that separates established facts, inventions, conflicts, proposals, supporting scenes, and the factual state update.]

## Reactive subjects and secrets

**Advanced reactive design needed:** [yes/no + why]

| Subject/facet | Trigger context | Required state | Excluded state | Model visibility | Persistence owner | Expected active neighbors |
| --- | --- | --- | --- | --- | --- | --- |
| [stable core or conditional facet] | [keys/context] | [state or none] | [state or none] | [visible / unrevealed / absent until gate] | [source / chat lore / automation / manual curation] | [bounded cluster] |

**Secret policy:**

- Model-visible but unrevealed: [facts, knowledge holders, allowed clues, reveal condition]
- Prompt-absent until discovered: [public layer, clues, real reveal gate, post-discovery layer]
- Character-relative beliefs: [holder, belief, conflicting objective truth]

**State transitions and persistence:**

- [prior state] -> [event or approved update] -> [new state]
- Persistence mechanism: [chat lore / verified automation / external state / manual update]
- Superseded or expiring facets: [policy]

## Retrieval policy

- Scan depth: [messages]
- World Info budget: [tokens]
- Expected entry size: [tokens]
- Maximum recursion: [passes]
- Sticky policy: [duration and eligible subjects]
- Vector retrieval: [off/on + evidence]
- Probability/groups: [policy]
- Key design: [names, aliases, phrases, secondary keys, avoided generic keys]
- Scope filters: [character/persona/chat/generation restrictions]
- Timed effects: [sticky/cooldown/delay policy or none]
- Automation: [verified transition only, or none]

## Context envelope

| Case | Permanent | Active lore | History/output reserve | Result |
| --- | ---: | ---: | ---: | --- |
| Opening | [tokens] | [tokens] | [tokens] | [pass/fail] |
| Ordinary scene | [tokens] | [tokens] | [tokens] | [pass/fail] |
| Worst credible recursion | [tokens] | [tokens] | [tokens] | [pass/fail] |
| Curation | [tokens] | [tokens] | [tokens] | [pass/fail] |

## Verification

### Automated

- [ ] JSON and current format/version validation
- [ ] Stable unique source IDs and deterministic UIDs
- [ ] Duplicate normalized keys absent or explicitly expected
- [ ] Exact object-key/UID agreement
- [ ] Embedded/standalone parity
- [ ] Valid activation and insertion settings
- [ ] Deterministic regeneration
- [ ] Locally available tokenizer budget checks or labeled estimate; no model download
- [ ] Forbidden-content/provenance scan

### Application and deterministic prompt fixtures

- [ ] Character import
- [ ] Standalone and chat-lore import
- [ ] Intended proper-name activation
- [ ] Bounded recursion
- [ ] No unrelated common-chat activation
- [ ] Constant-entry and recursive-content closure remains bounded
- [ ] Agency and knowledge-limit scene
- [ ] Continuity/state scene
- [ ] Correct contextual facet and wrong-scope exclusion
- [ ] Pre-reveal pressure does not leak prompt-absent truth
- [ ] Reveal follows the declared gate and persistence path
- [ ] Superseded or timed facets stop activating as designed
- [ ] Curation separation

### Optional live model testing

Leave this section unused unless the user explicitly requested live inference in the current task.

- [ ] Explicit live-inference request recorded
- [ ] Named target and scenes bounded
- [ ] Any permitted runtime-state actions listed separately
- [ ] Live smoke-play performed without unrequested downloads, loads, starts, stops, or reconfiguration
- [ ] Second-model comparison explicitly requested, if performed

## Unresolved choices

- [Question, current assumption, consequence if wrong, and who decides.]
