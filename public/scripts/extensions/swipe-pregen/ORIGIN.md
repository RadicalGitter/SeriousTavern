# Upstream source

Adapted from [Nicoolodion/SillyTavern-SwipePregen](https://github.com/Nicoolodion/SillyTavern-SwipePregen),
commit `57dfab908970508e7f37a99f6e746184ba17c65b`.

Upstream author: nicoolodion. Upstream declares the MIT license in its README,
preserved as `UPSTREAM.md`. The distribution retains that attribution; local
changes are part of SeriousTavern's AGPL-3.0 distribution.

Local integration changes: built-in import paths and manifest activation,
disabled independent auto-updates, a default batch size of one extra swipe,
idempotent activation, restoration/cleanup on errors and cancellation, native
Stop handling, and guards against overlapping batches or restoring a changed chat.

Upstream translations and stylesheet are retained. Updates require reviewing the
source diff and running `npm run test:serious:swipes` before changing this pin.
