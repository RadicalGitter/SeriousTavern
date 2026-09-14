import { eventSource, event_types, saveSettingsDebounced } from '../../../script.js';
import { extension_settings, getContext } from '../../extensions.js';
import { createIdentityRegistry, normalizeSpeakerName } from './adornment/index.js';
import { parseIdentityLines, formatIdentityLines } from './adornment/identity-lines.js';
import { renderColors, clearColors } from './renderer.js';

const key = 'characterColors';
let initialized = false;

function settings() {
    return extension_settings[key] || { enabled: true, identities: [] };
}

function registryForMessage(messageId) {
    const entries = [...(settings().identities || [])];
    const name = getContext().chat?.[messageId]?.name;
    const claimed = entries.flatMap(entry => [entry.name, ...(entry.aliases || [])]).map(normalizeSpeakerName);
    if (typeof name === 'string' && name.trim() && !claimed.includes(normalizeSpeakerName(name))) {
        entries.push({ name, aliases: [], pronouns: [] });
    }
    return createIdentityRegistry(entries);
}

function renderMessage(messageId) {
    const id = Number(messageId);
    if (!Number.isInteger(id) || id < 0) return;
    // Leave the legacy visual renderer in charge if explicitly enabled in this chat.
    const legacy = getContext().chatMetadata?.semanticPlay?.adornment;
    if (legacy?.enabled && legacy.intensity !== 'off') return;
    if (settings().enabled === false) return;
    const container = document.querySelector(`#chat > .mes[mesid="${id}"] > .mes_block > .mes_text`);
    try {
        renderColors(container, registryForMessage(id));
    } catch (error) {
        console.warn('Character Colors left the message unchanged:', error);
    }
}

function refresh() {
    for (const container of document.querySelectorAll('#chat > .mes > .mes_block > .mes_text')) clearColors(container);
    document.querySelectorAll('#chat > .mes[mesid]').forEach(message => renderMessage(message.getAttribute('mesid')));
}

function mountSettings() {
    const host = document.getElementById('extensions_settings');
    if (!host || document.getElementById('character-colors-settings')) return;
    const panel = document.createElement('details');
    panel.id = 'character-colors-settings';
    panel.innerHTML = `<summary>Character Colors</summary>
        <label><input type="checkbox" class="cc-enabled"> Color character dialogue</label>
        <p>Colors come from each name. No color assignments or extra model instructions are needed.</p>
        <label>Optional identities and aliases
            <textarea class="text_pole cc-identities" rows="4" placeholder="Mara | she/her | Captain Mara"></textarea>
        </label>
        <p>One line per character: Name | pronouns | aliases. This connects aliases and highlights known names; it does not establish story facts.</p>
        <button type="button" class="menu_button cc-save">Save identities</button>
        <span class="cc-status" role="status"></span>`;
    const enabled = panel.querySelector('.cc-enabled');
    const identities = panel.querySelector('.cc-identities');
    const status = panel.querySelector('.cc-status');
    enabled.checked = settings().enabled !== false;
    try {
        identities.value = formatIdentityLines(settings().identities || []);
    } catch {
        status.textContent = 'Stored identities are invalid. Re-enter them to replace the visual settings.';
    }
    enabled.addEventListener('change', () => {
        extension_settings[key] = { ...settings(), enabled: enabled.checked };
        saveSettingsDebounced();
        refresh();
    });
    panel.querySelector('.cc-save').addEventListener('click', () => {
        try {
            const registry = parseIdentityLines(identities.value);
            const entries = registry.identities.map(({ name, aliases, pronouns }) => ({ name, aliases, pronouns }));
            extension_settings[key] = { ...settings(), identities: entries };
            saveSettingsDebounced();
            identities.value = formatIdentityLines(entries);
            status.textContent = 'Saved.';
            refresh();
        } catch (error) {
            status.textContent = error.message;
        }
    });
    host.append(panel);
}

export function init() {
    if (initialized) return;
    initialized = true;
    for (const type of [event_types.CHARACTER_MESSAGE_RENDERED, event_types.USER_MESSAGE_RENDERED,
        event_types.MESSAGE_UPDATED, event_types.MESSAGE_SWIPED]) {
        eventSource.makeLast(type, renderMessage);
    }
    for (const type of [event_types.CHAT_CHANGED, event_types.MORE_MESSAGES_LOADED, event_types.APP_READY]) {
        eventSource.makeLast(type, () => { mountSettings(); refresh(); });
    }
    mountSettings();
    refresh();
}
