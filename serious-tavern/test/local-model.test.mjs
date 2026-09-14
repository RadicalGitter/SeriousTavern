import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { mergeRoleplaySettings } from "../bootstrap-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const preset = JSON.parse(read("default/content/presets/openai/SeriousTavern - Serenity llama.cpp.json"));

test("native preset is discoverable and retains the platform's card, lore and history markers", () => {
  const index = JSON.parse(read("default/content/index.json"));
  assert.equal(index.filter(entry => entry.filename === "presets/openai/SeriousTavern - Serenity llama.cpp.json" && entry.type === "openai_preset").length, 1);
  for (const id of ["main", "charDescription", "charPersonality", "scenario", "worldInfoBefore", "worldInfoAfter", "chatHistory"]) {
    assert.ok(preset.prompts.some(prompt => prompt.identifier === id));
    assert.ok(preset.prompt_order.every(group => group.order.some(prompt => prompt.identifier === id && prompt.enabled)));
  }
  assert.equal(preset.custom_prompt_post_processing, "");
  assert.equal(preset.tool_reasoning_mode, "disabled");
});

test("the real prompt reasoning inserter omits historical thoughts under prepared settings", () => {
  const source = read("public/scripts/reasoning.js");
  const code = source.match(/export (class PromptReasoning \{[^]*?\n})/)?.[1];
  assert.ok(code);
  const current = { power_user: { reasoning: { add_to_prompts: true, max_additions: 8, prefix: "<think>", suffix: "</think>", separator: "\n" } } };
  const prepared = mergeRoleplaySettings(current, JSON.parse(read("serious-tavern/roleplay-settings.json")));
  const create = power => new Function("power_user", "substituteParams", `${code}\nreturn new PromptReasoning();`)(power, value => value);
  assert.match(create(current.power_user).addToMessage("Visible reply.", "Private deliberation.", false), /Private deliberation/);
  const reasoning = create(prepared.power_user);
  assert.equal(reasoning.isLimitReached(), true);
  assert.equal(reasoning.addToMessage("Visible reply.", "Private deliberation.", false), "Visible reply.");
});

test("the native budget reserves generation space within the provisional context", () => {
  const source = read("public/scripts/openai.js");
  const method = source.match(/    setTokenBudget\(context, response\) \{[^]*?\n    }/)?.[0];
  assert.ok(method);
  const budget = new Function(`return { log() {}, ${method} };`)();
  budget.setTokenBudget(preset.openai_max_context, preset.openai_max_tokens);
  assert.equal(budget.tokenBudget, 119808);
  assert.ok(preset.openai_max_tokens > 0 && preset.openai_max_tokens < preset.openai_max_context);
});
