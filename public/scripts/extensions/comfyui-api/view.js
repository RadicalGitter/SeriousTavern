import { MAX_FIELDS, listInputs, parseWorkflow, galleryFromChat, referenceFromChat } from './core.js';
import { importWorkflow } from './workflow.js';

function element(tag, text = '', className = '') {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

export function mountView({ settings, save, context, connect, generate, cancel, preview, toggleReference }) {
    const root = element('details', '', 'cpb-settings');
    root.id = 'comfyui-api-settings';
    root.innerHTML = `
        <summary>ComfyUI API</summary>
        <div class="cpb-settings-body">
            <p class="cpb-muted">Your workflow, your fields, and a dedicated image prompt writer.</p>
            <label for="cpb-endpoint">ComfyUI endpoint</label>
            <div class="cpb-row"><input id="cpb-endpoint" type="url" class="text_pole" placeholder="http://127.0.0.1:8188"><button id="cpb-connect" type="button" class="menu_button">Connect</button></div>
            <label for="cpb-transport">Connection</label>
            <select id="cpb-transport" class="text_pole"><option value="auto">Automatic (server bridge, then browser)</option><option value="server">Server bridge</option><option value="browser">Browser (requires ComfyUI CORS)</option></select>
            <div class="cpb-row cpb-wrap"><button id="cpb-import-workflow" type="button" class="menu_button">Import API workflow…</button><span id="cpb-workflow-name" class="cpb-muted"></span></div>
            <input id="cpb-workflow-file" type="file" accept=".json,application/json" aria-label="Import ComfyUI API workflow" hidden>
            <p id="cpb-workflow-info" class="cpb-muted"></p>
            <label for="cpb-output-node">Image output node (optional)</label><input id="cpb-output-node" list="cpb-node-list" class="text_pole" type="text" placeholder="Save Image node ID; first saved image by default">
            <p class="cpb-muted">Target the Save Image node receiving VAE Decode’s image, or another node that saves an image file.</p>
            <label for="cpb-reference-node">Qwen 2.1 reference node ID (optional)</label><input id="cpb-reference-node" list="cpb-node-list" class="text_pole" type="text" placeholder="Text Encode Qwen Image 2.1 node ID">
            <p class="cpb-muted">Set this to enable “Use as reference” beside the gallery controls. The selected image replaces this node’s reference-image list; clearing the selection supplies no images. Leave blank to keep the workflow’s original image wiring.</p>
            <div class="cpb-row"><span>Custom fields</span><div id="cpb-field-count" class="cpb-ribbon" role="group" aria-label="Number of custom fields"></div></div>
            <div id="cpb-fields"></div>
            <fieldset class="cpb-prompt"><legend>Image prompt writer</legend>
                <label for="cpb-instructions">Instructions sent to the SillyTavern model as its system prompt</label>
                <textarea id="cpb-instructions" class="text_pole" rows="7"></textarea>
                <p class="cpb-muted">Aliases ignore case: <code>{{resolution_x}}:{{resolution_Y}}</code>. Field values are resolved before the model call.</p>
                <div id="cpb-alias-buttons" class="cpb-row cpb-wrap"></div>
                <div id="cpb-prompt-target"></div>
            </fieldset>
            <label for="cpb-scene">Scene request (optional)</label>
            <textarea id="cpb-scene" class="text_pole" rows="2" placeholder="Illustrate the current scene"></textarea>
            <div class="cpb-row cpb-wrap"><label for="cpb-pre-prompt">Last-reply pre-prompt (optional)</label><label class="cpb-check"><input id="cpb-pre-prompt-show" type="checkbox" aria-label="Show last-reply pre-prompt above Illustrate last reply"> Show field</label></div>
            <textarea id="cpb-pre-prompt" class="text_pole" rows="4" placeholder="Instructions to place before the last model reply"></textarea>
            <p class="cpb-muted">For “Illustrate last reply” and <code>/comfy-image last</code>: this text follows [Instructions], and the last reply follows [Scene], with blank lines between each part. Supports field aliases. The prompt writer’s system instructions still apply.</p>
            <details><summary>Context and output</summary><div class="cpb-options">
                <label for="cpb-recent">Recent chat messages (0–50)</label><input id="cpb-recent" class="text_pole" type="number" min="0" max="50">
                <label for="cpb-tokens">Prompt output token limit</label><input id="cpb-tokens" class="text_pole" type="number" min="64" max="8192">
                <label for="cpb-timeout">Workflow timeout (seconds)</label><input id="cpb-timeout" class="text_pole" type="number" min="10" max="3600">
            </div></details>
            <fieldset><legend>Left sidebar</legend>
                <label class="cpb-check"><input id="cpb-dock-enabled" type="checkbox"> Show image sidebar</label>
                <label class="cpb-check"><input id="cpb-shift-chat" type="checkbox"> Move the conversation column to the right</label>
                <label for="cpb-chat-shift">Chat shift to the right (screen pixels)</label><input id="cpb-chat-shift" class="text_pole" type="number" min="0" max="10000" step="1">
                <p class="cpb-muted">The shift accounts for display scaling and browser zoom, and is limited to keep the chat inside the screen. The image panel fills the space to the left of the chat.</p>
                <label for="cpb-dock-width">Mobile sidebar width (CSS pixels)</label><input id="cpb-dock-width" class="text_pole" type="number" min="240" max="1200">
                <p class="cpb-muted">Select “Show field” on a custom field to edit it from the sidebar. Hidden fields retain their saved values.</p>
            </fieldset>
            <div class="cpb-row cpb-wrap"><button id="cpb-preview" class="menu_button" type="button">Preview inputs</button><button id="cpb-generate" class="menu_button" type="button">Generate image</button><button id="cpb-last" class="menu_button" type="button">Illustrate last reply</button><button id="cpb-cancel" class="menu_button" type="button" disabled>Cancel</button></div>
            <p id="cpb-status" role="status" aria-live="polite"></p>
            <details id="cpb-preview-panel"><summary>Resolved instructions and workflow</summary><pre id="cpb-preview-text"></pre></details>
        </div>`;
    const container = document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings');
    if (!container) throw new Error('The SillyTavern Extensions settings container is unavailable.');
    container.append(root);
    const dock = element('aside', '', 'cpb-dock');
    dock.id = 'comfyui-api-dock';
    dock.setAttribute('aria-label', 'ComfyUI image sidebar');
    dock.innerHTML = `
        <div class="cpb-dock-gallery"><a id="cpb-image-link" target="_blank" rel="noopener"><img id="cpb-image" alt="Last generated image" hidden></a><div id="cpb-empty-image">Your generated images appear here</div>
        <div class="cpb-gallery-nav"><button id="cpb-previous" type="button" aria-label="Previous generated image">‹</button><div class="cpb-gallery-center"><span id="cpb-image-count">0 / 0</span><button id="cpb-reference" type="button" aria-pressed="false" disabled>Use as reference</button></div><button id="cpb-next" type="button" aria-label="Next generated image">›</button></div><p id="cpb-reference-status" role="status" aria-live="polite"></p><p id="cpb-image-caption"></p></div>
        <div class="cpb-dock-bottom"><div id="cpb-dock-fields"></div><label id="cpb-dock-pre-prompt-holder" class="cpb-dock-field cpb-pre-prompt-field" hidden>Last-reply pre-prompt<textarea id="cpb-dock-pre-prompt" rows="3" aria-label="Last-reply pre-prompt sidebar value"></textarea></label><button id="cpb-dock-last" type="button">Illustrate last reply</button><button id="cpb-dock-cancel" type="button" hidden>Cancel</button><p id="cpb-dock-status" role="status" aria-live="polite"></p></div>`;
    document.body.append(dock);
    const toggle = element('button', 'Images', 'cpb-mobile-toggle');
    toggle.id = 'cpb-mobile-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    document.body.append(toggle);
    toggle.addEventListener('click', () => {
        const open = dock.classList.toggle('cpb-mobile-open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? 'Close images' : 'Images';
    });

    let graph = {};
    let gallery = [];
    let selectedUrl = '';
    const q = selector => root.querySelector(selector);
    const chat = document.querySelector('#sheld');
    function sizeDock() {
        if (innerWidth >= 1000 && chat) {
            const width = `${Math.max(0, Math.round(chat.getBoundingClientRect().left - 24))}px`;
            if (document.body.style.getPropertyValue('--cpb-desktop-width') !== width) document.body.style.setProperty('--cpb-desktop-width', width);
        }
        sizeImage();
    }
    function sizeImage() {
        const galleryChrome = dock.querySelector('.cpb-dock-gallery').getBoundingClientRect().height - dock.querySelector('#cpb-image-link').getBoundingClientRect().height;
        const remaining = dock.getBoundingClientRect().height - dock.querySelector('.cpb-dock-bottom').getBoundingClientRect().height - galleryChrome - 16;
        dock.querySelector('#cpb-image').style.maxHeight = `${Math.max(80, remaining)}px`;
    }
    const observer = new ResizeObserver(sizeDock);
    observer.observe(dock); observer.observe(dock.querySelector('.cpb-dock-bottom'));
    if (chat) observer.observe(chat);
    const chatObserver = new MutationObserver(sizeDock);
    if (chat) chatObserver.observe(chat, { attributes: true, attributeFilter: ['style', 'class'] });
    let densityMedia;
    let lastDensity = devicePixelRatio;
    const densityChanged = () => { lastDensity = devicePixelRatio; watchDensity(); renderLayout(); };
    function watchDensity() {
        densityMedia?.removeEventListener('change', densityChanged);
        densityMedia = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
        densityMedia.addEventListener('change', densityChanged);
    }
    watchDensity();
    // Some browsers can change display density without a resize/media event.
    const densityTimer = setInterval(() => { if (devicePixelRatio !== lastDensity) densityChanged(); }, 1000);
    window.addEventListener('resize', renderLayout);
    dock.querySelector('#cpb-image').addEventListener('load', sizeDock);
    const bind = (selector, key, number = false) => {
        const input = q(selector);
        input.value = settings[key];
        input.addEventListener('input', () => { settings[key] = number ? Number(input.value) : input.value; save(); });
    };
    bind('#cpb-endpoint', 'endpoint'); bind('#cpb-transport', 'transport');
    bind('#cpb-scene', 'scene'); bind('#cpb-recent', 'recentMessages', true); bind('#cpb-tokens', 'responseTokens', true);
    bind('#cpb-pre-prompt', 'prePrompt');
    q('#cpb-pre-prompt').addEventListener('input', () => { dock.querySelector('#cpb-dock-pre-prompt').value = settings.prePrompt; });
    q('#cpb-pre-prompt-show').checked = settings.showPrePrompt;
    q('#cpb-pre-prompt-show').addEventListener('change', event => { settings.showPrePrompt = event.target.checked; save(); renderPrePrompt(); });
    dock.querySelector('#cpb-dock-pre-prompt').addEventListener('input', event => {
        settings.prePrompt = event.target.value; q('#cpb-pre-prompt').value = settings.prePrompt; save();
    });
    bind('#cpb-timeout', 'timeoutSeconds', true); bind('#cpb-output-node', 'outputNode');
    bind('#cpb-reference-node', 'referenceNode');
    q('#cpb-reference-node').addEventListener('input', showGallery);
    q('#cpb-instructions').value = settings.prompt.instructions;
    q('#cpb-instructions').addEventListener('input', event => { settings.prompt.instructions = event.target.value; save(); });
    q('#cpb-import-workflow').addEventListener('click', () => q('#cpb-workflow-file').click());
    q('#cpb-workflow-file').addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const imported = importWorkflow(settings, text, file.name);
            Object.assign(settings, imported);
            q('#cpb-output-node').value = settings.outputNode; q('#cpb-reference-node').value = settings.referenceNode;
            save(); renderMappings(); showGallery();
            setStatus(`Loaded ${file.name}. Suggested node mappings are ready to review and edit.`);
        } catch (error) { setStatus(error.message, true); } finally { event.target.value = ''; }
    });
    for (const [selector, key] of [['#cpb-dock-enabled', 'dockEnabled'], ['#cpb-shift-chat', 'shiftChat']]) {
        q(selector).checked = settings[key];
        q(selector).addEventListener('change', event => { settings[key] = event.target.checked; save(); renderLayout(); });
    }
    q('#cpb-dock-width').value = settings.dockWidth;
    q('#cpb-dock-width').addEventListener('input', event => { settings.dockWidth = Math.min(1200, Math.max(240, Number(event.target.value) || 420)); save(); renderLayout(); });
    q('#cpb-chat-shift').value = settings.chatShiftPixels;
    q('#cpb-chat-shift').addEventListener('input', event => { settings.chatShiftPixels = Math.min(10000, Math.max(0, Math.round(Number(event.target.value) || 0))); save(); renderLayout(); });

    for (let count = 0; count <= MAX_FIELDS; count++) {
        const button = element('button', String(count));
        button.type = 'button'; button.dataset.count = String(count);
        button.addEventListener('click', () => { settings.fieldCount = count; save(); renderMappings(); });
        q('#cpb-field-count').append(button);
    }

    function targetEditor(target, label) {
        const row = element('div', '', 'cpb-target');
        const nodeLabel = element('label', `${label} node`);
        const node = element('input'); node.className = 'text_pole'; node.type = 'text'; node.value = target.nodeId;
        node.placeholder = 'Node ID'; node.setAttribute('aria-label', `${label} node`);
        node.setAttribute('list', 'cpb-node-list'); nodeLabel.append(node);
        const inputLabel = element('label', 'Input');
        const input = element('select'); input.className = 'text_pole'; input.setAttribute('aria-label', `${label} input`);
        const options = listInputs(graph, target.nodeId);
        input.append(new Option('Auto (single scalar input)', ''));
        for (const name of options) input.append(new Option(name, name));
        if (target.inputKey && !options.includes(target.inputKey)) input.append(new Option(`${target.inputKey} (missing)`, target.inputKey));
        input.value = target.inputKey; inputLabel.append(input);
        node.addEventListener('change', () => { target.nodeId = node.value.trim(); target.inputKey = ''; save(); renderMappings(); });
        input.addEventListener('change', () => { target.inputKey = input.value; save(); });
        row.append(nodeLabel, inputLabel);
        return row;
    }

    let renderingMappings = false;
    function renderMappings() {
        // Removing a focused editor can dispatch its native change/blur event.
        // That event may update settings, but must not replace this same tree.
        if (renderingMappings) return;
        renderingMappings = true;
        try { updateMappings(); } finally { renderingMappings = false; }
    }

    function updateMappings() {
        q('#cpb-workflow-name').textContent = settings.workflowName || (settings.workflow ? 'Saved API workflow' : 'No workflow imported');
        try {
            graph = parseWorkflow(settings.workflow);
            q('#cpb-workflow-info').textContent = `${Object.keys(graph).length} API nodes loaded. Choose literal input fields; connected inputs remain wired.`;
        } catch (error) { graph = {}; q('#cpb-workflow-info').textContent = error.message; }
        q('#cpb-node-list')?.remove();
        const datalist = element('datalist'); datalist.id = 'cpb-node-list';
        for (const [id, node] of Object.entries(graph)) { const option = element('option'); option.value = id; option.label = `${node._meta?.title || node.class_type}`; datalist.append(option); }
        root.append(datalist);
        for (const button of q('#cpb-field-count').children) button.setAttribute('aria-pressed', String(Number(button.dataset.count) === settings.fieldCount));
        q('#cpb-fields').replaceChildren(); q('#cpb-alias-buttons').replaceChildren();
        settings.fields.slice(0, settings.fieldCount).forEach((field, index) => {
            const fieldset = element('fieldset', '', 'cpb-field'); fieldset.dataset.index = index;
            fieldset.append(element('legend', `Field ${index + 1}`));
            const aliasLabel = element('label', 'Alias (optional)');
            const alias = element('input'); alias.className = 'text_pole'; alias.value = field.alias; alias.placeholder = 'resolution_x'; alias.setAttribute('aria-label', `Field ${index + 1} alias`); aliasLabel.append(alias);
            alias.addEventListener('input', () => { field.alias = alias.value; save(); renderDockFields(); });
            alias.addEventListener('change', renderMappings);
            const valueLabel = element('label', 'Value');
            const value = element('textarea'); value.className = 'text_pole'; value.rows = 2; value.value = field.value; value.setAttribute('aria-label', `Field ${index + 1} value`); valueLabel.append(value);
            value.addEventListener('input', () => { field.value = value.value; save(); const other = dock.querySelector(`[data-field="${index}"] textarea`); if (other) other.value = value.value; });
            const typeLabel = element('label', 'Value type'); const type = element('select'); type.className = 'text_pole'; type.setAttribute('aria-label', `Field ${index + 1} value type`);
            for (const [key, name] of Object.entries({ auto: 'Auto (from workflow)', text: 'Text', integer: 'Integer', number: 'Number', boolean: 'Boolean' })) type.append(new Option(name, key));
            type.value = field.type; type.addEventListener('change', () => { field.type = type.value; save(); }); typeLabel.append(type);
            const showLabel = element('label', '', 'cpb-check'); const show = element('input'); show.type = 'checkbox'; show.checked = field.show; show.setAttribute('aria-label', `Field ${index + 1} show field`);
            show.addEventListener('change', () => { field.show = show.checked; save(); renderDockFields(); }); showLabel.append(show, document.createTextNode('Show field in left sidebar'));
            fieldset.append(aliasLabel, valueLabel, targetEditor(field, `Field ${index + 1}`), typeLabel, showLabel); q('#cpb-fields').append(fieldset);
            if (field.alias.trim()) {
                const button = element('button', `{{${field.alias.trim()}}}`, 'menu_button'); button.type = 'button';
                button.addEventListener('click', () => { const area = q('#cpb-instructions'); area.setRangeText(button.textContent, area.selectionStart, area.selectionEnd, 'end'); area.dispatchEvent(new Event('input')); area.focus(); });
                q('#cpb-alias-buttons').append(button);
            }
        });
        q('#cpb-prompt-target').replaceChildren(targetEditor(settings.prompt, 'Image prompt'));
        renderDockFields();
    }

    function renderPrePrompt() {
        dock.querySelector('#cpb-dock-pre-prompt-holder').hidden = !settings.showPrePrompt;
        dock.querySelector('#cpb-dock-pre-prompt').value = settings.prePrompt;
    }

    function renderDockFields() {
        const holder = dock.querySelector('#cpb-dock-fields'); holder.replaceChildren();
        settings.fields.slice(0, settings.fieldCount).forEach((field, index) => {
            if (!field.show) return;
            const label = element('label', field.alias.trim() || `Field ${index + 1}`, 'cpb-dock-field'); label.dataset.field = index;
            const value = element('textarea'); value.rows = 2; value.value = field.value; value.setAttribute('aria-label', `${field.alias.trim() || `Field ${index + 1}`} sidebar value`);
            value.addEventListener('input', () => { field.value = value.value; save(); const other = q(`.cpb-field[data-index="${index}"] textarea`); if (other) other.value = value.value; });
            label.append(value); holder.append(label);
        });
        renderPrePrompt();
    }

    function renderLayout() {
        dock.hidden = !settings.dockEnabled; toggle.hidden = !settings.dockEnabled;
        document.body.classList.toggle('cpb-layout', Boolean(settings.dockEnabled && settings.shiftChat));
        document.body.style.setProperty('--cpb-sidebar-width', `${Math.min(1200, Math.max(240, Number(settings.dockWidth) || 420))}px`);
        const scale = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
        document.body.style.setProperty('--cpb-chat-offset', `${Math.min(10000, Math.max(0, Number(settings.chatShiftPixels) || 0)) / scale}px`);
        sizeDock();
    }

    function showGallery() {
        const index = gallery.findIndex(item => item.url === selectedUrl);
        const item = gallery[index]; const image = dock.querySelector('#cpb-image'); const link = dock.querySelector('#cpb-image-link');
        image.hidden = !item; dock.querySelector('#cpb-empty-image').hidden = Boolean(item);
        if (item) { image.src = item.url; image.alt = item.prompt || 'Generated image'; link.href = item.url; } else { image.removeAttribute('src'); link.removeAttribute('href'); }
        dock.querySelector('#cpb-image-count').textContent = `${item ? index + 1 : 0} / ${gallery.length}`;
        dock.querySelector('#cpb-previous').disabled = index <= 0;
        dock.querySelector('#cpb-next').disabled = index < 0 || index >= gallery.length - 1;
        const configured = Boolean(String(settings.referenceNode || '').trim());
        const reference = configured ? referenceFromChat(context()) : null;
        const isReference = Boolean(item && reference?.url === item.url);
        const button = dock.querySelector('#cpb-reference');
        button.disabled = !item || !configured;
        button.setAttribute('aria-pressed', String(isReference));
        button.textContent = isReference ? 'Clear reference' : 'Use as reference';
        button.title = configured ? 'Toggle the reference image for the next generation. Gallery browsing does not change the reference.' : 'Set the Qwen 2.1 reference node ID in Extensions → ComfyUI API first.';
        image.classList.toggle('cpb-is-reference', isReference);
        const referenceStatus = dock.querySelector('#cpb-reference-status');
        referenceStatus.hidden = !configured;
        referenceStatus.textContent = reference ? `Reference: image ${gallery.findIndex(entry => entry.url === reference.url) + 1} of ${gallery.length}` : 'No reference image';
        dock.querySelector('#cpb-image-caption').textContent = item?.prompt || '';
        sizeImage();
    }
    function refreshGallery(preferLatest = false) {
        gallery = galleryFromChat(context().chat);
        if (preferLatest || !gallery.some(item => item.url === selectedUrl)) selectedUrl = gallery.at(-1)?.url || '';
        showGallery();
    }
    dock.querySelector('#cpb-previous').addEventListener('click', () => { const index = gallery.findIndex(item => item.url === selectedUrl); selectedUrl = gallery[Math.max(0, index - 1)]?.url || ''; showGallery(); });
    dock.querySelector('#cpb-next').addEventListener('click', () => { const index = gallery.findIndex(item => item.url === selectedUrl); selectedUrl = gallery[Math.min(gallery.length - 1, index + 1)]?.url || ''; showGallery(); });
    dock.querySelector('#cpb-reference').addEventListener('click', () => {
        const image = gallery.find(item => item.url === selectedUrl);
        if (image && String(settings.referenceNode || '').trim()) toggleReference(image);
    });
    for (const selector of ['#cpb-last']) q(selector).addEventListener('click', () => generate('last'));
    dock.querySelector('#cpb-dock-last').addEventListener('click', () => generate('last'));
    q('#cpb-generate').addEventListener('click', () => generate('scene'));
    q('#cpb-connect').addEventListener('click', connect);
    q('#cpb-preview').addEventListener('click', preview);
    q('#cpb-cancel').addEventListener('click', cancel); dock.querySelector('#cpb-dock-cancel').addEventListener('click', cancel);

    function setStatus(text, error = false) {
        for (const node of [q('#cpb-status'), dock.querySelector('#cpb-dock-status')]) { node.textContent = text; node.classList.toggle('cpb-error', error); }
    }
    function setBusy(busy) {
        for (const selector of ['#cpb-generate', '#cpb-last', '#cpb-connect']) q(selector).disabled = busy;
        dock.querySelector('#cpb-dock-last').disabled = busy;
        q('#cpb-cancel').disabled = !busy; dock.querySelector('#cpb-dock-cancel').hidden = !busy;
    }
    function showPreview(text) { q('#cpb-preview-text').textContent = text; q('#cpb-preview-panel').open = true; }
    function destroy() {
        observer.disconnect(); chatObserver.disconnect(); clearInterval(densityTimer); densityMedia.removeEventListener('change', densityChanged); window.removeEventListener('resize', renderLayout);
        root.remove(); dock.remove(); toggle.remove(); document.body.classList.remove('cpb-layout');
        for (const property of ['--cpb-sidebar-width', '--cpb-desktop-width', '--cpb-chat-offset']) document.body.style.removeProperty(property);
    }
    renderMappings(); renderLayout(); refreshGallery(true);
    return { root, dock, setStatus, setBusy, showPreview, refreshGallery, destroy };
}
