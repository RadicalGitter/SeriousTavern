export const SETTINGS_KEY = 'comfyui_api';
export const REFERENCE_KEY = 'comfyui_api_reference';
export const MAX_FIELDS = 5;
const ALIAS = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const RESERVED = new Set(['char', 'user', 'description', 'scenario', 'persona', 'lastmessage']);
const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function requestId() {
    if (typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
    // randomUUID is restricted to secure contexts; LAN HTTP installations still
    // expose getRandomValues and need identifiers too.
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function defaultSettings() {
    return {
        version: 1,
        endpoint: 'http://127.0.0.1:8188',
        transport: 'auto',
        workflowName: '',
        workflow: '',
        fieldCount: 0,
        fields: Array.from({ length: MAX_FIELDS }, () => ({ alias: '', value: '', nodeId: '', inputKey: '', type: 'auto', show: false })),
        prompt: {
            nodeId: '', inputKey: '',
            instructions: 'You write image generation prompts. Describe a single coherent image of the requested scene. Include visible subjects, their appearance and actions, framing, composition, environment, and lighting. Respect the configured workflow field values supplied with the scene. Write only the final image prompt, without commentary, reasoning, headings, or quotation marks.',
        },
        scene: '',
        prePrompt: '',
        showPrePrompt: false,
        recentMessages: 10,
        responseTokens: 512,
        timeoutSeconds: 900,
        outputNode: '',
        referenceNode: '',
        dockEnabled: true,
        shiftChat: true,
        chatShiftPixels: 480,
        dockWidth: 420,
    };
}

export function normalizeSettings(saved = {}) {
    const defaults = defaultSettings();
    const result = { ...defaults, ...saved, prompt: { ...defaults.prompt, ...saved.prompt } };
    result.fields = defaults.fields.map((field, i) => ({ ...field, ...(saved.fields?.[i] || {}) }));
    result.fieldCount = Math.min(MAX_FIELDS, Math.max(0, Math.trunc(Number(result.fieldCount) || 0)));
    return result;
}

export function normalizeEndpoint(value) {
    let url;
    try { url = new URL(String(value).trim()); } catch { throw new Error('Enter a complete ComfyUI endpoint, such as http://127.0.0.1:8188.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('The endpoint must be an HTTP(S) URL without credentials, query parameters, or a fragment.');
    }
    return url.href.replace(/\/+$/, '');
}

export function parseWorkflow(text) {
    let graph;
    try { graph = typeof text === 'string' ? JSON.parse(text) : clone(text); } catch { throw new Error('The workflow is not valid JSON. Export it from ComfyUI in API format.'); }
    if (Array.isArray(graph?.nodes)) throw new Error('This is a visual workflow. Use ComfyUI’s Export (API) / Save (API Format) option.');
    if (!object(graph) || !Object.keys(graph).length) throw new Error('Load a ComfyUI API workflow first.');
    for (const [id, node] of Object.entries(graph)) {
        if (!object(node) || typeof node.class_type !== 'string' || !object(node.inputs)) {
            throw new Error(`Node ${id} is not an API node with class_type and inputs.`);
        }
    }
    return graph;
}

export function listInputs(graph, nodeId) {
    const node = graph[String(nodeId).trim()];
    if (!node) return [];
    return Object.entries(node.inputs).filter(([, value]) => !Array.isArray(value) && !object(value)).map(([key]) => key);
}

function resolveTarget(graph, target, label) {
    const nodeId = String(target.nodeId || '').trim();
    if (!Object.hasOwn(graph, nodeId)) throw new Error(`${label}: node ${nodeId || '(unset)'} is not in this workflow.`);
    let inputKey = String(target.inputKey || '').trim();
    if (!inputKey) {
        const inputs = listInputs(graph, nodeId);
        if (inputs.length !== 1) throw new Error(`${label}: choose the input on node ${nodeId} (${inputs.join(', ') || 'no editable scalar inputs'}).`);
        inputKey = inputs[0];
    }
    if (!Object.hasOwn(graph[nodeId].inputs, inputKey)) throw new Error(`${label}: node ${nodeId} has no input named ${inputKey}.`);
    if (Array.isArray(graph[nodeId].inputs[inputKey]) || object(graph[nodeId].inputs[inputKey])) {
        throw new Error(`${label}: ${nodeId}.${inputKey} is wired to another node or is structured data. Target its upstream text/number node instead.`);
    }
    return { nodeId, inputKey };
}

function schemaFor(graph, target, info) {
    const definition = info?.[graph[target.nodeId].class_type]?.input;
    return definition?.required?.[target.inputKey] || definition?.optional?.[target.inputKey];
}

function inferType(original, schema) {
    const types = { INT: 'integer', FLOAT: 'number', BOOLEAN: 'boolean', STRING: 'text' };
    if (types[schema?.[0]]) return types[schema[0]];
    // JSON cannot distinguish a FLOAT set to 1.0 from an INT set to 1. The
    // connected server's schema makes that distinction before generation.
    if (typeof original === 'number') return 'number';
    if (typeof original === 'boolean') return 'boolean';
    return 'text';
}

function convert(value, type, label) {
    const text = String(value);
    if (type === 'text') return text;
    if (type === 'integer') {
        if (!/^[+-]?\d+$/.test(text.trim()) || !Number.isSafeInteger(Number(text))) throw new Error(`${label}: enter a safe whole number.`);
        return Number(text);
    }
    if (type === 'number') {
        if (!text.trim() || !Number.isFinite(Number(text))) throw new Error(`${label}: enter a finite number.`);
        return Number(text);
    }
    if (type === 'boolean') {
        if (!/^(true|false)$/i.test(text.trim())) throw new Error(`${label}: enter true or false.`);
        return text.trim().toLowerCase() === 'true';
    }
    throw new Error(`${label}: unknown value type ${type}.`);
}

function checkSchema(value, schema, label) {
    if (!schema) return;
    const [type, options = {}] = schema;
    if (Array.isArray(type)) {
        if (!type.includes(value)) throw new Error(`${label}: value is not one of the node’s available choices.`);
        return;
    }
    if (type === 'INT' && !Number.isSafeInteger(value)) throw new Error(`${label}: this workflow input requires an integer.`);
    if (type === 'FLOAT' && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error(`${label}: this workflow input requires a number.`);
    if (type === 'STRING' && typeof value !== 'string') throw new Error(`${label}: this workflow input requires text.`);
    if (type === 'BOOLEAN' && typeof value !== 'boolean') throw new Error(`${label}: this workflow input requires true or false.`);
    if (typeof value === 'number') {
        if (typeof options.min === 'number' && value < options.min) throw new Error(`${label}: minimum is ${options.min}.`);
        if (typeof options.max === 'number' && value > options.max) throw new Error(`${label}: maximum is ${options.max}.`);
    }
}

// Expand field aliases before SillyTavern sees the template. Values are substituted
// once, rather than recursively interpreting field text as another alias template.
export function renderInstructions(template, values, disabled = [], macroResolver = text => text) {
    const lookup = new Map(Object.entries(values).map(([name, value]) => [name.toLowerCase(), String(value)]));
    const hidden = new Set(disabled.map(name => name.toLowerCase()));
    const fragments = [];
    const expanded = String(template).replace(/{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g, (match, name) => {
        if (lookup.has(name.toLowerCase())) {
            const token = `\uE000COMFY_FIELD_${fragments.length}\uE001`;
            fragments.push(lookup.get(name.toLowerCase()));
            return token;
        }
        if (hidden.has(name.toLowerCase())) throw new Error(`Alias ${name} belongs to a hidden field. Enable that field or remove its reference.`);
        if (!RESERVED.has(name.toLowerCase())) throw new Error(`Unknown field alias ${name}. Check its spelling or add a field with that alias.`);
        return match;
    });
    const resolved = macroResolver(expanded);
    return String(resolved).replace(/\uE000COMFY_FIELD_(\d+)\uE001/g, (_, index) => fragments[Number(index)]);
}

export function prepareSnapshot(settings, { objectInfo = null, macroResolver = text => text, referenceImage = null } = {}) {
    const config = normalizeSettings(clone(settings));
    const endpoint = normalizeEndpoint(config.endpoint);
    const graph = parseWorkflow(config.workflow);
    const fields = [];
    const aliases = Object.create(null);
    const targets = new Set();
    for (let i = 0; i < config.fieldCount; i++) {
        const field = config.fields[i];
        const alias = String(field.alias).trim();
        const label = alias || `Field ${i + 1}`;
        if (alias && (!ALIAS.test(alias) || RESERVED.has(alias.toLowerCase()))) throw new Error(`${label}: use letters, numbers, and underscores, starting with a letter or underscore; avoid SillyTavern’s reserved names.`);
        if (alias && Object.keys(aliases).some(name => name.toLowerCase() === alias.toLowerCase())) throw new Error(`Duplicate alias ${alias} (aliases ignore case).`);
        const target = resolveTarget(graph, field, label);
        const identity = JSON.stringify([target.nodeId, target.inputKey]);
        if (targets.has(identity)) throw new Error(`${label}: ${target.nodeId}.${target.inputKey} is already targeted by another field.`);
        targets.add(identity);
        const schema = schemaFor(graph, target, objectInfo);
        const type = field.type === 'auto' ? inferType(graph[target.nodeId].inputs[target.inputKey], schema) : field.type;
        const value = convert(macroResolver(String(field.value)), type, label);
        checkSchema(value, schema, label);
        graph[target.nodeId].inputs[target.inputKey] = value;
        if (alias) aliases[alias] = value;
        fields.push({ alias, ...target, type, value });
    }
    const promptTarget = resolveTarget(graph, config.prompt, 'Image prompt');
    if (targets.has(JSON.stringify([promptTarget.nodeId, promptTarget.inputKey]))) throw new Error('The image prompt and a custom field target the same input. Choose distinct inputs.');
    const promptSchema = schemaFor(graph, promptTarget, objectInfo);
    if ((promptSchema && promptSchema[0] !== 'STRING') || typeof graph[promptTarget.nodeId].inputs[promptTarget.inputKey] !== 'string') {
        throw new Error('The image prompt target must be a literal text input.');
    }
    const disabled = config.fields.slice(config.fieldCount).map(field => String(field.alias).trim()).filter(Boolean);
    const instructions = renderInstructions(config.prompt.instructions, aliases, disabled, macroResolver).trim();
    if (!instructions) throw new Error('Write instructions for the image prompt writer.');
    const prePromptText = renderInstructions(config.prePrompt, aliases, disabled, macroResolver);
    const prePrompt = prePromptText.trim() ? prePromptText : '';
    const recentMessages = Number(config.recentMessages);
    const responseTokens = Number(config.responseTokens);
    const timeoutSeconds = Number(config.timeoutSeconds);
    if (!Number.isInteger(recentMessages) || recentMessages < 0 || recentMessages > 50) throw new Error('Recent messages must be a whole number from 0 to 50.');
    if (!Number.isInteger(responseTokens) || responseTokens < 64 || responseTokens > 8192) throw new Error('Prompt output tokens must be a whole number from 64 to 8192.');
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 3600) throw new Error('Workflow timeout must be from 10 to 3600 seconds.');
    const outputNode = String(config.outputNode || '').trim();
    if (outputNode && !Object.hasOwn(graph, outputNode)) throw new Error(`Output node ${outputNode} is not in the workflow.`);
    const referenceNode = String(config.referenceNode || '').trim();
    if (referenceNode) {
        if (!Object.hasOwn(graph, referenceNode)) throw new Error(`Reference node ${referenceNode} is not in the workflow.`);
        if (graph[referenceNode].class_type !== 'TextEncodeQwenImage21') throw new Error('The reference node must be Text Encode Qwen Image 2.1 (TextEncodeQwenImage21).');
        if (objectInfo) {
            const schema = objectInfo.TextEncodeQwenImage21?.input?.required?.images;
            if (schema?.[0] !== 'COMFY_AUTOGROW_V3' || schema[1]?.template?.min !== 0 || !schema[1]?.template?.names?.includes('image_1')) {
                throw new Error('ComfyUI does not expose the supported Qwen 2.1 reference-image input. Check the endpoint and node version.');
            }
        }
        if (fields.some(field => field.nodeId === referenceNode && (field.inputKey === 'images' || field.inputKey.startsWith('images.')))) throw new Error('The Qwen reference-image list is controlled by the gallery toggle; choose a different custom field input.');
        // Autogrow IMAGE links use flattened API keys. Omitting every link gives
        // Qwen an empty dict; null or a filename in the encoder is not an IMAGE.
        for (const key of Object.keys(graph[referenceNode].inputs)) if (key === 'images' || key.startsWith('images.')) delete graph[referenceNode].inputs[key];
    }
    const reference = referenceNode && referenceImage ? { url: String(referenceImage.url), prompt: String(referenceImage.prompt || '') } : null;
    return { endpoint, graph, fields, aliases, promptTarget, instructions, prePrompt, recentMessages, responseTokens, timeoutSeconds, outputNode, referenceNode, referenceImage: reference, workflowName: config.workflowName };
}

export function workflowWithPrompt(snapshot, reply) {
    let text = String(reply ?? '').trim();
    text = text.replace(/^```(?:text)?\s*\n([\s\S]*?)\n```$/i, '$1').trim();
    if (!text || text.length > 50000) throw new Error('The prompt writer returned empty or excessively long text.');
    const graph = clone(snapshot.graph);
    graph[snapshot.promptTarget.nodeId].inputs[snapshot.promptTarget.inputKey] = text;
    return { graph, prompt: text };
}

export function workflowWithReference(snapshot, graph, uploadedImage = null) {
    const result = clone(graph);
    if (!snapshot.referenceImage) return result;
    if (!snapshot.referenceNode || !uploadedImage || uploadedImage.type !== 'input' || typeof uploadedImage.name !== 'string' || !uploadedImage.name || /[\\/]/.test(uploadedImage.name) || uploadedImage.name === '..') {
        throw new Error('ComfyUI did not return a valid uploaded reference image.');
    }
    const subfolder = String(uploadedImage.subfolder || '').replaceAll('\\', '/');
    if (subfolder.startsWith('/') || subfolder.split('/').some(part => part === '..') || subfolder.includes(':')) throw new Error('ComfyUI returned an invalid reference-image folder.');
    let loaderId = 'comfyui_api_reference';
    for (let suffix = 1; Object.hasOwn(result, loaderId); suffix++) loaderId = `comfyui_api_reference_${suffix}`;
    result[loaderId] = { class_type: 'LoadImage', inputs: { image: `${subfolder ? subfolder + '/' : ''}${uploadedImage.name}` }, _meta: { title: 'SeriousTavern selected reference' } };
    result[snapshot.referenceNode].inputs['images.image_1'] = [loaderId, 0];
    return result;
}

export function buildSceneContext(context, snapshot, scene = '', sourceText = null) {
    if (sourceText !== null && snapshot.prePrompt) return `[Instructions]\n\n${snapshot.prePrompt}\n\n[Scene]\n\n${sourceText}`;
    const character = context.characterId == null ? null : context.characters?.[context.characterId];
    const recent = (context.chat || []).filter(message => !message.is_system && typeof message.mes === 'string');
    return JSON.stringify({
        request: String(scene).trim() || 'Illustrate the current scene.',
        character: character ? { name: character.name, description: character.description || character.data?.description || '', scenario: character.scenario || character.data?.scenario || '' } : null,
        user: context.name1 || '',
        persona: context.powerUserSettings?.persona_description || '',
        workflow_fields: snapshot.fields.map(({ alias, value }) => ({ alias, value })),
        reference_image: snapshot.referenceImage ? { caption: snapshot.referenceImage.prompt } : null,
        source_message: sourceText,
        recent_messages: sourceText !== null || snapshot.recentMessages === 0 ? [] : recent.slice(-snapshot.recentMessages).map(({ name, is_user, mes }) => ({ speaker: name || (is_user ? 'User' : 'Character'), text: mes })),
    }, null, 2);
}

export function lastModelReply(context) {
    const message = [...(context.chat || [])].reverse().find(item => !item.is_user && !item.is_system && !item.extra?.comfyui_api && typeof item.mes === 'string' && item.mes.trim());
    if (!message) throw new Error('This chat has no model reply to illustrate yet.');
    return message.mes;
}

export function galleryFromChat(chat) {
    return (chat || []).flatMap(message => {
        if (!message.extra?.comfyui_api) return [];
        return (message.extra.media || []).filter(media => media.type === 'image').map(media => ({ url: media.url, ...message.extra.comfyui_api }));
    });
}

export function referenceFromChat(context) {
    const url = context.chatMetadata?.[REFERENCE_KEY];
    return typeof url === 'string' ? galleryFromChat(context.chat).find(image => image.url === url) || null : null;
}

export function sameChat(before, after) {
    return before.chat === after.chat && before.characterId === after.characterId && before.groupId === after.groupId && before.chatId === after.chatId;
}
