# SillyTavern 1.18.0 compatibility contract

Use this contract only when `probe-sillytavern-contract.mjs` returns `known`.
It was verified on 2026-08-31 against package version `1.18.0`, revision
`519401f7a7e4b566c11ab31dd256bde0bed75678`, and the exact hashes in
`sillytavern-contracts.json`. The authoritative surfaces were
`src/validator/TavernCardValidator.js`, `src/endpoints/characters.js`,
`src/endpoints/worldinfo.js`, and `public/scripts/world-info.js`.

## Character cards

The normal JSON export is Character Card V2:

- top level: `spec: "chara_card_v2"`, `spec_version: "2.0"`, and `data`;
- required `data` fields: `name`, `description`, `personality`, `scenario`,
  `first_mes`, `mes_example`, `creator_notes`, `system_prompt`,
  `post_history_instructions`, `alternate_greetings`, `tags`, `creator`,
  `character_version`, and `extensions`;
- optional `data.character_book` requires its own `extensions` object and an
  `entries` array;
- the local validator also accepts `chara_card_v3` with a `3.x` spec version,
  but the V2 construction/export path is the established target here.

An embedded character-book entry uses the portable fields `id`, `keys`,
`secondary_keys`, `comment`, `content`, `constant`, `selective`,
`insertion_order`, `enabled`, `position`, `use_regex`, and `extensions`.
SillyTavern-specific retrieval options are preserved in `extensions`, including
position, probability, depth, selective logic, recursion flags, grouping,
matching options, role, vectorization, sticky/cooldown/delay, extra scan
sources, triggers, and `ignore_budget`.

## Standalone World Info

A standalone lorebook is an object with `entries`, whose value is an object map
keyed by UID. Each map key must agree with the entry's integer `uid`. Use the
current application names:

```text
uid, key, keysecondary, comment, content, constant, vectorized, selective,
selectiveLogic, addMemo, order, position, disable, ignoreBudget,
excludeRecursion, preventRecursion, matchPersonaDescription,
matchCharacterDescription, matchCharacterPersonality,
matchCharacterDepthPrompt, matchScenario, matchCreatorNotes,
delayUntilRecursion, probability, useProbability, depth, outletName, group,
groupOverride, groupWeight, scanDepth, caseSensitive, matchWholeWords,
useGroupScoring, automationId, role, sticky, cooldown, delay, triggers
```

Defaults for new entries include selective matching, order 100, position 0,
100% probability, depth 4, system role 0, empty keys/content/groups/triggers,
and null per-entry overrides for scan depth, matching, sticky, cooldown, and
delay. `disable` is the inverse of embedded `enabled`.

## Retrieval behavior to simulate

The default global settings are 25% World Info budget, scan depth 2, recursion
off, and no absolute budget cap. Effective budget is the rounded percentage of
maximum context, at least one token, capped when the configured cap is positive.

For deterministic acceptance tests, reproduce these decision-changing rules:

1. Load chat, persona, character, and global books according to the active
   strategy. Entries are initially ordered by descending `order`; chat and
   persona books receive their own precedence.
2. Skip disabled entries, nonmatching generation triggers and character
   filters, active delay, cooldown without sticky, and recursion-excluded or
   not-yet-admitted delayed-recursion entries.
3. Constant, active-sticky, external, and explicit activation entries bypass
   keywords. Otherwise require a primary key and apply the selected secondary
   logic: AND-any, AND-all, NOT-any, or NOT-all.
4. Resolve inclusion groups before probability and budget. Active sticky entries
   defeat non-sticky group members; scoring may remove lower-scoring members;
   explicit group override wins by order; otherwise selection is weighted.
5. Process active sticky entries before normal candidates, then preserve the
   previously sorted order. Sticky entries do not reroll probability.
6. Reject a normal entry when existing activated text plus the accumulating
   candidate content is greater than or equal to the token budget. After
   overflow, only `ignoreBudget` candidates remain eligible. Test boundary and
   ordering cases against the application when exact token parity matters.
7. Recursion continues only when enabled, the budget has not overflowed, and
   newly accepted content can trigger another eligible entry. Respect
   `preventRecursion`, `excludeRecursion`, delayed recursion levels, and the
   configured maximum recursion steps.
8. Sticky, cooldown, and delay are chat-length timed effects stored in chat
   metadata and bound to the world UID plus entry hash. Sticky activation can
   begin cooldown when it ends. Dry runs must not mutate these effects.
9. Activated entries are finally distributed by position. Within a destination,
   the implementation's descending-order collection plus `unshift` means joined
   prompt content appears low-order before high-order.

A package simulator may conservatively approximate tokenizer counts, matching,
or randomized groups only when it labels that approximation and has fixtures
for the authored book's actual options. It must not claim exact application
parity while omitting an option the package uses.

## Escalation boundary

Do not reopen these four source files when the probe reports `known`. Inspect a
delta only when hashes change, a deterministic fixture contradicts this
contract, or the task relies on a surface not covered here. Preserve the new
evidence as a new fingerprinted contract rather than overwriting this one.
