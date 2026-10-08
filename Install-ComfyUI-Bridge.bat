@echo off
setlocal
rem Generated from scripts/install-bridge.mjs and server/routes.js.
rem Copy this single file into a SillyTavern world root, then run it.
set "COMFYUI_BRIDGE_INSTALLER=%~f0"
set "COMFYUI_BRIDGE_TARGET=%~dp0."
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js was not found. Install the Node.js required by SillyTavern, then run this again.
    if /I not "%~1"=="--unattended" pause
    exit /b 1
)
echo Installing the ComfyUI API server bridge in "%~dp0."
node -e "const fs=require('node:fs');const text=fs.readFileSync(process.env.COMFYUI_BRIDGE_INSTALLER,'utf8').replace(/\r\n/g,'\n');const marker='\n// COMFYUI_BRIDGE_INSTALLER_JS\n';const offset=text.indexOf(marker);if(offset<0)throw new Error('Incomplete bridge installer');if(Number(process.versions.node.split('.')[0])<20)throw new Error('Node.js 20 or newer is required');import('data:text/javascript;base64,'+Buffer.from(text.slice(offset+marker.length)).toString('base64')).catch(error=>{console.error('Bridge installation failed: '+error.message);process.exitCode=1});"
set "COMFYUI_BRIDGE_EXIT=%errorlevel%"
echo.
if /I not "%~1"=="--unattended" pause
exit /b %COMFYUI_BRIDGE_EXIT%

// COMFYUI_BRIDGE_INSTALLER_JS
import fs from 'node:fs/promises';
import path from 'node:path';

export function backupDirectory(target) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(target, 'cache/comfyui-api/deploy-backups', timestamp);
}

export async function writePreserving(target, file, data, backup) {
    const relative = path.relative(target, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Installation target escaped the SillyTavern directory.');
    let existing;
    try { existing = await fs.readFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing?.equals(Buffer.from(data))) return;
    if (existing) {
        const saved = path.join(backup, relative);
        await fs.mkdir(path.dirname(saved), { recursive: true });
        await fs.writeFile(saved, existing);
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    console.log(`Updated ${relative}`);
}

export async function bridgePlan(target, bridgeSource) {
    const server = path.join(target, 'src/endpoints/stable-diffusion.js');
    const original = await fs.readFile(server, 'utf8');
    if (!original.includes('const comfy = express.Router();')) throw new Error('This target has no compatible native ComfyUI router. Place the installer in the SillyTavern world root.');
    const importLine = "import { registerComfyBridge } from './comfyui-bridge.js';";
    const mountLine = 'registerComfyBridge(comfy);';
    let patched = original;
    if (!patched.includes(importLine)) patched = `${importLine}\n${patched}`;
    if (!patched.includes(mountLine)) patched = patched.replace('const comfy = express.Router();', `const comfy = express.Router();\n${mountLine}`);
    return [{ file: path.join(target, 'src/endpoints/comfyui-bridge.js'), data: bridgeSource }, { file: server, data: patched }];
}

export async function installBridge(target, bridgeSource) {
    const plan = await bridgePlan(target, bridgeSource);
    const backup = backupDirectory(target);
    for (const { file, data } of plan) await writePreserving(target, file, data, backup);
}

const target = path.resolve(process.env.COMFYUI_BRIDGE_TARGET);
await installBridge(target, "// Mounted by SeriousTavern's existing ComfyUI router. No independent service.\nexport function registerComfyBridge(router, { fetchFn = globalThis.fetch.bind(globalThis) } = {}) {\n    const actions = ['object-info', 'prompt', 'history', 'image', 'queue-delete', 'upload-image'];\n    for (const action of actions) router.post(`/bridge/${action}`, async (request, response) => {\n        try {\n            const base = new URL(String(request.body.url));\n            if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {\n                return response.status(400).json({ error: 'Use an HTTP(S) ComfyUI URL without credentials, query parameters, or a fragment.' });\n            }\n            const promptId = String(request.body.promptId || '');\n            if (['history', 'queue-delete'].includes(action) && !/^[a-zA-Z0-9_-]+$/.test(promptId)) return response.status(400).json({ error: 'A valid promptId is required.' });\n            if (action === 'prompt' && (!request.body.prompt || typeof request.body.prompt !== 'object' || Array.isArray(request.body.prompt))) return response.status(400).json({ error: 'An API workflow object is required.' });\n            if (action === 'image' && (typeof request.body.filename !== 'string' || !request.body.filename || !['output', 'temp', 'input'].includes(request.body.type || 'output'))) return response.status(400).json({ error: 'A valid image filename and type are required.' });\n            const paths = { 'object-info': '/object_info', prompt: '/prompt', history: `/history/${encodeURIComponent(promptId)}`, image: '/view', 'queue-delete': '/queue', 'upload-image': '/upload/image' };\n            const url = new URL(base.href.replace(/\\/+$/, '') + paths[action]);\n            if (action === 'image') for (const key of ['filename', 'subfolder', 'type']) url.searchParams.set(key, String(request.body[key] || (key === 'type' ? 'output' : '')));\n            let payload = action === 'prompt' ? { prompt: request.body.prompt, client_id: request.body.clientId } : action === 'queue-delete' ? { delete: [promptId] } : null;\n            if (action === 'upload-image') {\n                const { image, mimeType, filename } = request.body;\n                const formats = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };\n                if (!Object.hasOwn(formats, mimeType) || typeof image !== 'string' || !image || image.length > Math.ceil(20 * 1024 * 1024 / 3) * 4 || image.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image) || typeof filename !== 'string' || !/^[A-Za-z0-9_-]+\\.(png|jpg|webp|gif|avif)$/.test(filename) || !filename.endsWith(`.${formats[mimeType]}`)) return response.status(400).json({ error: 'A valid reference image up to 20 MiB and a safe filename are required.' });\n                const bytes = Buffer.from(image, 'base64');\n                if (bytes.length > 20 * 1024 * 1024) return response.status(400).json({ error: 'The reference image exceeds 20 MiB.' });\n                payload = new FormData();\n                payload.append('image', new Blob([bytes], { type: mimeType }), filename);\n                payload.append('type', 'input'); payload.append('subfolder', 'serioustavern-comfyui-api'); payload.append('overwrite', 'false');\n            }\n            const controller = new AbortController();\n            const close = () => { if (!response.writableEnded) controller.abort(); };\n            response.on('close', close);\n            const timer = setTimeout(() => controller.abort(), 30000);\n            let upstream;\n            try {\n                upstream = await fetchFn(url.href, { method: payload ? 'POST' : 'GET', headers: payload && !(payload instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined, body: payload instanceof FormData ? payload : payload ? JSON.stringify(payload) : undefined, signal: controller.signal });\n                const data = Buffer.from(await upstream.arrayBuffer());\n                if (!response.destroyed) {\n                    response.status(upstream.status);\n                    response.set('Content-Type', upstream.headers.get('content-type') || 'application/json');\n                    response.send(data);\n                }\n            } finally {\n                clearTimeout(timer);\n                response.off('close', close);\n            }\n        } catch (error) {\n            if (!response.destroyed) response.status(502).json({ error: `Cannot reach ComfyUI: ${error.message}` });\n        }\n    });\n}\n");
console.log(`ComfyUI API server bridge installed in ${target}.`);
console.log('Restart this SillyTavern world, reload the browser, leave connection Automatic and press Connect.');
