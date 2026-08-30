# SeriousTavern extension admission ledger

Kind: supporting research and compatibility evidence.

Status: active; reviewed 2026-08-30 against the SeriousTavern release branch.

Authority: this ledger explains decisions. `extensions.lock.json` is the sole
implementation truth for installed packs, and accepted setting packs remain
the authority for setting facts. Community popularity is discovery evidence,
not admission evidence.

## Admission test

An extension enters a default pack only when it has a clear role, bounded data
and prompt effects, an exact reviewed commit, no unresolved overlap with
Semantic Play, and a useful failure mode on a local 27B-class model. Extensions
that infer campaign truth, write lore, mutate chat history, add automatic model
calls, or take over the interface require an isolated experimental profile.

The 2026-08-30 Reddit survey repeatedly recommended Prompt Inspector,
WorldInfo Info, and one memory system rather than several. That supports the
existing diagnostic-and-single-memory baseline. Reddit also supplied useful
failure reports, but source repositories and local inspection determined the
decisions below.

## Admitted to `roleplay-v1`

### Input History

- Source: [LenAnderson/SillyTavern-InputHistory](https://github.com/LenAnderson/SillyTavern-InputHistory)
- Pin: `1ba5491dbe4287f77c12a2114c9a5ddf26a7fbe8` (manifest version 1.6.1)
- Benefit: `Alt+Up` and `Alt+Down`, buttons, and a searchable menu recall recent
  prose, commands, and slash commands. This directly supports Semantic Play's
  command-like input loop.
- Prompt/model effect: none.
- Data effect: the most recent ten inputs persist in browser `localStorage`
  under `st--inputHistory`. This can include private text. Different profile
  ports produce different browser origins and therefore separate histories.
- Audit: no fetch, WebSocket, API endpoint, generation, or chat mutation path
  was present in the reviewed source.

## Reviewed, held out of the default

### More Flexible Continues

- Source: [LenAnderson/SillyTavern-MoreFlexibleContinues](https://github.com/LenAnderson/SillyTavern-MoreFlexibleContinues)
- Reviewed head: `569ec3662470600b76e3c3d6a2e1713fdbf7adbf`
- Benefit: list, remove, regenerate, and add assistant continuations.
- Hold reason: it directly rewrites continue metadata, swipes, and chat message
  content. Admit only after branch, swipe, edit, reload, and Summaryception
  characterization tests.

### Quick Persona

- Source: [SillyTavern/Extension-QuickPersona](https://github.com/SillyTavern/Extension-QuickPersona)
- Reviewed head: `5509fb6bee903c833683cb860fbf437d4479b1cb`
- Benefit: switches saved personas from the chat bar with no helper model.
- Hold reason: a fixed campaign profile should not invite accidental player
  identity changes. It can join a future multi-campaign quality-of-life pack.

### Memory Books and Qvink Memory

- Sources: [Memory Books](https://github.com/aikohanasaki/SillyTavern-MemoryBooks)
  and [Qvink Message Summarize](https://github.com/qvink/SillyTavern-MessageSummarize)
- Benefit: more manual control than Summaryception, with editable scene or
  per-message memories and optional separate summary profiles.
- Hold reason: each is an alternative memory authority and model-call pattern,
  not an additive utility. Qualify one at a time against Serenity, never beside
  another automatic memory engine in the same profile.

## Experimental profile only

### Guided Generations

[Guided Generations](https://github.com/Samueras/GuidedGenerations-Extension)
offers guided responses, swipes, persistent situational/state/thought guides,
correction passes, separated thinking, and per-tool model profiles. It is an
impressive general co-writing suite, but most of that surface duplicates
Semantic Play's semantic commands, `[]` control, and `{story gravity}`. Several
features add helper generations or automatic post-generation correction, so it
needs a separate local-model latency and prompt-composition experiment.

### ScenePulse

[ScenePulse](https://github.com/xenofei/SillyTavern-ScenePulse) injects a tracker
schema on every assistant turn, asks the roleplay model to append JSON, repairs
and extracts that JSON, and may make a fallback generation when it is missing.
Its dashboard is attractive, but inferred relationships, quests, mood, and
state would compete with explicit Semantic Play state. It is useful as a design
reference, not as an installed authority.

### RPG Companion

[RPG Companion](https://github.com/SpicyMarinara/rpg-companion-sillytavern)
tracks stats, inventory, quests, present characters, relationships, thoughts,
and scene data through inline structured output or a second call. The original
extension is now marked deprecated and community-maintained while development
moves to Marinara Engine. It overlaps Semantic Play almost completely.

### ST-Copilot and WorldInfo Recommender

[ST-Copilot](https://github.com/Supker/ST-Copilot) can brainstorm out of
character and propose edits to lorebooks, characters, and chat history.
[WorldInfo Recommender](https://github.com/bmen25124/SillyTavern-WorldInfo-Recommender)
uses a model and structured output to draft or update lore. Both are promising
authoring assistants, but neither should write campaign authority automatically.
Any future trial must keep proposals behind an explicit diff and user approval.

### Plot drivers

[Fawn's Plot Driver](https://github.com/fawn1e/st-plot-driver) and similar story
drivers generate time skips or twists. They duplicate the lighter trailing
`{story gravity}` channel, whose purpose is to suggest direction without making
the player decide the next event. Revisit only if that native mechanism fails
in Serenity tests.

## Not admitted

### ProbablyTooManyTabs

[ProbablyTooManyTabs](https://github.com/IceFog72/SillyTavern-ProbablyTooManyTabs)
contains inventive layout, palette, and character-dialogue coloring work, but
it requires SillyTavern staging, replaces broad layout and mobile styling, and
its development is frozen. A recent community report also isolated an
interaction with WorldInfo Info. SeriousTavern should borrow ideas through its
own bounded MUD presentation layer rather than install the whole UI takeover.

### TunnelVision-style automatic lore graphs

The community reports an appealing initial experience followed by slow large
lorebooks, costly backfills, reroll problems, and extra tool-call latency. That
failure shape is the opposite of the small, inspectable, local-model-friendly
core. Reconsider only with a bounded benchmark and a disposable campaign.

## Revisit gates

- `Input History`: verify keyboard/buttons and profile separation in the next
  stopped-profile browser smoke test.
- `More Flexible Continues`: characterize continuation metadata across swipes,
  branches, edits, reloads, and memory compaction.
- memory alternatives: run matched long-chat Serenity tests with one engine at
  a time and inspect the exact prompt through Prompt Inspector.
- tracker suites: require explicit proposal/accept state separation and measure
  added tokens, latency, JSON reliability, and narrative degradation.
- layout/color systems: implement name, pronoun, quote, and dialogue coloring
  as a narrow SeriousTavern/Semantic Play feature rather than accepting a frozen
  layout owner.
