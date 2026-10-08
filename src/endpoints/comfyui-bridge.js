// Mounted by SeriousTavern's existing ComfyUI router. No independent service.
export function registerComfyBridge(router, { fetchFn = globalThis.fetch.bind(globalThis) } = {}) {
    const actions = ['object-info', 'prompt', 'history', 'image', 'queue-delete', 'upload-image'];
    for (const action of actions) router.post(`/bridge/${action}`, async (request, response) => {
        try {
            const base = new URL(String(request.body.url));
            if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
                return response.status(400).json({ error: 'Use an HTTP(S) ComfyUI URL without credentials, query parameters, or a fragment.' });
            }
            const promptId = String(request.body.promptId || '');
            if (['history', 'queue-delete'].includes(action) && !/^[a-zA-Z0-9_-]+$/.test(promptId)) return response.status(400).json({ error: 'A valid promptId is required.' });
            if (action === 'prompt' && (!request.body.prompt || typeof request.body.prompt !== 'object' || Array.isArray(request.body.prompt))) return response.status(400).json({ error: 'An API workflow object is required.' });
            if (action === 'image' && (typeof request.body.filename !== 'string' || !request.body.filename || !['output', 'temp', 'input'].includes(request.body.type || 'output'))) return response.status(400).json({ error: 'A valid image filename and type are required.' });
            const paths = { 'object-info': '/object_info', prompt: '/prompt', history: `/history/${encodeURIComponent(promptId)}`, image: '/view', 'queue-delete': '/queue', 'upload-image': '/upload/image' };
            const url = new URL(base.href.replace(/\/+$/, '') + paths[action]);
            if (action === 'image') for (const key of ['filename', 'subfolder', 'type']) url.searchParams.set(key, String(request.body[key] || (key === 'type' ? 'output' : '')));
            let payload = action === 'prompt' ? { prompt: request.body.prompt, client_id: request.body.clientId } : action === 'queue-delete' ? { delete: [promptId] } : null;
            if (action === 'upload-image') {
                const { image, mimeType, filename } = request.body;
                const formats = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
                if (!Object.hasOwn(formats, mimeType) || typeof image !== 'string' || !image || image.length > Math.ceil(20 * 1024 * 1024 / 3) * 4 || image.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image) || typeof filename !== 'string' || !/^[A-Za-z0-9_-]+\.(png|jpg|webp|gif|avif)$/.test(filename) || !filename.endsWith(`.${formats[mimeType]}`)) return response.status(400).json({ error: 'A valid reference image up to 20 MiB and a safe filename are required.' });
                const bytes = Buffer.from(image, 'base64');
                if (bytes.length > 20 * 1024 * 1024) return response.status(400).json({ error: 'The reference image exceeds 20 MiB.' });
                payload = new FormData();
                payload.append('image', new Blob([bytes], { type: mimeType }), filename);
                payload.append('type', 'input'); payload.append('subfolder', 'serioustavern-comfyui-api'); payload.append('overwrite', 'false');
            }
            const controller = new AbortController();
            const close = () => { if (!response.writableEnded) controller.abort(); };
            response.on('close', close);
            const timer = setTimeout(() => controller.abort(), 30000);
            let upstream;
            try {
                upstream = await fetchFn(url.href, { method: payload ? 'POST' : 'GET', headers: payload && !(payload instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined, body: payload instanceof FormData ? payload : payload ? JSON.stringify(payload) : undefined, signal: controller.signal });
                const data = Buffer.from(await upstream.arrayBuffer());
                if (!response.destroyed) {
                    response.status(upstream.status);
                    response.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
                    response.send(data);
                }
            } finally {
                clearTimeout(timer);
                response.off('close', close);
            }
        } catch (error) {
            if (!response.destroyed) response.status(502).json({ error: `Cannot reach ComfyUI: ${error.message}` });
        }
    });
}
