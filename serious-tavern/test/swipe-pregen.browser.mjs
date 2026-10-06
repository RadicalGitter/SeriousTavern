import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../tests/node_modules/playwright-core/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const prefix = '/scripts/extensions/swipe-pregen/';
const fixture = `<!doctype html><html><head><meta charset="utf-8">
<script src="/lib/jquery-3.5.1.min.js"></script><link rel="stylesheet" href="${prefix}style.css">
<style>body{font:18px sans-serif}.mes{width:700px}.mes_text{line-height:1.6}.swipeRightBlock{display:flex}</style>
</head><body><div id="extensionsMenu"></div><div id="sheld"><div id="chat">
<div class="mes last_mes last_swipe" mesid="1"><div class="mes_text"><p><strong>Original</strong> response.</p></div>
<div class="swipeRightBlock"><span class="swipe_right">→</span><span class="swipes-counter">1/1</span></div></div>
</div></div></body></html>`;

const coreFixture = `
globalThis.fixtureEvents = new Map();
globalThis.fixtureState = { requests: [], active: 0, maxActive: 0, saves: 0, settingsSaves: 0, stops: 0, notices: [] };
export const event_types = Object.fromEntries(['CHARACTER_MESSAGE_RENDERED','USER_MESSAGE_RENDERED','MESSAGE_SWIPED','MESSAGE_DELETED','CHAT_LOADED','CHAT_CHANGED'].map(key => [key,key]));
export const eventSource = { on(type, callback) { const list = fixtureEvents.get(type) || []; list.push(callback); fixtureEvents.set(type, list); } };
globalThis.fixtureEmit = type => (fixtureEvents.get(type) || []).forEach(callback => callback());
globalThis.toastr = Object.fromEntries(['success','warning'].map(type => [type, (...args) => fixtureState.notices.push({type,args})]));
export const isGenerating = () => fixtureState.active > 0;
export function saveSettingsDebounced() { fixtureState.settingsSaves++; }
export async function saveChatConditional() { fixtureState.saves++; }
export function addOneMessage(message) { document.querySelector('.mes_text').innerHTML = '<p>' + message.mes + '</p>'; }
export function refreshSwipeButtons() { document.querySelector('.swipes-counter').textContent = (fixtureContext.chat.at(-1).swipe_id + 1) + '/' + fixtureContext.chat.at(-1).swipes.length; }
globalThis.fixtureContext = { chat: [
    {is_user:true,mes:'Player input'},
    {is_user:false,is_system:false,mes:'<strong>Original</strong> response.',swipe_id:0,
     swipes:['<strong>Original</strong> response.'],send_date:'old-date',gen_started:'old-start',gen_finished:'old-end',
     extra:{reasoning:'Saved original reasoning',token_count:9},
     swipe_info:[{send_date:'old-date',gen_started:'old-start',gen_finished:'old-end',extra:{reasoning:'Saved original reasoning',token_count:9}}]}
] };
globalThis.fixtureSwipe = async (event, direction, options) => {
    const message = fixtureContext.chat.at(-1);
    fixtureState.requests.push({direction,options});
    fixtureState.active++;
    fixtureState.maxActive = Math.max(fixtureState.maxActive, fixtureState.active);
    document.body.dataset.generating = 'true';
    message.swipe_id = message.swipes.length;
    message.mes = 'Partial new response';
    message.extra = {reasoning:'New reasoning'};
    document.querySelector('.mes_text').innerHTML = '<p>Partial new response</p>';
    fixtureEmit('MESSAGE_SWIPED');
    return new Promise((resolve,reject) => {
        globalThis.fixtureFinish = (result = 'success') => {
            fixtureState.active--;
            delete document.body.dataset.generating;
            if (result === 'success') {
                const reply = 'Alternative ' + fixtureState.requests.length;
                message.swipes.push(reply);
                message.swipe_info.push({send_date:'new-date',extra:{reasoning:'New reasoning'}});
                message.mes = reply;
            }
            globalThis.fixtureFinish = null;
            if (result === 'error') reject(new Error('Simulated generation failure')); else resolve();
        };
    });
};
globalThis.fixtureStop = () => { fixtureState.stops++; fixtureFinish?.('cancel'); };
`;

async function withFixture(callback) {
    const browser = await chromium.launch({ channel: process.env.SERIOUS_BROWSER_CHANNEL || 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        const unexpected = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            const fulfill = body => route.fulfill({ contentType: 'text/javascript', body });
            if (url.origin !== 'http://swipes.invalid') { unexpected.push(url.href); return route.abort(); }
            if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: fixture });
            if (url.pathname === '/script.js') return fulfill(coreFixture);
            if (url.pathname === '/scripts/extensions.js') return fulfill(`
                export const extension_settings = globalThis.fixtureSettings = {};
                export function getContext() { return { ...fixtureContext, eventSource: globalThis.fixtureEventSource,
                    swipe:{to:fixtureSwipe}, stopGeneration:fixtureStop }; }
                import {eventSource} from '/script.js'; globalThis.fixtureEventSource = eventSource;
            `);
            if (url.pathname === '/scripts/constants.js') return fulfill(`export const SWIPE_DIRECTION={RIGHT:'right'}; export const SWIPE_SOURCE={AUTO_SWIPE:'auto'};`);
            if (url.pathname === '/scripts/i18n.js') return fulfill('export function t(strings,...values) { return strings.reduce((text,part,index) => text+part+(values[index] ?? ""), ""); }');
            if (url.pathname === '/scripts/popup.js') return fulfill(`
                export const POPUP_TYPE={CONFIRM:1}; export const POPUP_RESULT={AFFIRMATIVE:1};
                export async function callGenericPopup(content) {
                    document.body.append(content);
                    return new Promise(resolve => { globalThis.fixtureConfirm = () => {content.remove();resolve(1);}; });
                }
            `);
            if (url.pathname === '/lib/jquery-3.5.1.min.js') return fulfill(await fs.readFile(path.join(root, 'public/lib/jquery-3.5.1.min.js'), 'utf8'));
            const relative = url.pathname.slice(prefix.length);
            if (url.pathname.startsWith(prefix) && /^(index\.js|style\.css)$/.test(relative)) return route.fulfill({
                contentType: relative.endsWith('.css') ? 'text/css' : 'text/javascript',
                body: await fs.readFile(path.join(root, 'public', prefix, relative)),
            });
            unexpected.push(url.href);
            return route.abort();
        });
        await page.goto('http://swipes.invalid/');
        await page.evaluate(async () => {
            const extension = await import('/scripts/extensions/swipe-pregen/index.js');
            extension.init(); extension.init();
        });
        await page.locator('.sp_bg_gen_btn').waitFor();
        await callback(page);
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpected, []);
    } finally { await browser.close(); }
}

async function finish(page, result = 'success') {
    await page.evaluate(value => fixtureFinish(value), result);
    await page.waitForFunction(() => !document.querySelector('.sp_btn_spinning'));
}

async function startBatch(page, count) {
    await page.evaluate(() => $('#extensionsMenu').show());
    await page.locator('#sp_wand_btn').click();
    await page.locator('#sp_batch_size').fill(String(count));
    await page.evaluate(() => fixtureConfirm());
    await page.waitForFunction(() => fixtureState.active === 1);
}

test('default activation is passive and streamed generation preserves both replies and original metadata', async () => {
    await withFixture(async page => {
        assert.equal(await page.locator('.sp_bg_gen_btn').count(), 1);
        assert.equal(await page.locator('#sp_wand_entry').count(), 1);
        assert.equal(await page.evaluate(() => fixtureState.requests.length), 0);
        assert.equal(await page.evaluate(() => fixtureState.settingsSaves), 0);
        const original = await page.evaluate(() => structuredClone(fixtureContext.chat));
        const html = await page.locator('.mes_text').innerHTML();
        await page.locator('.sp_bg_gen_btn').click();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.locator('.mes_text').innerHTML(), html);
        assert.equal(await page.evaluate(() => fixtureState.requests[0].options.forceSwipeId), 1);
        await page.locator('.sp_bg_gen_btn').dispatchEvent('click');
        assert.equal(await page.evaluate(() => fixtureState.requests.length), 1);
        await finish(page);
        const updated = await page.evaluate(() => structuredClone(fixtureContext.chat));
        assert.deepEqual(updated[0], original[0]);
        assert.deepEqual({ ...updated[1], swipes: original[1].swipes, swipe_info: original[1].swipe_info }, original[1]);
        assert.equal(updated[1].swipes[1], 'Alternative 1');
        assert.equal(updated[1].swipe_info[1].extra.reasoning, 'New reasoning');
        assert.equal(await page.locator('.mes_text').innerHTML(), html);
        assert.equal(await page.evaluate(() => fixtureState.saves), 1);
        assert.equal(await page.locator('.mes').evaluate(element => element.style.height), '');
        // The normal swipe can now reveal the completed alternative.
        await page.evaluate(() => { fixtureContext.chat[1].swipe_id=1; document.querySelector('.mes_text').textContent=fixtureContext.chat[1].swipes[1]; });
        assert.equal(await page.locator('.mes_text').textContent(), 'Alternative 1');
    });
});

test('requested batches run sequentially and Stop cancels the current request and remaining queue', async () => {
    await withFixture(async page => {
        await startBatch(page, 2);
        await finish(page);
        await page.waitForFunction(() => fixtureState.requests.length === 2);
        await finish(page);
        await page.waitForFunction(() => !document.querySelector('#swipe_pregen_progress_bar'));
        assert.equal(await page.evaluate(() => fixtureState.maxActive), 1);
        assert.equal(await page.evaluate(() => fixtureContext.chat[1].swipes.length), 3);
        assert.equal(await page.evaluate(() => fixtureContext.chat[1].swipe_id), 0);
        await startBatch(page, 3);
        await page.locator('#swipe_pregen_progress_bar button').click();
        await page.waitForFunction(() => !document.querySelector('.sp_btn_spinning'));
        assert.equal(await page.evaluate(() => fixtureState.stops), 1);
        // Wait past the inter-request delay to detect an unwanted queued request.
        await page.waitForTimeout(400);
        assert.equal(await page.evaluate(() => fixtureState.requests.length), 3);
        assert.equal(await page.evaluate(() => fixtureContext.chat[1].swipes.length), 3);
    });
});

test('a failed generation restores the visible reply and allows a subsequent request', async () => {
    await withFixture(async page => {
        const original = await page.evaluate(() => structuredClone(fixtureContext.chat[1]));
        await page.locator('.sp_bg_gen_btn').click();
        await finish(page, 'error');
        assert.deepEqual(await page.evaluate(() => fixtureContext.chat[1]), original);
        assert.equal(await page.locator('.mes_text').textContent(), 'Original response.');
        assert.equal(await page.locator('.mes').evaluate(element => element.style.height), '');
        await page.locator('.sp_bg_gen_btn').click();
        await finish(page);
        assert.equal(await page.evaluate(() => fixtureState.requests.length), 2);
    });
});

test('switching chats during generation never restores or saves the new conversation', async () => {
    await withFixture(async page => {
        await page.locator('.sp_bg_gen_btn').click();
        const nextChat = [{is_user:false,is_system:false,mes:'Other conversation',swipe_id:0,swipes:['Other conversation'],swipe_info:[{}]}];
        await page.evaluate(chat => {
            fixtureContext.chat = chat;
            document.querySelector('.mes_text').textContent = 'Other conversation';
            fixtureEmit('CHAT_CHANGED');
        }, nextChat);
        await finish(page);
        assert.deepEqual(await page.evaluate(() => fixtureContext.chat), nextChat);
        assert.equal(await page.locator('.mes_text').textContent(), 'Other conversation');
        assert.equal(await page.evaluate(() => fixtureState.saves), 0);
        assert.equal(await page.locator('.mes').evaluate(element => element.style.height), '');
    });
});
