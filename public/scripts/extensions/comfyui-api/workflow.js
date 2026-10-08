import { MAX_FIELDS, listInputs, normalizeSettings, parseWorkflow } from './core.js';

const linkId = value => Array.isArray(value) && value.length === 2 && typeof value[1] === 'number' ? String(value[0]) : '';
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const targetKey = target => `${target.nodeId}\n${target.inputKey}`;

function ancestors(graph, roots) {
    const found = new Set();
    const pending = [...roots];
    while (pending.length) {
        const id = pending.pop();
        if (!graph[id] || found.has(id)) continue;
        found.add(id);
        for (const value of Object.values(graph[id].inputs)) {
            const parent = linkId(value);
            if (parent) pending.push(parent);
        }
    }
    return found;
}

// Follow a linked scalar through a primitive or unambiguous scalar source.
// Suggestions always target literals, leaving exported connections intact.
function scalarTarget(graph, nodeId, inputKey, kind, seen = new Set()) {
    const node = graph[nodeId];
    if (!node || !Object.hasOwn(node.inputs, inputKey)) return null;
    const key = `${nodeId}\n${inputKey}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const value = node.inputs[inputKey];
    if (typeof value === kind) return { nodeId, inputKey };
    const parent = linkId(value);
    if (!parent || !graph[parent]) return null;
    const inputs = graph[parent].inputs;
    const preferred = [...new Set([inputKey, 'value', kind === 'string' ? 'text' : inputKey])]
        .filter(name => Object.hasOwn(inputs, name) && (typeof inputs[name] === kind || linkId(inputs[name])));
    const literals = listInputs(graph, parent).filter(name => typeof inputs[name] === kind);
    const next = preferred[0] || (literals.length === 1 ? literals[0] : '');
    return next ? scalarTarget(graph, parent, next, kind, seen) : null;
}

function best(candidates) {
    return candidates.sort((a, b) => b.score - a.score)[0] || null;
}

export function guessWorkflowMappings(graph) {
    const entries = Object.entries(graph);
    const output = best(entries.filter(([, node]) => /save.*image|image.*save/i.test(node.class_type))
        .map(([nodeId, node]) => ({ nodeId, score: node.class_type === 'SaveImage' ? 10 : 5 })));
    const active = output ? ancestors(graph, [output.nodeId]) : new Set(entries.map(([id]) => id));
    const positiveRoots = [], negativeRoots = [];
    for (const [id, node] of entries) {
        if (!active.has(id)) continue;
        for (const [key, value] of Object.entries(node.inputs)) {
            const parent = linkId(value);
            if (!parent) continue;
            if (/negative/i.test(key)) negativeRoots.push(parent);
            else if (/positive|conditioning|^cond$/i.test(key)) positiveRoots.push(parent);
        }
    }
    const positive = ancestors(graph, positiveRoots), negative = ancestors(graph, negativeRoots);
    const promptCandidates = [], negativeCandidates = [];
    for (const [id, node] of entries) {
        if (!active.has(id)) continue;
        const title = node._meta?.title || '';
        const isNegative = (negative.has(id) && !positive.has(id)) || (/negative/i.test(title) && !positive.has(id));
        for (const inputKey of ['prompt', 'text', 'positive_prompt', 'text_g', 'text_l', 'negative_prompt']) {
            const target = scalarTarget(graph, id, inputKey, 'string');
            if (!target) continue;
            const score = (positive.has(id) ? 100 : 0) + (/encode/i.test(node.class_type) ? 30 : 0)
                + (/positive|prompt/i.test(title) ? 20 : 0) + (inputKey === 'prompt' ? 10 : 0);
            const candidate = { ...target, encoderId: id, score };
            if (isNegative || inputKey === 'negative_prompt') negativeCandidates.push(candidate);
            else promptCandidates.push(candidate);
        }
    }
    const prompt = best(promptCandidates);
    const qwen = entries.find(([id, node]) => active.has(id) && node.class_type === 'TextEncodeQwenImage21' && id === prompt?.encoderId)
        || entries.find(([id, node]) => active.has(id) && node.class_type === 'TextEncodeQwenImage21');
    const fields = [];
    const definitions = [
        ['resolution_x', ['width'], 'number'],
        ['resolution_y', ['height'], 'number'],
        ['seed', ['seed', 'noise_seed'], 'number'],
        ['steps', ['steps'], 'number'],
        ['guidance', ['cfg', 'guidance'], 'number'],
        ['negative_prompt', ['negative_prompt'], 'string'],
        ['resolution', ['resolution'], 'number'],
        ['batch_size', ['batch_size'], 'number'],
    ];
    for (const [alias, keys, kind] of definitions) {
        const candidates = [];
        for (const [id, node] of entries) {
            if (!active.has(id)) continue;
            for (const key of keys) {
                const target = scalarTarget(graph, id, key, kind);
                if (target) candidates.push({ ...target, score: /latent/i.test(node.class_type) ? 20 : /sampler/i.test(node.class_type) ? 15 : 0 });
            }
            if (alias === 'resolution_x' || alias === 'resolution_y') {
                const dimension = alias === 'resolution_x' ? /width|resolution[ _-]?x/i : /height|resolution[ _-]?y/i;
                if (dimension.test(node._meta?.title || '')) {
                    const literal = listInputs(graph, id).filter(key => typeof node.inputs[key] === kind);
                    if (literal.length === 1) candidates.push({ nodeId: id, inputKey: literal[0], score: 5 });
                }
            }
        }
        if (alias === 'negative_prompt') candidates.push(...negativeCandidates);
        const target = best(candidates);
        if (target) fields.push({ alias, nodeId: target.nodeId, inputKey: target.inputKey, value: String(graph[target.nodeId].inputs[target.inputKey]), type: 'auto' });
    }
    return { prompt: prompt ? { nodeId: prompt.nodeId, inputKey: prompt.inputKey } : null, outputNode: output?.nodeId || '', referenceNode: qwen?.[0] || '', fields };
}

export function importWorkflow(settings, text, filename) {
    const graph = parseWorkflow(text);
    const next = normalizeSettings(settings);
    const guesses = guessWorkflowMappings(graph);
    next.workflow = text; next.workflowName = filename;
    next.prompt = { ...next.prompt, nodeId: guesses.prompt?.nodeId || '', inputKey: guesses.prompt?.inputKey || '' };
    next.outputNode = guesses.outputNode; next.referenceNode = guesses.referenceNode;
    const aliases = {
        width: 'resolution_x', resolutionx: 'resolution_x', xresolution: 'resolution_x',
        height: 'resolution_y', resolutiony: 'resolution_y', yresolution: 'resolution_y',
        seed: 'seed', noiseseed: 'seed', steps: 'steps', cfg: 'guidance', guidance: 'guidance',
        negative: 'negative_prompt', negativeprompt: 'negative_prompt', resolution: 'resolution', batchsize: 'batch_size',
    };
    const used = new Set(guesses.prompt ? [targetKey(guesses.prompt)] : []);
    next.fields = next.fields.slice(0, MAX_FIELDS).map(field => {
        const alias = normalize(field.alias);
        let suggestion;
        if (alias) {
            suggestion = guesses.fields.find(item => item.alias === (aliases[alias] || field.alias.toLowerCase()));
            if (!suggestion) {
                const candidates = [];
                for (const [nodeId, node] of Object.entries(graph)) {
                    for (const inputKey of listInputs(graph, nodeId)) {
                        if (normalize(inputKey) === alias || (normalize(node._meta?.title) === alias && listInputs(graph, nodeId).length === 1)) {
                            candidates.push({ nodeId, inputKey, value: String(node.inputs[inputKey]), type: 'auto' });
                        }
                    }
                }
                if (candidates.length === 1) suggestion = candidates[0];
            }
        } else suggestion = guesses.fields.find(item => !used.has(targetKey(item)));
        if (!suggestion || used.has(targetKey(suggestion))) return { ...field, nodeId: '', inputKey: '' };
        used.add(targetKey(suggestion));
        return { ...field, alias: field.alias || suggestion.alias || '', nodeId: suggestion.nodeId, inputKey: suggestion.inputKey, value: field.value === '' ? suggestion.value : field.value };
    });
    return next;
}
