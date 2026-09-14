# Self-contained SillyTavern setting clones

Read this reference when a roleplay setting must be locally playable in its own
clean SillyTavern installation. The invariant is simple: one setting directory
is one complete clone of the owner-designated SillyTavern fork. It launches
itself and owns all mutable state used by that setting.

This is intentionally not a shared-checkout profile system. Do not introduce a
profile manifest, root selector, special launch argument, shared mutable data
root, or per-setting port unless the user explicitly asks for that additional
product behavior.

## Completion boundary

A local setting is not deployed merely because import-ready files exist. It is
complete only when the setting clone contains or owns:

- a real Git clone of the designated fork at a recorded revision;
- locally installed dependencies, without external dependency junctions;
- its own ignored runtime configuration;
- its own SillyTavern user data, chats, characters, World Info, presets, and
  extensions;
- setting source, deterministic build and tests, and generated artifacts;
- setting-local plugin or adapter configuration and mutable state;
- a native, visible, owner-closeable launcher;
- deterministic evidence that required content is installed and sibling
  settings remain untouched.

The model backend and weight files may remain external. A connection preset can
point at that backend, but the setting launcher does not own its lifecycle.

## Expected layout

Adapt names to the active workspace while preserving this ownership shape:

```text
SillyTavern/
  SillyTavern/                 canonical fork/template checkout
  Setting-One/                complete fork clone and complete setting
    .git/
    Start.bat
    config.yaml
    node_modules/
    data/
      default-user/
    plugins/
    public/scripts/extensions/ or equivalent client-extension storage
    source/
    generated/
    test/
    build.mjs or equivalent
  Setting-Two/                another independent clone
```

Do not require every project to use the example authoring folder names. The
runtime ownership boundary is mandatory; the source/compiler layout may follow
an existing project convention.

## Discover the canonical fork

Before cloning:

1. Read applicable workspace and repository instructions.
2. Identify the owner-designated canonical fork/template; do not substitute the
   upstream project merely because it is public.
3. Record its remote, branch or revision, installed SillyTavern version, package
   manager, configuration baseline, user-account mode, and native launcher.
4. Inspect only the current platform surfaces required by the task. Use the
   character/lorebook skill's fingerprinted compatibility fast path for card,
   World Info, and storage contracts.
5. Check whether the target directory is absent, an incomplete new setting, or
   an existing setting that must be migrated. Never overwrite an existing
   directory on the assumption that it is disposable.

The canonical fork is a template and update source, not a shared runtime. A
setting clone must not resolve its dependencies, config, data, extensions, or
adapter state through the template directory.

## Create a new setting clone first

If already working inside the designated setting's complete clone, reuse it
and verify the missing pieces below. A request to author inside that instance
does not call for another nested clone. New independent worlds use their own
separate directories.

For a new locally playable setting:

1. Clone the canonical fork into the final setting directory. Preserve the
   fork as `origin`; add or preserve an upstream remote only when the canonical
   fork's normal maintenance workflow uses one.
2. Check out the intended branch or revision and record it in the setting
   blueprint.
3. Install application dependencies inside the clone. Do not junction or
   symlink `node_modules`, caches, or mutable runtime directories to another
   checkout.
4. Seed ignored `config.yaml` from the owner-designated standard configuration
   when one exists; otherwise derive it from the verified release default.
   Change only setting-owned values.
5. Let SillyTavern create a fresh data tree where practical. If deterministic
   scaffolding is needed, create only the directories required by the verified
   release.
6. Seed only explicitly declared, non-secret standard presets and settings.
   Never seed chats, credentials, API keys, personas, or another setting's
   characters, lorebooks, backgrounds, or adapter state.
7. Put the setting blueprint/source, compiler, tests, generated artifacts, and
   optional adapter pack inside the clone or in a project-owned subtree that is
   unambiguously part of that clone.

Creating this runtime shell is the first filesystem milestone. It prevents a
long content build from ending as an import archive with no actual play target.

## Install setting content

Use `$build-sillytavern-character-lorebooks` for the current card, World Info,
storage formats, compiler, retrieval fixtures, and per-file installation rules.
Generated source remains reproducible; installed user-data files are runtime
copies or safe per-file links according to the selected clone's project
contract.

Install only into the setting clone's resolved user-data root. Verify the
actual user handle and storage directories rather than assuming
`default-user`. Never link or replace an entire user, `data`, `worlds`,
`characters`, preset, or extension directory.

The clone may carry setting-specific:

- narrator cards, World Info, chat-state seeds, and model presets;
- client extensions and server plugins;
- Semantic Play or another setting-neutral adapter plus setting-owned rules;
- backgrounds, music interfaces, reference libraries, and memory settings.

Pin or copy runtime plugins/extensions into the clone. An external repository
may remain their development source, but ordinary play must not depend on a
mutable sibling checkout being present. Optional adapters must fail open to
ordinary text roleplay.

## Configuration, port, and launcher

Use the clone's ordinary SillyTavern configuration and native launcher. The
default policy is one instance at a time on the normal port. A different port
is justified only when the user explicitly wants simultaneous instances or an
existing listener creates a real collision.

Filesystem isolation does not isolate browser storage. Sequential instances on
the same origin can share extension `localStorage` keys (for example Input
History), even with independent data directories. Inspect the storage contract
of included extensions and report unresolved cross-world state. Prefer a
setting-aware storage fix where supported; do not silently introduce unique
ports or a shared-profile architecture to claim isolation.

`Start.bat` or the platform equivalent should:

1. run from its own clone directory;
2. set only adapter variables declared by that setting and clear stale optional
   variables that would activate undeclared behavior;
3. invoke the clone's normal SillyTavern start path;
4. keep the service in a visible terminal the owner can close;
5. leave the model backend alone.

Do not create a workspace-level selector when every setting already launches
itself. Do not start a persistent service from an agent's hidden command
session. Starting, stopping, or restarting SillyTavern requires the current
task's authority; offline validation never launches it.

## Preserve and update a setting

Ordinary launch preserves all user-owned data. A rebuild may refresh generated
setting files only through explicit, bounded destinations. Before replacing a
mutable runtime file, preserve the previous version or use the project's
existing rollback mechanism.

Update application code as a normal Git clone:

1. inspect worktree status and preserve setting-owned changes;
2. fetch the canonical fork and review the intended revision;
3. merge or rebase only through the owner's established workflow;
4. reinstall dependencies locally when the lockfile changes;
5. reconcile ignored configuration with the new verified default;
6. rerun platform probes and deterministic setting checks.

Do not centralize setting-owned code or data merely to make updates look
smaller. Disk use below the owner's stated materiality threshold is not a
reason to replace simple clone isolation with a profile system.

## Migrate an existing setting

An existing populated setting is user data, not a seed source for a new one.
For migration:

1. inventory and hash the setting's authored source, generated artifacts,
   installed content, chats, configuration, presets, extensions, plugins,
   adapter state, and backups;
2. create a clean clone of the canonical fork at the intended revision;
3. install dependencies and seed configuration as above;
4. transfer only that setting's inventoried data into the matching verified
   destinations;
5. preserve timestamps or identities where the application relies on them;
6. compare before/after inventories and content hashes;
7. keep the old source recoverable until the user accepts the migration.

Do not silently normalize, prune, or regenerate mutable setting data during a
structural migration.

## Deterministic acceptance

Before handoff, verify without starting a model or hidden service:

- the target is a real Git clone of the designated fork at the recorded
  revision and expected remotes;
- required application files, local dependencies, configuration, native
  launcher, and resolved user-data root exist;
- the setting's source builds deterministically and all structural, retrieval,
  leakage, budget, and agency fixtures pass;
- installed cards, World Info, presets, plugins, and extensions resolve only
  beneath the setting clone;
- a fresh setting contains no chats, credentials, personas, content, or state
  copied from another setting;
- a migrated setting matches its accepted before/after inventory and hashes;
- no dependency, data, config, plugin, extension, or adapter-state junction
  points into another setting or the canonical template;
- the native launcher uses the normal port unless concurrent play was requested
  and does not manage the model backend;
- no workspace-level launcher or profile manifest is required for ordinary
  use;
- sibling clone status and content remain unchanged.

Manual UI launch/import evidence and explicitly authorized live-model evidence
are separate from deterministic acceptance. Report unperformed checks plainly.

## Handoff

Give the user the setting clone path, fork remote and revision, native launcher,
configuration source, resolved user-data root, installed content and adapters,
build and deterministic-check commands, update/rollback boundary, and model
backend boundary. The shortest normal instruction should be equivalent to:
open the setting directory and run its own launcher.
