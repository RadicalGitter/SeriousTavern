# ComfyUI API

Status: implemented, bundled and default-enabled in this checkout. Offline
core, HTTP transport and browser fixture checks passed on 2026-09-30. No live
model or image-generation request was made for qualification.

This fork owns the bundled runtime at `public/scripts/extensions/comfyui-api/`
and `src/endpoints/comfyui-bridge.js`. Editable source and the usage contract
live in the sibling
[ComfyUI_API project](../../SillyTavern/Plugins/ComfyUI_API/README.md).
Use its `node scripts/deploy.mjs` command to refresh ordinary generated copies;
changed destination files are preserved in ignored deployment backups.
An existing world with the browser extension installed through the Extensions
menu needs its own bridge (unless it uses direct browser access with ComfyUI
CORS). From the source project, use `node scripts/deploy.mjs --bridge-only
"<world root>"` to add the native bridge without duplicating the browser
extension, then restart that world. The bridge runs inside SillyTavern; no
additional service or server-plugin-loader setting is required.
The source also provides a standalone `Install-ComfyUI-Bridge.bat`; deployment
puts it in the target root. Copy that single file beside another world's
`Start.bat` and run it to install the bridge offline, preserving changed server
files in deployment backups. Restart that world to load the new route.

## Runtime contract

The extension uses the selected SillyTavern model through `generateRaw` and
passes its own system instructions plus an explicit scene payload. It does not
assemble the normal roleplay prompt or retrieve lore. Native request-event
interceptors still apply. Its only generated workflow value is the image
prompt; custom fields come from the human's configured, typed snapshot.

Configuration is per-user under `extension_settings.comfyui_api`. The API graph,
field count, aliases, values, target node/input pairs, output selector, prompt
instructions, last-reply pre-prompt/visibility, Qwen reference node and sidebar options are
preserved on deployment. Disabling a field
retains its edits, and an active generation freezes a snapshot for consistency.
Bad aliases, mappings or schema values fail before a model request.

API workflows are imported through a file-picker button; the filename is a
read-only label. Import suggests positive-prompt/output/Qwen targets and custom
fields from aliases and graph connections, following linked scalars to their
editable sources. Existing field values and instructions remain intact. Unknown
or conflicting targets stay blank, and suggestions can be corrected manually.
Import does not change the stored graph or contact a model or ComfyUI.

The server bridge is mounted on the existing ComfyUI router at
`/api/sd/comfy/bridge/`. It proxies only node information, job submission,
per-job history, image retrieval, reference-image upload and deletion of a named
pending job. Reference uploads become multipart `/upload/image` requests into
the fixed input subfolder `serioustavern-comfyui-api`, with unique filenames and
overwrite disabled. It starts
no service, changes no endpoint configuration and never sends a global
interrupt. Stock SillyTavern can use the browser extension independently with
ComfyUI CORS; the default probe falls back only on a missing bridge (404).

The optional output node is normally **Save Image**, downstream of **VAE
Decode**. Leaving it blank chooses the first saved output image. Node links are
preserved; target upstream scalar nodes when a field is connected.

Saved image messages carry `extra.comfyui_api` provenance and native
`extra.media` attachments. They are system messages so generated captions do
not silently become roleplay context. The sidebar derives its gallery from the
active chat and clears on chat changes. Files are copied into native local
image storage and remain usable after ComfyUI closes.

## Layout and lifecycle

Sidebar fields are black with white text, stack from the bottom up, and update
the same setting as their settings-panel editor. The image and navigation sit
at the upper left. The optional conversation shift uses an editable screen-pixel
offset from the native centered position, divided by the current device pixel
ratio to account for DPI/browser zoom and capped to the viewport. It moves
`sheld`, the top bar and settings controls together without rewriting theme or
Moving UI storage. The desktop panel fills the measured gap to the chat with
padding; images fit its available width/height without changing their aspect
ratio. Display-density changes are detected even without a resize/media event.
Disabling the shift restores the native layout.
Below 1000 pixels, the sidebar is a manually opened overlay.
The pre-prompt's **Show field** checkbox exposes a synchronized editor directly
above the illustrate action. Hiding it preserves its saved contents.

No model calls run on incoming messages. **Illustrate last reply** explicitly
supplies the last non-system model reply and excludes earlier messages. An
optional last-reply pre-prompt replaces the default scene payload with
`[Instructions]`, a blank line, the resolved pre-prompt, a blank line, `[Scene]`,
a blank line, and that verbatim reply. The dedicated system instructions remain.
An empty pre-prompt preserves the default context. Scene
mode supplies a bounded recent-message window and active character/persona.
Changing chats cancels the request and prevents attaching its result elsewhere.
Cancellation removes only its named pending ComfyUI job. A running job can
finish; cancellation during `generateRaw` waits for its result and discards it,
since that host API exposes no per-request abort argument.

The optional **Qwen 2.1 reference node ID** targets `TextEncodeQwenImage21`.
The gallery toggle selects the displayed image, replaces a previous reference,
or clears it when the same image is already selected. Browsing and newly
generated images do not replace the choice. Selection is a saved image URL in
`chatMetadata.comfyui_api_reference`, resolved only against this chat's gallery;
it survives reload and cannot refer to another chat or a deleted image.

Generation freezes the choice, uploads its saved bytes and adds a collision-free
Load Image node to the submitted graph, feeding `images.image_1`. The configured
Qwen node's entire reference list is managed by the toggle: selected means one
image, cleared means no image inputs. Its non-image inputs and other nodes remain
intact, and the stored workflow JSON remains unchanged. A blank node ID disables
this mapping and preserves original wiring. Tagging alone makes no model or
upload request; edits during an active request apply to the next one.

The runtime is part of the fork's application tree, so it will be inherited by
future world clones once these changes are incorporated into the committed
fork lineage. Updating this checkout does not update independent worlds.
The Substitute received a targeted bridge-only installation on 2026-09-30
after its missing bridge caused direct browser access to fail. Its browser
extension remains a separate third-party Git checkout.

## Verification

Run the source project's `node --test test/*.test.mjs` and
`node test/browser.mjs`. The latter uses this fork's native stylesheet and
installed Edge with host/model/ComfyUI doubles, starts no application server,
blocks unexpected requests, and closes its browser. The source
[verification receipt](../../SillyTavern/Plugins/ComfyUI_API/verification.md)
records coverage and screenshot paths.

Run `node --test serious-tavern/test/comfyui-api.test.mjs` for portable fork
packaging and real Express/HTTP bridge checks, and `npm run test:serious` for
fork contracts. A live production UI and actual model/image generation remain
separate verification boundaries. The bridge needs a normal SeriousTavern
restart after installation or an update; the extension needs a browser reload.
