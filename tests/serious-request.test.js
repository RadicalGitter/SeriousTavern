import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { EventEmitter, once } from 'node:events';
import { Readable, Writable } from 'node:stream';
import { beforeAll, afterAll, describe, test, expect, jest } from '@jest/globals';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const captures = [];
const transport = jest.fn(async (url, options) => {
    captures.push({ url, body: JSON.parse(options.body) });
    if (JSON.parse(options.body).stream) {
        return { ok: true, status: 200, statusText: 'OK', body: Readable.from(['data: {"choices":[{"delta":{"content":"Fixture"}}]}\n\n', 'data: [DONE]\n\n']) };
    }
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Fixture response.' } }] }) };
});
const unused = () => { throw new Error('Unexpected external or tokenizer dependency in offline request test'); };
jest.unstable_mockModule('node-fetch', () => ({ default: transport }));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({ readSecret: () => '', SECRET_KEYS: { CUSTOM: 'custom' } }));
jest.unstable_mockModule('../src/endpoints/google.js', () => ({ getVertexAIAuth: unused, getProjectIdFromServiceAccount: unused }));
jest.unstable_mockModule('../src/endpoints/tokenizers.js', () => ({
    getTokenizerModel: unused, getSentencepiceTokenizer: unused, getTiktokenTokenizer: unused,
    sentencepieceTokenizers: [], TEXT_COMPLETION_MODELS: [], webTokenizers: [], getWebTokenizer: unused,
}));

// Execute the actual frontend parameter builder and preset field mapping.
// DOM, tools and identity are doubles; this does not claim browser assembly QA.
const frontend = fs.readFileSync(path.join(root, 'public/scripts/openai.js'), 'utf8');
const constant = name => {
    const source = frontend.match(new RegExp(`export const ${name} = (\\{[^]*?\\n\\});`))?.[1];
    if (!source) throw new Error(`Missing frontend constant ${name}`);
    return new Function(`return (${source});`)();
};
const functionSource = name => {
    const source = frontend.match(new RegExp(`(?:export )?((?:async )?function ${name}\\([^]*?\\n})`))?.[1];
    if (!source) throw new Error(`Missing frontend function ${name}`);
    return source;
};
const dependencies = {
    chat_completion_sources: constant('chat_completion_sources'),
    reasoning_effort_types: constant('reasoning_effort_types'), verbosity_levels: constant('verbosity_levels'),
    ToolManager: { canPerformToolCalls: () => false }, power_user: { request_token_probabilities: false },
    name1: 'Player', name2: 'Narrator', getGroupNames: () => [],
    getCustomStoppingStrings: () => [], openai_max_stop_strings: 4,
};
const buildParameters = new Function(...Object.keys(dependencies),
    `${['getReasoningEffort', 'getVerbosity', 'createGenerationParameters'].map(functionSource).join('\n')}\nreturn createGenerationParameters;`,
)(...Object.values(dependencies));
const mapping = constant('settingsToUpdate');
let generate;
beforeAll(async () => {
    const util = await import('../src/util.js');
    util.setConfigFilePath(path.join(root, 'default/config.yaml'));
    const { router } = await import('../src/endpoints/backends/chat-completions.js');
    generate = router.stack.find(layer => layer.route?.path === '/generate').route.stack[0].handle;
});

async function capture(preset, messages, type = 'normal', schema = null, streaming = false) {
    const settings = { bias_presets: {} };
    for (const [key, value] of Object.entries(preset)) settings[mapping[key]?.[1] ?? key] = value;
    // Capture the non-streaming endpoint body; quiet also uses this native path.
    settings.stream_openai = streaming;
    const { generate_data } = await buildParameters(settings, preset.custom_model, type, messages, { jsonSchema: schema });
    let result;
    let streamed = '';
    const response = new Writable({ write(chunk, _encoding, done) { streamed += chunk.toString(); done(); } });
    Object.assign(response, { send: body => { result = body; }, status: () => response, headersSent: false, socket: new EventEmitter() });
    const finished = streaming && type !== 'quiet' ? once(response, 'finish') : null;
    const before = captures.length;
    await generate({ body: generate_data, user: { directories: {} }, socket: new EventEmitter() }, response);
    if (finished) {
        await finished;
        expect(streamed).toContain('data: [DONE]');
    }
    expect(result?.error).toBeUndefined();
    expect(captures).toHaveLength(before + 1);
    return captures.at(-1);
}
const presetFile = path.join(root, 'default/content/presets/openai/SeriousTavern - Serenity llama.cpp.json');
const readPreset = () => JSON.parse(fs.readFileSync(presetFile, 'utf8'));

describe('SeriousTavern actual custom request transport', () => {
    test('the native streaming request uses the same non-preserving configuration', async () => {
        const sent = await capture(readPreset(), [{ role: 'user', content: 'I watch the rain.' }], 'normal', null, true);
        expect(sent.body.stream).toBe(true);
        expect(sent.body.chat_template_kwargs.preserve_thinking).toBe(false);
    });
    test('Serenity preset overrides backend reasoning preservation and transmits intended sampler values', async () => {
        const preset = readPreset();
        const messages = [{ role: 'system', content: 'World authority.' }, { role: 'user', content: 'I look at the door.' }];
        const snapshot = structuredClone(messages);
        const sent = await capture(preset, messages);
        expect(sent.url).toBe('http://127.0.0.1:7332/v1/chat/completions');
        expect(sent.body.model).toBe('Qwen3.8-27B-Serenity');
        expect(sent.body.chat_template_kwargs).toEqual({ enable_thinking: true, preserve_thinking: false });
        expect(sent.body.temperature).toBe(1);
        expect(sent.body.top_p).toBe(0.95);
        expect(sent.body.top_k).toBe(20);
        expect(sent.body.min_p).toBe(0);
        expect(sent.body.repeat_penalty).toBe(1);
        expect(sent.body.max_tokens).toBe(8192);
        expect(sent.body.messages).toEqual(snapshot);
        expect(messages).toEqual(snapshot);
        expect(sent.body).not.toHaveProperty('tools');
    });

    test('late system state keeps its role; no fabricated placeholder or merged dialogue', async () => {
        const messages = [
            { role: 'system', content: 'Card contract.' },
            { role: 'user', content: 'I wait.' },
            { role: 'assistant', content: 'The room stays quiet.' },
            { role: 'system', content: 'Accepted scene state.' },
            { role: 'user', content: 'I look at the window.\n<semantic-play-control>hold</semantic-play-control>' },
        ];
        expect((await capture(readPreset(), messages)).body.messages).toEqual(messages);
    });

    test('quiet structured harvest retains schema, role order and non-preservation', async () => {
        const schema = { name: 'fixture', strict: true, value: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'], additionalProperties: false } };
        const sent = await capture(readPreset(), [{ role: 'user', content: 'Propose only established changes.' }], 'quiet', schema);
        expect(sent.body.response_format.json_schema.schema).toEqual(schema.value);
        expect(sent.body.stream).toBe(false);
        expect(sent.body.chat_template_kwargs.preserve_thinking).toBe(false);
    });

    test('capture observes final custom overrides and exclusions rather than a reconstructed body', async () => {
        const preset = readPreset();
        preset.custom_include_body = JSON.stringify({ ...JSON.parse(preset.custom_include_body), temperature: 0.25 });
        preset.custom_exclude_body = '[frequency_penalty]';
        const sent = await capture(preset, [{ role: 'user', content: 'A synthetic request.' }]);
        expect(sent.body.temperature).toBe(0.25);
        expect(sent.body).not.toHaveProperty('frequency_penalty');
    });

    if (process.env.SERIOUS_SEMANTIC_BUNDLE) {
        test('generated SemanticPlay state and selected lore survive the real custom transport', async () => {
            const bundle = path.resolve(process.env.SERIOUS_SEMANTIC_BUNDLE);
            const load = relative => import(pathToFileURL(path.join(bundle, relative)).href);
            const { settingPacks } = await load('client-extension/packs/index.js');
            const { buildSettingContext } = await load('client-extension/core/setting-context.js');
            const { buildSemanticControl, appendControlToLastUserMessage } = await load('client-extension/core/prompt-control.js');
            const { compileSemanticPlan } = await load('client-extension/core/intents.js');
            const { applyStateProposal } = await load('client-extension/core/state-proposal.js');
            const pack = Object.values(settingPacks)[0];
            const state = { revision: 0, present: ['Oran Pell'], introduced: [...new Set(pack.entries.flatMap(entry => entry.requiresIntroduced || []))], discoveries: Array.from({ length: 24 }, (_, i) => `Fact ${i}`) };
            const input = 'I ask Oran Pell about the shrine.';
            const context = buildSettingContext(pack, state, input, { managedOnly: true });
            const messages = [{ role: 'system', content: context }, { role: 'user', content: input }];
            appendControlToLastUserMessage(messages, buildSemanticControl(compileSemanticPlan(input), state));
            const sent = await capture(readPreset(), messages);
            expect(sent.body.messages).toEqual(messages);
            expect(JSON.stringify(sent.body.messages)).toContain('[oran-pell-core]');
            expect(JSON.stringify(sent.body.messages)).not.toContain('[intro-oran-pell]');
            expect(sent.body.messages[1].content).toContain('<semantic-play-control>');
            expect(context.length).toBeLessThanOrEqual(5200);
            const envelope = { baseRevision: 0, throughMessageIndex: 0, sourceFingerprint: 'integration' };
            expect(() => applyStateProposal(state, { ...envelope, changes: [{ op: 'add', field: 'discoveries', value: 'Fact 25', evidence: 'Fixture' }] }, [0], envelope)).toThrow(/capacity/);
            expect(state.revision).toBe(0);
            const locked = buildSettingContext(pack, { introduced: [] }, 'Oran Pell SP_ADMIT_ORAN_SHRINE', { managedOnly: true });
            expect(locked).not.toContain('oran-pell');
        });
    } else {
        test.skip('generated SemanticPlay transport (set SERIOUS_SEMANTIC_BUNDLE to a portable build)', () => {});
    }
});

afterAll(() => {
    if (process.env.SERIOUS_CAPTURE_REPORT) {
        fs.writeFileSync(process.env.SERIOUS_CAPTURE_REPORT, JSON.stringify({
            evidence: 'Actual frontend parameter builder and server generate route; mocked outbound fetch, no socket or model; supplied assembled messages, not browser prompt assembly.', captures,
        }, null, 2) + '\n');
    }
});
