import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { registerComfyBridge } from '../../src/endpoints/comfyui-bridge.js';
import { defaultSettings } from '../../public/scripts/extensions/comfyui-api/core.js';

test('ComfyUI API is discoverable as a bundled manual extension with local defaults', async () => {
    const extension = new URL('../../public/scripts/extensions/comfyui-api/', import.meta.url);
    const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', extension), 'utf8'));
    assert.equal(manifest.display_name, 'ComfyUI API'); assert.equal(manifest.hooks.activate, 'init');
    assert.deepEqual(manifest.requires, []);
    for (const name of [manifest.js, manifest.css, 'core.js', 'client.js', 'workflow.js', 'view.js']) assert.ok((await fs.stat(new URL(name, extension))).isFile());
    const settings = defaultSettings();
    assert.equal(settings.endpoint, 'http://127.0.0.1:8188'); assert.equal(settings.fieldCount, 0);
    assert.equal(settings.dockEnabled, true); assert.equal(settings.fields.length, 5);
    assert.equal(settings.referenceNode, ''); assert.equal(settings.prePrompt, '');
    assert.equal(settings.showPrePrompt, false); assert.equal(settings.chatShiftPixels, 480);
    const parent = await fs.readFile(new URL('../../src/endpoints/stable-diffusion.js', import.meta.url), 'utf8');
    assert.ok(parent.includes("import { registerComfyBridge } from './comfyui-bridge.js';"));
    assert.ok(parent.includes('registerComfyBridge(comfy);'));
});

test('the installed Express bridge proxies node information and a scoped queue deletion', async t => {
    const calls = [];
    const upstream = http.createServer(async (request, response) => {
        const chunks = []; for await (const chunk of request) chunks.push(chunk);
        calls.push({ path: request.url, data: chunks.length ? JSON.parse(Buffer.concat(chunks)) : null });
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(request.url === '/object_info' ? { PrimitiveInt: { input: { required: { value: ['INT', {}] } } } } : {}));
    });
    upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
    const app = express(); app.use(express.json());
    const router = express.Router(); registerComfyBridge(router); app.use('/comfy', router);
    const host = app.listen(0, '127.0.0.1'); await once(host, 'listening');
    t.after(() => { for (const server of [host, upstream]) { server.closeAllConnections(); server.close(); } });
    const endpoint = `http://127.0.0.1:${upstream.address().port}`;
    const origin = `http://127.0.0.1:${host.address().port}`;
    const post = (action, body) => fetch(`${origin}/comfy/bridge/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: endpoint, ...body }) });
    const info = await post('object-info', {}); assert.equal(info.status, 200); assert.ok((await info.json()).PrimitiveInt);
    const deletion = await post('queue-delete', { promptId: 'only-this-job' }); assert.equal(deletion.status, 200);
    assert.deepEqual(calls, [{ path: '/object_info', data: null }, { path: '/queue', data: { delete: ['only-this-job'] } }]);
    assert.equal((await post('queue-delete', {})).status, 400);
});

test('the installed bridge transfers reference image bytes as a ComfyUI multipart upload', async t => {
    let received;
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    const upstream = http.createServer(async (request, response) => {
        const chunks = []; for await (const chunk of request) chunks.push(chunk);
        const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers['content-type'] } }).formData();
        const image = form.get('image');
        received = { path: request.url, method: request.method, name: image.name, type: image.type, bytes: Buffer.from(await image.arrayBuffer()), folder: form.get('subfolder'), storage: form.get('type'), overwrite: form.get('overwrite') };
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ name: image.name, subfolder: form.get('subfolder'), type: form.get('type') }));
    });
    upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
    const app = express(); app.use(express.json());
    const router = express.Router(); registerComfyBridge(router); app.use('/comfy', router);
    const host = app.listen(0, '127.0.0.1'); await once(host, 'listening');
    t.after(() => { for (const server of [host, upstream]) { server.closeAllConnections(); server.close(); } });
    const response = await fetch(`http://127.0.0.1:${host.address().port}/comfy/bridge/upload-image`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `http://127.0.0.1:${upstream.address().port}`, image: bytes.toString('base64'), filename: 'reference.png', mimeType: 'image/png' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { name: 'reference.png', subfolder: 'serioustavern-comfyui-api', type: 'input' });
    assert.deepEqual(received, { path: '/upload/image', method: 'POST', name: 'reference.png', type: 'image/png', bytes, folder: 'serioustavern-comfyui-api', storage: 'input', overwrite: 'false' });
});
