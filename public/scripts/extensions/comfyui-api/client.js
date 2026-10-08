import { normalizeEndpoint, requestId } from './core.js';

export class ComfyClient {
    constructor(endpoint, { fetchFn = globalThis.fetch.bind(globalThis), requestHeaders = () => ({ 'Content-Type': 'application/json' }), transport = 'auto' } = {}) {
        this.endpoint = normalizeEndpoint(endpoint);
        this.fetch = fetchFn;
        this.requestHeaders = requestHeaders;
        this.mode = transport === 'browser' ? 'browser' : 'server';
        this.allowFallback = transport === 'auto';
        this.bridgeMissing = false;
    }

    async request(action, payload = {}, { signal, binary = false } = {}) {
        let response;
        const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000);
        if (this.mode === 'server') {
            response = await this.fetch(`/api/sd/comfy/bridge/${action}`, {
                method: 'POST', headers: this.requestHeaders(), body: JSON.stringify({ url: this.endpoint, ...payload }), signal: requestSignal,
            });
            // Only probe requests can switch transports. Never retry a submission
            // after an uncertain response, since it could enqueue a second job.
            if (response.status === 404 && action === 'object-info') {
                this.bridgeMissing = true;
                if (this.allowFallback) {
                    this.mode = 'browser';
                    return this.request(action, payload, { signal, binary });
                }
                throw new Error('The ComfyUI API server bridge is missing or has not been loaded in this SillyTavern instance. Install the bridge in this world and restart SillyTavern.');
            }
        } else {
            const routes = {
                'object-info': ['/object_info', 'GET'],
                prompt: ['/prompt', 'POST'],
                history: [`/history/${encodeURIComponent(payload.promptId || '')}`, 'GET'],
                image: ['/view', 'GET'],
                'queue-delete': ['/queue', 'POST'],
                'upload-image': ['/upload/image', 'POST'],
            };
            const route = routes[action];
            if (!route) throw new Error(`Unknown ComfyUI action ${action}.`);
            const url = new URL(this.endpoint + route[0]);
            if (action === 'image') for (const key of ['filename', 'subfolder', 'type']) url.searchParams.set(key, payload[key] || (key === 'type' ? 'output' : ''));
            let body = action === 'prompt' ? { prompt: payload.prompt, client_id: payload.clientId } : action === 'queue-delete' ? { delete: [payload.promptId] } : null;
            if (action === 'upload-image') {
                body = new FormData();
                body.append('image', new Blob([Uint8Array.from(atob(payload.image), value => value.charCodeAt(0))], { type: payload.mimeType }), payload.filename);
                body.append('type', 'input'); body.append('subfolder', 'serioustavern-comfyui-api'); body.append('overwrite', 'false');
            }
            try {
                response = await this.fetch(url.href, { method: route[1], headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, signal: requestSignal });
            } catch (error) {
                if (signal?.aborted) throw signal.reason;
                const message = this.bridgeMissing
                    ? 'This SillyTavern instance has no active ComfyUI API server bridge, and its browser cannot reach ComfyUI. Install the bridge in this world and restart SillyTavern, or allow this browser\'s origin in ComfyUI\'s CORS settings.'
                    : 'Cannot reach ComfyUI from the browser. Check the endpoint and ComfyUI CORS settings, or install the ComfyUI API server bridge in this SillyTavern instance.';
                throw new Error(message, { cause: error });
            }
        }
        if (!response.ok) {
            const details = (await response.text()).slice(0, 2000);
            throw new Error(`ComfyUI ${action} failed (${response.status}): ${details}`);
        }
        if (binary) return response.blob();
        return response.status === 204 ? {} : response.json();
    }

    objectInfo(signal) { return this.request('object-info', {}, { signal }); }

    async uploadImage(blob, signal) {
        const formats = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
        const mimeType = blob.type.split(';')[0];
        const extension = formats[mimeType];
        if (!extension || !blob.size || blob.size > 20 * 1024 * 1024) throw new Error('Use a PNG, JPEG, WebP, GIF, or AVIF reference image up to 20 MiB.');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const chunks = [];
        for (let offset = 0; offset < bytes.length; offset += 32768) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
        signal?.throwIfAborted();
        return this.request('upload-image', { image: btoa(chunks.join('')), mimeType, filename: `comfy_reference_${requestId()}.${extension}` }, { signal });
    }

    async submit(graph, signal) {
        const result = await this.request('prompt', { prompt: graph, clientId: requestId() }, { signal });
        if (!result.prompt_id || (result.node_errors && Object.keys(result.node_errors).length)) {
            throw new Error(`ComfyUI rejected the workflow: ${JSON.stringify(result.node_errors || result.error || result)}`);
        }
        return result.prompt_id;
    }

    async waitForImage(promptId, { signal, timeoutSeconds = 900, outputNode = '', onStatus = () => {} } = {}) {
        const deadline = Date.now() + timeoutSeconds * 1000;
        while (Date.now() < deadline) {
            signal?.throwIfAborted();
            const history = await this.request('history', { promptId }, { signal });
            const item = history[promptId];
            if (item) {
                const messages = item.status?.messages || [];
                if (item.status?.status_str === 'error' || messages.some(([kind]) => kind === 'execution_error' || kind === 'execution_interrupted')) {
                    const error = messages.find(([kind]) => kind === 'execution_error')?.[1];
                    throw new Error(error ? `${error.node_type || 'Node'} [${error.node_id}]: ${error.exception_message || 'execution failed'}` : 'ComfyUI execution failed or was interrupted.');
                }
                const outputs = outputNode ? [item.outputs?.[outputNode]] : Object.values(item.outputs || {});
                const image = outputs.flatMap(output => output?.images || []).find(entry => entry?.filename && (entry.type || 'output') === 'output');
                if (!image) throw new Error(outputNode ? `Output node ${outputNode} did not produce a saved image.` : 'The workflow completed without a saved image. Add a Save Image node or choose its output node.');
                return { descriptor: image, blob: await this.request('image', image, { signal, binary: true }), promptId };
            }
            onStatus('Waiting for ComfyUI…');
            await new Promise((resolve, reject) => {
                const abort = () => { clearTimeout(timer); reject(signal.reason); };
                const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 750);
                signal?.addEventListener('abort', abort, { once: true });
            });
        }
        throw new Error(`ComfyUI did not finish within ${timeoutSeconds} seconds. Job ${promptId} may still finish in ComfyUI.`);
    }

    // Deleting this job from the pending queue is safe even if it has started:
    // ComfyUI simply leaves running jobs alone. Never use the global /interrupt.
    cancelPending(promptId) { return this.request('queue-delete', { promptId }); }
}
