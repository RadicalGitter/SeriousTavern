# Swipe Pregeneration

Status: bundled native extension, enabled by default for fresh profiles.

Source: `public/scripts/extensions/swipe-pregen/`. Attribution and the exact
reviewed upstream commit are in that directory's `ORIGIN.md` and `UPSTREAM.md`.
There is no nested Git repository or installation-time download. The normal
extension discovery/activation path loads it, while a user's disabled-extension
choice remains respected. Updates ship with the SeriousTavern fork.

## Use

After an assistant reply, click the double arrow next to the swipe controls to
generate one additional swipe. The current reply stays readable, including its
rendered formatting. Once generation finishes, the viewed swipe and its saved
metadata are restored; the new alternative remains accessible with the arrows.

For several alternatives, open **Wand menu → Swipe pre-generation**. The count
means additional swipes; one extra gives two replies total. Requests run
sequentially using the connected backend's existing generation settings. Stop
interrupts the active generation and cancels the remaining queue. A chat switch
cancels the queue and prevents this extension from restoring or saving a
different conversation.

This does not turn on two replies automatically for every normal Send. No request
runs on installation, startup or message receipt. The feature works through
native swipe generation even when a backend returns only one choice per request.
It changes no prompt assembly, backend config, retained-thinking setting or
conversation content outside the native addition of requested swipe alternatives.

## Verification

Run `npm run test:serious:swipes` after installing root and `tests/` dependencies
locally as described in `AGENTS.md`. The checks cover native bundled manifest
discovery, required real core exports, default activation, and browser behavior
with simulated streamed generation. The browser fixture verifies the original
reply stays readable, both alternatives survive, selected-swipe metadata is
restored, generation is explicit, batches are sequential, Stop reaches native
cancellation, and errors/chat switches release UI state without saving another chat.

The fixture intercepts all requests and closes its browser. It starts no
SillyTavern server or model and provides no live-model quality/speed evidence.
