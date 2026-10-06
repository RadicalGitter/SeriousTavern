import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parse } from 'espree';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const extensionRoot = path.join(root, 'public/scripts/extensions/swipe-pregen');

test('fresh-profile discovery includes the bundled extension without an external install', () => {
    const cache = path.join(root, 'cache');
    fs.mkdirSync(cache, { recursive: true });
    const fixtureRoot = fs.mkdtempSync(path.join(cache, 'swipe-pregen-'));
    try {
        const userExtensions = path.join(fixtureRoot, 'user');
        const globalExtensions = path.join(fixtureRoot, 'global');
        fs.mkdirSync(userExtensions);
        fs.mkdirSync(globalExtensions);
        const routes = new Map();
        const router = { get: (route, handler) => routes.set(route, handler), post() {}, use() {} };
        const endpointSource = fs.readFileSync(path.join(root, 'src/endpoints/extensions.js'), 'utf8');
        // Run the real endpoint's registration and discovery handler without a server.
        vm.runInNewContext(endpointSource.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''), {
            fs, path, console: { debug() {}, log() {}, warn() {}, error() {} },
            express: { Router: () => router }, getConfigValue: (_, fallback) => fallback,
            PUBLIC_DIRECTORIES: { extensions: path.join(root, 'public/scripts/extensions'), globalExtensions },
        });
        let discovered;
        routes.get('/discover')({ user: { directories: { extensions: userExtensions }, profile: { handle: 'fixture' } } }, {
            send: value => { discovered = value; },
        });
        assert.ok(discovered.some(entry => entry.name === 'swipe-pregen' && entry.type === 'system'));
        const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
        assert.equal(manifest.hooks.activate, 'init');
        assert.equal(manifest.auto_update, false);
        assert.deepEqual(manifest.requires, []);
        const defaults = JSON.parse(fs.readFileSync(path.join(root, 'default/content/settings.json'), 'utf8'));
        assert.ok(!defaults.extension_settings.disabledExtensions.includes('swipe-pregen'));
    } finally {
        if (!path.resolve(fixtureRoot).startsWith(path.resolve(cache) + path.sep)) throw new Error('Unsafe fixture cleanup');
        fs.rmSync(fixtureRoot, { recursive: true });
    }
});

test('bundled module imports resolve to exports from the installed core', () => {
    const ast = file => parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
    function exportedNames(file) {
        const names = new Set();
        for (const node of ast(file).body) {
            if (node.type !== 'ExportNamedDeclaration') continue;
            for (const specifier of node.specifiers || []) names.add(specifier.exported.name);
            const declaration = node.declaration;
            if (declaration?.id) names.add(declaration.id.name);
            for (const item of declaration?.declarations || []) if (item.id.type === 'Identifier') names.add(item.id.name);
        }
        return names;
    }
    for (const node of ast(path.join(extensionRoot, 'index.js')).body) {
        if (node.type !== 'ImportDeclaration') continue;
        const dependency = path.resolve(extensionRoot, node.source.value);
        const names = exportedNames(dependency);
        for (const specifier of node.specifiers) assert.ok(names.has(specifier.imported.name), `${specifier.imported.name} missing from ${dependency}`);
    }
    assert.ok(exportedNames(path.join(extensionRoot, 'index.js')).has('init'));
});
