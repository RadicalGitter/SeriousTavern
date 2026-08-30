# SeriousTavern roleplay distribution

Status: implemented operations and reference contract for the personal fork.

Authority: SillyTavern owns platform behaviour; setting packs own accepted
setting facts; each raw chat owns its transcript; explicit Semantic Play state
owns curated play state. This directory owns only the reproducible extension
bundle and its safe profile defaults.

SeriousTavern is an upstream-compatible SillyTavern fork, not a bundle of
vendored extension code. The bootstrap clones reviewed extensions into an
explicit profile data root at commits recorded in `extensions.lock.json`.
Chats, notes, settings, keys, models, generated summaries, and extension source
trees remain ignored user data.

## Roleplay v1 bundle

| Extension | Role | Context effect |
| --- | --- | --- |
| Summaryception 5.5.3 | Compresses older chat into layered deltas; raw messages remain recoverable | Injects a fallible memory block |
| Prompt Inspector | Shows the exact assembled request before sending | Observational unless the user edits that one request |
| WorldInfo Info | Reports activated World Info entries | Observational |
| Notebook | Stores human-authored rich-text notes | None automatically |
| Timelines | Searches and navigates chat branches | None |
| Input History | Recalls recent player inputs and slash commands | None |

Summaryception is deliberately held at commit `c67626a`. The current upstream
head changes the injected role/depth and contains an unqualified error path in
its direct OpenAI-compatible connection branch. It can be reconsidered only
after prompt-shape and local-connection qualification.

Third-party UI extensions execute with the same browser privileges as
SillyTavern itself. A pin is reproducibility evidence, not a sandbox. Updating
one requires a source diff, a prompt/storage review, deterministic checks, and
one clean-profile smoke test before changing the lock.

## Memory authority contract

Summaryception output is a derived cache, not proof and not canon. When sources
conflict, use this order:

1. accepted setting-pack content for permanent setting facts;
2. explicit, user-curated Semantic Play state for the active campaign;
3. recent verbatim chat for what was actually said or narrated;
4. Summaryception memory only as a fallible continuity hint.

The preset keeps eight recent assistant turns verbatim, summarizes three at a
time, retains the raw chat, disables SillyTavern's stock Summary and Chat
Vectorization, and labels injected memory as fallible. It also tells the
summarizer that square-bracketed OOC control and trailing `{story gravity}` are
instructions rather than fictional events. Serenity's 512-token summarizer
ceiling was chosen from a local continuity replay: 256 tokens cut a valid delta
mid-clause, while 512 completed naturally. This is a ceiling, not a request for
longer prose; the one-line, 16-clause delta contract remains the size control.

Notebook is intentionally human-only and is not injected. A note becomes model
context only when the player deliberately moves its content into an accepted
state or lore entry. WorldInfo Info and Prompt Inspector diagnose retrieval;
they do not decide truth.

Input History is the command-line convenience layer for the MUD-style input
loop. It stores the ten most recent submitted inputs in browser `localStorage`
under `st--inputHistory`, so commands survive reloads but may contain private
text. SeriousTavern profiles use distinct browser origins, keeping those
histories profile-local. Clear site data to remove the history.

## Alternatives held out of the default

The dated evidence and admission status for the broader extension survey lives
in [`extension-admission.md`](extension-admission.md). The lock file remains the
sole implementation truth for what a pack installs.

- Memory Books is the strongest experimental alternative for scene-bounded,
  editable lorebook memories. It is mutually exclusive with Summaryception in
  a profile and needs direct structured-JSON qualification with the chosen
  local model before use.
- Vadash Summaryception v22 has useful dual narrative/state memory and cache
  work, but its larger defaults and active refactor make it an experimental
  channel rather than the stable default.
- Summaryception + Lorebook and automatic Memory Books lore ingestion can write
  proposals into World Info. They stay off until their review queue and
  promotion boundary are tested against a disposable lorebook.
- Chat Vectorization stays off: it adds an embedding dependency, reshuffles
  prompt history, reduces prompt-cache stability, and offers no guaranteed
  memory improvement.
- Smart Context is deprecated by SillyTavern and is not admitted.

Never run two automatic memory engines in one profile.

## Bootstrap and audit

From the SeriousTavern checkout:

    node serious-tavern/bootstrap.mjs --data-root <profile-data> --config-path <profile-config> --port <profile-port> --pack roleplay-v1

The first settings application creates timestamped backups under
`<profile-data>/serious-tavern/backups/`. Later runs install missing extensions
but preserve changed commits and profile settings, reporting drift instead of
silently overwriting it.

To verify without network or mutation:

    node serious-tavern/bootstrap.mjs --data-root <profile-data> --config-path <profile-config> --port <profile-port> --pack roleplay-v1 --check

After consciously changing the lock or preset:

    node serious-tavern/bootstrap.mjs --data-root <profile-data> --config-path <profile-config> --port <profile-port> --pack roleplay-v1 --refresh-extensions --force-settings

`--refresh-extensions` refuses dirty, linked, non-Git, or wrong-origin
directories. `--force-settings` backs up before changing settings or config.
Automatic UI-extension and server-plugin updates are disabled in each managed
profile so SillyTavern cannot silently move past the reviewed pins on a version
change.

Run the offline contract checks with:

    node --test serious-tavern/test/bootstrap.test.mjs
