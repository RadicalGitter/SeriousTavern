import assert from "node:assert/strict";
import test from "node:test";

import {
  RECOMMENDED_MUD_BACKGROUND,
  SEMANTIC_ACCENTS,
  SPEAKER_PALETTE,
  appearanceForSpeaker,
  createAdornmentPlan,
  createIdentityRegistry,
  displayTextFromPlan,
  hashSpeakerName,
  normalizeResolvedReferences,
  normalizeSpeakerName
} from "../../public/scripts/extensions/character-colors/adornment/index.js";

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function hslToRgb({ hue, saturation, lightness }) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const [r1, g1, b1] = sector < 1 ? [chroma, x, 0]
    : sector < 2 ? [x, chroma, 0]
      : sector < 3 ? [0, chroma, x]
        : sector < 4 ? [0, x, chroma]
          : sector < 5 ? [x, 0, chroma]
            : [chroma, 0, x];
  const m = l - chroma / 2;
  return [r1 + m, g1 + m, b1 + m].map(component => Math.round(component * 255));
}

function hexToRgb(hex) {
  return [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first, second) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

test("speaker identity normalization and palette selection are deterministic", () => {
  assert.equal(normalizeSpeakerName("  ASHA\tVÉL  "), normalizeSpeakerName("Asha Ve\u0301l"));
  assert.equal(normalizeSpeakerName("O’Rin"), normalizeSpeakerName("o'rin"));
  assert.equal(hashSpeakerName(" ASHA VÉL "), hashSpeakerName("asha ve\u0301l"));
  assert.deepEqual(appearanceForSpeaker("Asha Vél"), appearanceForSpeaker("  ASHA  VÉL "));
});

test("curated speaker pairs remain same-hue, visibly tiered, and legible on the MUD background", () => {
  const background = hexToRgb(RECOMMENDED_MUD_BACKGROUND);
  for (const palette of SPEAKER_PALETTE) {
    assert.equal(palette.quote.hue, palette.dialogue.hue);
    assert.ok(palette.quote.lightness >= palette.dialogue.lightness + 10);
    assert.ok(contrast(hslToRgb(palette.quote), background) >= 4.5, `${palette.id} quote contrast`);
    assert.ok(contrast(hslToRgb(palette.dialogue), background) >= 4.5, `${palette.id} dialogue contrast`);
  }
});

test("explicit speaker labels seed bright labels and quote marks with darker same-palette dialogue", () => {
  const source = "Asha Vél: “Stay close.” Then she adds, \"Now.\"";
  const plan = createAdornmentPlan(source);
  const label = plan.tokens.find(token => token.kind === "speaker-label");
  const quoteMarks = plan.tokens.filter(token => token.kind === "quote-mark");
  const dialogue = plan.tokens.filter(token => token.kind === "dialogue");

  assert.equal(plan.sourceText, source);
  assert.equal(displayTextFromPlan(plan), source);
  assert.equal(label.text, "Asha Vél");
  assert.equal(label.style.tone, "bright");
  assert.equal(quoteMarks.length, 4);
  assert.deepEqual(dialogue.map(token => token.text), ["Stay close.", "Now."]);
  assert.ok([...quoteMarks, ...dialogue].every(token => token.style.paletteId === label.style.paletteId));
  assert.ok(dialogue.every(token => token.style.color.lightness < label.style.color.lightness));
});

test("bracket labels and a caller-supplied default speaker color dialogue without changing text", () => {
  const labelled = createAdornmentPlan("[Darth Veyra]: \"Choose.\"");
  assert.equal(labelled.tokens.find(token => token.kind === "speaker-label")?.text, "[Darth Veyra]");
  assert.equal(displayTextFromPlan(labelled), labelled.sourceText);

  const unlabelled = createAdornmentPlan("She whispers, “Not yet.”", { defaultSpeaker: "Darth Veyra" });
  const dialogue = unlabelled.tokens.find(token => token.kind === "dialogue");
  assert.equal(dialogue.speaker, "darth veyra");
  assert.equal(dialogue.style.paletteId, appearanceForSpeaker("Darth Veyra").paletteId);
});

test("safe semantic markup produces bounded text tokens, preserves source, and never emits HTML", () => {
  const source = "A ⟦sp:notable|crystal <b>key</b>⟧ rests at ⟦sp:place|the gate⟧; ⟦sp:path-sith|unknown⟧.";
  const plan = createAdornmentPlan(source);
  const accents = plan.tokens.filter(token => token.kind === "accent");

  assert.deepEqual(accents.map(token => token.style.role), ["notable", "place"]);
  assert.equal(displayTextFromPlan(plan), "A crystal <b>key</b> rests at the gate; ⟦sp:path-sith|unknown⟧.");
  assert.equal(plan.sourceText, source);
  assert.ok(accents.every(token => SEMANTIC_ACCENTS[token.style.role]));
  assert.ok(plan.tokens.every(token => !("html" in token) && !("innerHTML" in token)));
});

test("speaker markup becomes same-palette dialogue only for an admitted identity", () => {
  const identities = [
    { name: "Kessa Vale", aliases: ["Kessa"], pronouns: ["she", "her"] }
  ];
  const source = "Kessa checks the hatch. ⟦sp:say|Kessa|Not yet. Give it a second.⟧";
  const plan = createAdornmentPlan(source, { identities });
  const marked = plan.tokens.find(token => token.kind === "marked-dialogue");

  assert.equal(marked.speaker, "kessa vale");
  assert.equal(marked.identity, "kessa vale");
  assert.equal(marked.text, "“Not yet. Give it a second.”");
  assert.equal(marked.style.paletteId, appearanceForSpeaker("Kessa Vale").paletteId);
  assert.equal(marked.style.quoteColor.hue, marked.style.color.hue);
  assert.ok(marked.style.quoteColor.lightness > marked.style.color.lightness);
  assert.equal(displayTextFromPlan(plan), "Kessa checks the hatch. “Not yet. Give it a second.”");

  const unknown = createAdornmentPlan("⟦sp:say|Locked Stranger|Hello.⟧", { identities });
  assert.equal(displayTextFromPlan(unknown), "⟦sp:say|Locked Stranger|Hello.⟧");
  assert.equal(unknown.tokens.some(token => token.kind === "marked-dialogue"), false);
});

test("multiple speaker wrappers preserve apostrophes and contract-compliant embedded quotations", () => {
  const identities = [
    { name: "Vara Neth", aliases: ["Vara"], pronouns: ["she", "her"] },
    { name: "Kessa Vale", aliases: ["Kessa"], pronouns: ["she", "her"] }
  ];
  const source = `⟦sp:say|Vara Neth|Reception is easier than search. Let the seeing be the seeing.⟧

From the other side of the table, Kessa makes a low sound. She does not look up.

⟦sp:say|Kessa Vale|She's giving you the whole lesson and you're still doing the 'Uh' thing. Just say 'thank you' and put the holopad back face-down.⟧`;
  const plan = createAdornmentPlan(source, { identities });
  const marked = plan.tokens.filter(token => token.kind === "marked-dialogue");

  assert.deepEqual(marked.map(token => token.identity), ["vara neth", "kessa vale"]);
  assert.deepEqual(marked.map(token => token.dialogueText), [
    "Reception is easier than search. Let the seeing be the seeing.",
    `She's giving you the whole lesson and you're still doing the 'Uh' thing. Just say 'thank you' and put the holopad back face-down.`
  ]);
  assert.equal(displayTextFromPlan(plan), `“Reception is easier than search. Let the seeing be the seeing.”

From the other side of the table, Kessa makes a low sound. She does not look up.

“She's giving you the whole lesson and you're still doing the 'Uh' thing. Just say 'thank you' and put the holopad back face-down.”`);
});

test("semantic accents are restrained by a hard display limit", () => {
  const source = Array.from({ length: 30 }, (_, index) => `⟦sp:notable|mark ${index}⟧`).join(" ");
  const plan = createAdornmentPlan(source, { accentLimit: 999 });
  assert.equal(plan.tokens.filter(token => token.kind === "accent").length, 24);
  assert.match(displayTextFromPlan(plan), /⟦sp:notable\|mark 24⟧/);
});

const IDENTITIES = [
  { name: "Asha Vél", aliases: ["Asha", "Master Vél"], pronouns: ["she", "her", "hers", "herself"] },
  { name: "Darth Veyra", aliases: ["Veyra"], pronouns: { subject: "she", object: "her", possessive: "hers" } },
  { name: "Orren Pell", aliases: ["Orren"], pronouns: "he/him/his/himself" }
];

test("registered names and aliases receive canonical identity colors in narration and dialogue labels", () => {
  const source = "Master Vél enters. Asha studies the door.\nAsha: \"It remembers me.\"";
  const plan = createAdornmentPlan(source, { identities: IDENTITIES });
  const mentions = plan.tokens.filter(token => token.kind === "identity-mention");
  const label = plan.tokens.find(token => token.kind === "speaker-label");

  assert.deepEqual(mentions.map(token => token.text), ["Master Vél", "Asha"]);
  assert.ok(mentions.every(token => token.identity === "asha vél"));
  assert.ok(mentions.every(token => token.style.paletteId === appearanceForSpeaker("Asha Vél").paletteId));
  assert.equal(label.identity, "asha vél");
  assert.equal(label.style.paletteId, appearanceForSpeaker("Asha Vél").paletteId);
  assert.equal(displayTextFromPlan(plan), source);
});

test("pronouns color only after a unique matching referent in the current line or paragraph", () => {
  const source = "Asha enters. She waits.\nOrren joins her. He bows.\n\nShe listens beyond the door.";
  const plan = createAdornmentPlan(source, { identities: IDENTITIES });
  const pronouns = plan.tokens.filter(token => token.kind === "identity-mention" && token.style.role === "identity-pronoun");

  assert.deepEqual(pronouns.map(token => [token.text, token.identity]), [
    ["She", "asha vél"],
    ["her", "asha vél"],
    ["He", "orren pell"]
  ]);
  const trailingShe = plan.tokens.find(token => token.kind === "text" && token.text.includes("She listens"));
  assert.ok(trailingShe, "a pronoun after a paragraph reset must remain plain");
});

test("matching pronouns remain plain when two explicit referents are plausible", () => {
  const source = "Asha greets Veyra. She watches the gate.";
  const plan = createAdornmentPlan(source, { identities: IDENTITIES });
  assert.equal(
    plan.tokens.some(token => token.kind === "identity-mention" && token.text === "She"),
    false
  );
  assert.ok(plan.tokens.some(token => token.kind === "text" && token.text.includes("She watches")));
});

test("unlabelled prose dialogue inherits a unique current referent's canonical palette", () => {
  const source = "Asha watches the hatch. “Not yet.”";
  const plan = createAdornmentPlan(source, { identities: IDENTITIES });
  const dialogueTokens = plan.tokens.filter(token => token.kind === "quote-mark" || token.kind === "dialogue");

  assert.equal(dialogueTokens.length, 3);
  assert.ok(dialogueTokens.every(token => token.speaker === "asha vél"));
  assert.ok(dialogueTokens.every(token => token.identity === "asha vél"));
  assert.ok(dialogueTokens.every(token => token.attribution === "prose-referent"));
  assert.ok(dialogueTokens.every(token => token.style.paletteId === appearanceForSpeaker("Asha Vél").paletteId));
  assert.equal(displayTextFromPlan(plan), source);
});

test("unlabelled prose dialogue stays generic when multiple current referents are plausible", () => {
  const source = "Asha and Veyra watch the hatch. “Not yet.”";
  const plan = createAdornmentPlan(source, { identities: IDENTITIES });
  const dialogueTokens = plan.tokens.filter(token => token.kind === "quote-mark" || token.kind === "dialogue");

  assert.equal(dialogueTokens.length, 3);
  assert.ok(dialogueTokens.every(token => token.speaker === null));
  assert.ok(dialogueTokens.every(token => !("identity" in token)));
  assert.ok(dialogueTokens.every(token => !("attribution" in token)));
  assert.equal(displayTextFromPlan(plan), source);
});

test("the authored Old Republic greeting attributes each quotation to its written speaker", () => {
  const identities = [
    { name: "Kessa Vale", aliases: ["Kessa", "Kess"], pronouns: ["she", "her", "hers", "herself"] },
    { name: "Vara Neth", aliases: ["Vara"], pronouns: ["she", "her", "hers", "herself"] },
    { name: "Tala Ruun", aliases: ["Tala"], pronouns: ["she", "her", "hers", "herself"] }
  ];
  const source = "Vara's delayed transmission changes from HELD to SENT, with one question for Tala Ruun. Kessa watches the indicator disappear, then settles the evidence slate against her chest. “So that's it,” she says. “We have escaped under false names. Very respectable.” Vara stands beside the cabin door. “Respectability was not among the documents we forged.”\n\nThree days remain. Vara hides a washer beneath one cup while Kessa turns your chair away. “Your instincts have saved lives,” Vara says, “but warning, fear, and desire can all arrive wearing the same face.” Kessa produces two ration sweets. “One says the first attempt works.” Vara folds her arms. “Begin when you are ready.”";
  const plan = createAdornmentPlan(source, { identities });
  const dialogue = plan.tokens.filter(token => token.kind === "dialogue");

  assert.deepEqual(dialogue.map(token => token.speaker), [
    "kessa vale",
    "kessa vale",
    "vara neth",
    "vara neth",
    "vara neth",
    "kessa vale",
    "vara neth"
  ]);
  assert.ok(dialogue.every(token => token.identity === token.speaker));
  assert.equal(displayTextFromPlan(plan), source);

  const pronouns = plan.tokens.filter(token => token.kind === "identity-mention" && token.style.role === "identity-pronoun");
  assert.deepEqual(pronouns.map(token => [token.text, token.identity]), [
    ["her", "kessa vale"],
    ["she", "kessa vale"],
    ["her", "vara neth"]
  ]);
});

test("exact resolver spans share the identity-token contract without requiring visible antecedents", () => {
  const source = "A cloaked figure watches. They do not move.";
  const start = source.indexOf("They");
  const identities = createIdentityRegistry([
    { name: "Kei Ardan", aliases: ["Kei"], pronouns: ["they", "them", "their"] }
  ]);
  const resolvedReferences = normalizeResolvedReferences(source, [
    { start, end: start + 4, identity: "Kei", kind: "pronoun" }
  ], identities);
  const plan = createAdornmentPlan(source, { identities, resolvedReferences });
  const resolved = plan.tokens.find(token => token.resolution === "resolver-span");

  assert.equal(resolved.text, "They");
  assert.equal(resolved.identity, "kei ardan");
  assert.equal(resolved.style.role, "identity-pronoun");
  assert.equal(plan.sourceText, source);
  assert.equal(displayTextFromPlan(plan), source);
  assert.ok(Object.isFrozen(resolvedReferences));
});

test("identity and resolver inputs are bounded and fail closed", () => {
  const tooMany = Array.from({ length: 49 }, (_, index) => ({ name: `Person ${index}` }));
  assert.throws(() => createIdentityRegistry(tooMany), /at most 48/);

  const source = "Asha waits.";
  assert.throws(
    () => createAdornmentPlan(source, {
      identities: IDENTITIES,
      resolvedReferences: [{ start: 0, end: 4, identity: "Unknown", kind: "name" }]
    }),
    /unknown or ambiguous identity/
  );
  assert.throws(
    () => normalizeResolvedReferences(source, [
      { start: 0, end: 4, identity: "Asha", kind: "name" },
      { start: 2, end: 6, identity: "Asha", kind: "name" }
    ], IDENTITIES),
    /must not overlap/
  );
});

test("plans are immutable and idempotent while unmatched quotes remain ordinary text", () => {
  const source = "Asha: “This quote never closes";
  const plan = createAdornmentPlan(source);
  assert.strictEqual(createAdornmentPlan(plan), plan);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.tokens));
  assert.ok(plan.tokens.every(Object.isFrozen));
  assert.equal(plan.tokens.some(token => token.kind === "dialogue"), false);
  assert.equal(displayTextFromPlan(plan), source);
});
