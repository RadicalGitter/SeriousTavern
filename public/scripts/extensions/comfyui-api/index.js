import { SETTINGS_KEY, REFERENCE_KEY, normalizeSettings, prepareSnapshot, workflowWithPrompt, workflowWithReference, referenceFromChat, galleryFromChat, buildSceneContext, lastModelReply, sameChat, requestId } from './core.js';
import { ComfyClient } from './client.js';
import { mountView } from './view.js';

let view;
let active;
let connected;
let settings;
const getContext = () => globalThis.SillyTavern.getContext();

function makeClient(config) {
    return new ComfyClient(config.endpoint, { requestHeaders: () => getContext().getRequestHeaders(), transport: config.transport });
}

function cachedInfo(config) {
    return connected?.endpoint === config.endpoint && connected?.transport === config.transport ? connected.info : null;
}

async function connect() {
    if (active) return;
    view.setStatus('Connecting to ComfyUI…');
    try {
        const config = normalizeSettings(settings);
        const client = makeClient(config);
        const info = await client.objectInfo();
        connected = { endpoint: config.endpoint, transport: config.transport, info };
        view.setStatus(`Connected through ${client.mode === 'server' ? 'the server bridge' : 'the browser'}; ${Object.keys(info).length} node types available.`);
    } catch (error) { view.setStatus(error.message, true); }
}

function preview() {
    try {
        const context = getContext();
        const snapshot = prepareSnapshot(settings, { objectInfo: cachedInfo(settings), macroResolver: context.substituteParams, referenceImage: referenceFromChat(context) });
        let lastReplyPreview = '';
        if (snapshot.prePrompt) {
            try { lastReplyPreview = `\n\nLast-reply input\n${buildSceneContext(context, snapshot, '', lastModelReply(context))}`; } catch { lastReplyPreview = `\n\nLast-reply pre-prompt\n${snapshot.prePrompt}\n(No model reply in this chat yet.)`; }
        }
        view.showPreview(`${snapshot.instructions}${lastReplyPreview}\n\nReference image\n${JSON.stringify(snapshot.referenceImage, null, 2)}${snapshot.referenceImage ? '\nUploaded and wired to images.image_1 only when you generate.' : ''}\n\nEffective fields\n${JSON.stringify(snapshot.fields, null, 2)}\n\nWorkflow before the model writes its prompt\n${JSON.stringify(snapshot.graph, null, 2)}`);
        view.setStatus('Inputs validated. Preview makes no model or image generation request.');
    } catch (error) { view.setStatus(error.message, true); }
}

function toggleReference(image) {
    const context = getContext();
    if (!context.chatMetadata || !galleryFromChat(context.chat).some(item => item.url === image.url)) return;
    if (referenceFromChat(context)?.url === image.url) delete context.chatMetadata[REFERENCE_KEY];
    else context.chatMetadata[REFERENCE_KEY] = image.url;
    context.saveMetadataDebounced();
    view.refreshGallery();
}

function blobBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('The generated image could not be read.'));
        reader.readAsDataURL(blob);
    });
}

async function saveImage(blob, name) {
    const formats = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
    const format = formats[blob.type.split(';')[0]];
    if (!format) throw new Error(`Unsupported image content type ${blob.type || '(missing)'}. Use PNG, JPEG, WebP, GIF, or AVIF output.`);
    const response = await fetch('/api/images/upload', {
        method: 'POST', headers: getContext().getRequestHeaders(),
        body: JSON.stringify({ image: await blobBase64(blob), format, ch_name: name || 'ComfyUI', filename: `comfyui_${Date.now()}_${requestId().slice(0, 8)}` }),
    });
    if (!response.ok) throw new Error(`Could not save the image in SillyTavern (${response.status}).`);
    const result = await response.json();
    if (!result.path) throw new Error('SillyTavern did not return a saved image path.');
    return result.path;
}

async function appendImage(origin, image, prompt, snapshot, promptId, mode) {
    if (!sameChat(origin, getContext())) throw new Error(`Image saved at ${image}, but the active chat changed. It was not added to another chat.`);
    const message = {
        name: 'Image', is_user: false, is_system: true, send_date: new Date().toISOString(), mes: '',
        extra: {
            media: [{ url: image, type: 'image', title: prompt, source: 'generated' }],
            media_display: 'gallery', media_index: 0, inline_image: false,
            [SETTINGS_KEY]: { version: 1, prompt, aliases: snapshot.aliases, endpoint: snapshot.endpoint, workflowName: snapshot.workflowName, promptId, sourceMode: mode, referenceImage: snapshot.referenceImage?.url || '' },
        },
    };
    origin.chat.push(message);
    const id = origin.chat.length - 1;
    await origin.eventSource.emit(origin.eventTypes.MESSAGE_RECEIVED, id, 'extension');
    if (!sameChat(origin, getContext())) throw new Error(`Image saved at ${image}; the chat changed while rendering it.`);
    origin.addOneMessage(message);
    await origin.eventSource.emit(origin.eventTypes.CHARACTER_MESSAGE_RENDERED, id, 'extension');
    if (!sameChat(origin, getContext())) throw new Error(`Image saved at ${image}; the chat changed before saving it.`);
    await origin.saveChat();
    view.refreshGallery(true);
}

async function generate(mode = 'scene', override = '') {
    if (active) { view.setStatus('An image request is already running.'); return ''; }
    const origin = getContext();
    if (origin.characterId == null && !origin.groupId) { view.setStatus('Open a character or group chat first.', true); return ''; }
    if (origin.streamingProcessor && !origin.streamingProcessor.isFinished) { view.setStatus('Wait for the current model reply to finish.', true); return ''; }
    const operation = { controller: new AbortController(), promptId: '', client: null, stage: 'validating' };
    active = operation;
    view.setBusy(true);
    try {
        const config = normalizeSettings(JSON.parse(JSON.stringify(settings)));
        const referenceImage = referenceFromChat(origin);
        // Validate locally before contacting either service.
        prepareSnapshot(config, { objectInfo: cachedInfo(config), macroResolver: origin.substituteParams, referenceImage });
        const sourceText = mode === 'last' ? lastModelReply(origin) : null;
        const scene = origin.substituteParams(override || config.scene || (mode === 'last' ? 'Illustrate the supplied last model reply.' : 'Illustrate the current scene.'));
        const client = makeClient(config); operation.client = client;
        view.setStatus('Checking workflow inputs…');
        const info = await client.objectInfo(operation.controller.signal);
        connected = { endpoint: config.endpoint, transport: config.transport, info };
        operation.controller.signal.throwIfAborted();
        const snapshot = prepareSnapshot(config, { objectInfo: info, macroResolver: origin.substituteParams, referenceImage });
        operation.stage = 'llm'; view.setStatus('Writing the image prompt with your selected SillyTavern model…');
        const reply = await origin.generateRaw({ systemPrompt: snapshot.instructions, prompt: buildSceneContext(origin, snapshot, scene, sourceText), responseLength: snapshot.responseTokens, trimNames: false });
        operation.controller.signal.throwIfAborted();
        if (!sameChat(origin, getContext())) throw new Error('The chat changed; image generation was cancelled.');
        const result = workflowWithPrompt(snapshot, reply);
        if (snapshot.referenceImage) {
            operation.stage = 'reference'; view.setStatus('Uploading the selected reference image to ComfyUI…');
            const url = new URL(snapshot.referenceImage.url, location.href);
            if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('The reference must be a saved image from this SillyTavern instance.');
            const response = await fetch(url.href, { signal: AbortSignal.any([operation.controller.signal, AbortSignal.timeout(30000)]) });
            if (!response.ok) throw new Error(`The saved reference image could not be read (${response.status}).`);
            const uploaded = await client.uploadImage(await response.blob(), operation.controller.signal);
            operation.controller.signal.throwIfAborted();
            result.graph = workflowWithReference(snapshot, result.graph, uploaded);
        }
        view.showPreview(`${snapshot.instructions}\n\nGenerated image prompt\n${result.prompt}\n\nSubmitted workflow\n${JSON.stringify(result.graph, null, 2)}`);
        operation.stage = 'submit'; view.setStatus('Submitting workflow to ComfyUI…');
        // Complete the one submission even after cancellation so its returned ID
        // can be used to remove our own pending job. Never retry POST /prompt.
        operation.promptId = await client.submit(result.graph);
        operation.controller.signal.throwIfAborted();
        operation.stage = 'comfy';
        const output = await client.waitForImage(operation.promptId, { signal: operation.controller.signal, timeoutSeconds: snapshot.timeoutSeconds, outputNode: snapshot.outputNode, onStatus: text => view.setStatus(text) });
        operation.controller.signal.throwIfAborted();
        if (!sameChat(origin, getContext())) throw new Error('The chat changed; the result was not added to another chat.');
        operation.stage = 'saving'; view.setStatus('Saving the image in this chat…');
        const image = await saveImage(output.blob, origin.name2);
        operation.controller.signal.throwIfAborted();
        await appendImage(origin, image, result.prompt, snapshot, operation.promptId, mode);
        view.setStatus('Image saved.');
        return image;
    } catch (error) {
        if (operation.controller.signal.aborted) {
            let pending = '';
            if (operation.promptId) {
                try { await operation.client.cancelPending(operation.promptId); pending = ' Its pending job was removed; an already running job can finish in ComfyUI.'; } catch { pending = ` ComfyUI job ${operation.promptId} may still finish.`; }
            }
            view.setStatus(`Cancelled.${pending}`);
        } else { view.setStatus(error.message, true); }
        return '';
    } finally { if (active === operation) active = null; view.setBusy(false); }
}

function cancel() {
    if (!active) return;
    active.controller.abort(new Error('Cancelled'));
    view.setStatus(active.stage === 'llm' ? 'Cancelled. Waiting for the prompt writer to return; its result will be discarded.' : 'Cancelling this image request…');
}

export function init() {
    if (view || document.querySelector('#comfyui-api-settings')) return;
    const context = getContext();
    settings = normalizeSettings(context.extensionSettings[SETTINGS_KEY]);
    context.extensionSettings[SETTINGS_KEY] = settings;
    view = mountView({ settings, save: () => getContext().saveSettingsDebounced(), context: getContext, connect, generate, cancel, preview, toggleReference });
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = context;
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'comfy-image', returns: 'The locally saved image URL, or an empty string on failure',
        callback: (_args, value) => generate(String(value).trim().toLowerCase() === 'last' ? 'last' : 'scene', String(value).trim().toLowerCase() === 'last' ? '' : String(value)),
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'Scene request, or last to illustrate the last model reply', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
        helpString: 'Generate an image through ComfyUI API using your configured workflow and prompt writer. /comfy-image last illustrates the last model reply.',
    }));
    context.eventSource.on(context.eventTypes.CHAT_CHANGED, () => { cancel(); view.refreshGallery(true); });
    for (const name of ['MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MORE_MESSAGES_LOADED']) {
        if (context.eventTypes[name]) context.eventSource.on(context.eventTypes[name], () => view.refreshGallery());
    }
}
