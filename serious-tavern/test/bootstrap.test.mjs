import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertSafeDataRoot,
  mergeRoleplaySettings,
  patchConfigText,
  settingsMatchPreset,
  validateLock
} from "../bootstrap-core.mjs";

const seriousRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = name => JSON.parse(fs.readFileSync(path.join(seriousRoot, name), "utf8"));

test("the curated extension pack is fully pinned", () => {
  const lock = validateLock(readJson("extensions.lock.json"));
  assert.deepEqual(lock.packs["roleplay-v1"], [
    "summaryception",
    "prompt-inspector",
    "world-info-info",
    "notebook",
    "timelines"
  ]);
});

test("roleplay settings preserve unrelated settings and secrets", () => {
  const preset = readJson("roleplay-settings.json");
  const original = {
    main_api: "openai",
    extension_settings: {
      apiKey: "preserve-me",
      disabledExtensions: ["unrelated-extension"],
      summaryception: {
        openaiKey: "also-preserve-me",
        savedCustomPrompts: { Existing: "keep" }
      }
    }
  };
  const merged = mergeRoleplaySettings(original, preset);
  assert.equal(merged.extension_settings.apiKey, "preserve-me");
  assert.equal(merged.extension_settings.summaryception.openaiKey, "also-preserve-me");
  assert.equal(merged.extension_settings.summaryception.savedCustomPrompts.Existing, "keep");
  assert.ok(merged.extension_settings.disabledExtensions.includes("unrelated-extension"));
  assert.ok(settingsMatchPreset(merged, preset));
  assert.equal(original.extension_settings.disabledExtensions.includes("memory"), false);
});

test("config patch disables both automatic update paths without flattening the file", () => {
  const source = "# retained\nextensions:\n  enabled: true\n  autoUpdate: true\nserver: value\nenableServerPluginsAutoUpdate: true\n";
  const patched = patchConfigText(source);
  assert.match(patched, /# retained/);
  assert.match(patched, /extensions:\n  enabled: true\n  autoUpdate: false/);
  assert.match(patched, /enableServerPluginsAutoUpdate: false/);
  assert.equal(patchConfigText(patched), patched);
});

test("broad data roots are rejected", () => {
  assert.throws(() => assertSafeDataRoot(""));
  assert.throws(() => assertSafeDataRoot(path.parse(process.cwd()).root));
  assert.equal(assertSafeDataRoot(path.join(process.cwd(), "profile-data")), path.resolve("profile-data"));
});
