import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../tests/node_modules/playwright-core/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const prefix = '/scripts/extensions/character-colors/';
const fixture = `<html><head><meta charset="utf-8"><link rel="stylesheet" href="${prefix}style.css">
<style>body{background:#10131a;color:#ddd;font:18px Georgia;padding:36px;max-width:850px}p{line-height:1.7}details{font:16px sans-serif}textarea{background:#20242b;color:white}a{color:#ccc}</style></head>
<body><h1>Character Colors</h1><div id="extensions_settings"></div><div id="chat">
<div class="mes" mesid="0"><div class="mes_block"><div class="mes_text">
<p>Mara: “The rain will pass.”</p><p>Oran: “Then we can wait.”</p>
<p><em>Mara</em> looks toward the window.</p><p><code>Mara: “Code remains plain.”</code> <a href="#">Oran</a></p>
</div></div></div></div></body></html>`;

test('standalone colors render and restore without prompts, chat writes or external requests', async () => {
    const browser = await chromium.launch({ channel: process.env.SERIOUS_BROWSER_CHANNEL || 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        const unexpected = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://colors.invalid') {
                unexpected.push(url.href);
                return route.abort();
            }
            if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: fixture });
            if (url.pathname === '/script.js') return route.fulfill({ contentType: 'text/javascript', body: `
                globalThis.fixtureEvents = new Map(); globalThis.settingsSaves = 0;
                export const event_types = Object.fromEntries(['CHARACTER_MESSAGE_RENDERED','USER_MESSAGE_RENDERED','MESSAGE_UPDATED','MESSAGE_SWIPED','CHAT_CHANGED','MORE_MESSAGES_LOADED','APP_READY'].map(key=>[key,key]));
                export const eventSource = { makeLast(type,fn) { globalThis.fixtureEvents.set(type,fn); } };
                export function saveSettingsDebounced() { globalThis.settingsSaves++; }
            ` });
            if (url.pathname === '/scripts/extensions.js') return route.fulfill({ contentType: 'text/javascript', body: `
                export const extension_settings = globalThis.fixtureSettings = {};
                globalThis.fixtureContext = { chat: [{name:'Narrator',mes:'Stored transcript remains untouched.'}], chatMetadata: {} };
                export function getContext() { return globalThis.fixtureContext; }
            ` });
            const relative = url.pathname.slice(prefix.length);
            if (url.pathname.startsWith(prefix) && !relative.includes('..') && /\.(js|css)$/.test(relative)) {
                return route.fulfill({ contentType: relative.endsWith('.css') ? 'text/css' : 'text/javascript', body: await fs.readFile(path.join(root, 'public', prefix, relative)) });
            }
            unexpected.push(url.href);
            await route.abort();
        });
        await page.goto('http://colors.invalid/');
        const original = await page.locator('.mes_text').innerHTML();
        await page.evaluate(async () => {
            const extension = await import('/scripts/extensions/character-colors/index.js');
            extension.init(); extension.init();
        });
        assert.equal(await page.locator('#character-colors-settings').count(), 1);
        assert.ok(await page.locator('.cc-adornment-token').count() > 0);
        assert.equal(await page.locator('code .cc-adornment-token, a .cc-adornment-token').count(), 0);
        assert.equal(await page.evaluate(() => settingsSaves), 0);
        await page.locator('summary').click();
        await page.locator('.cc-identities').fill('Mara | she/her | Captain Mara\nOran | he/him');
        await page.locator('.cc-save').click();
        assert.equal(await page.locator('.cc-status').textContent(), 'Saved.');
        assert.equal(await page.locator('em .cc-adornment-identity').count(), 1);
        const saved = await page.evaluate(() => JSON.stringify(fixtureSettings));
        await page.locator('.cc-identities').fill('Mara | she | Alias | invalid');
        await page.locator('.cc-save').click();
        assert.equal(await page.evaluate(() => JSON.stringify(fixtureSettings)), saved);
        assert.match(await page.locator('.cc-status').textContent(), /too many/);
        await page.locator('.cc-enabled').uncheck();
        assert.equal(await page.locator('.mes_text').innerHTML(), original);
        await page.locator('.cc-enabled').check();
        const colored = await page.locator('.mes_text').innerHTML();
        await page.evaluate(() => fixtureEvents.get('CHARACTER_MESSAGE_RENDERED')(0));
        assert.equal(await page.locator('.mes_text').innerHTML(), colored);
        // Simulate a native edit/swipe replacing rendered message contents.
        await page.evaluate(() => {
            document.querySelector('.mes_text').innerHTML = '<p>Mara: “A new line.”</p>';
            fixtureEvents.get('MESSAGE_UPDATED')(0);
        });
        assert.ok(await page.locator('.cc-adornment-token').count() > 0);
        // Existing SemanticPlay visuals retain ownership without duplicate wrapping.
        await page.evaluate(() => {
            fixtureContext.chatMetadata.semanticPlay = { adornment: { enabled: true, intensity: 'normal' } };
            fixtureEvents.get('CHAT_CHANGED')();
        });
        assert.equal(await page.locator('.cc-adornment-token').count(), 0);
        await page.evaluate(() => {
            fixtureContext.chatMetadata = {};
            fixtureEvents.get('CHAT_CHANGED')();
        });
        assert.ok(await page.locator('.cc-adornment-token').count() > 0);
        assert.deepEqual(await page.evaluate(() => fixtureContext.chat), [{ name: 'Narrator', mes: 'Stored transcript remains untouched.' }]);
        assert.deepEqual(await page.evaluate(() => fixtureContext.chatMetadata), {});
        assert.deepEqual(unexpected, []);
        assert.deepEqual(errors, []);
        if (process.env.SERIOUS_COLORS_SCREENSHOT) {
            await page.evaluate(html => {
                document.querySelector('.mes_text').innerHTML = html;
                fixtureEvents.get('CHAT_CHANGED')();
            }, original);
            await page.locator('.cc-identities').fill('Mara | she/her | Captain Mara\nOran | he/him');
            await page.locator('.cc-save').click();
            await page.screenshot({ path: process.env.SERIOUS_COLORS_SCREENSHOT, fullPage: true });
        }
    } finally {
        await browser.close();
    }
});
