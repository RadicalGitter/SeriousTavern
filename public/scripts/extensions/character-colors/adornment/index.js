/**
 * Display-only, framework-neutral MUD adornment primitives.
 *
 * This module never mutates transcript text and never emits HTML or ANSI escape
 * sequences. Renderers receive bounded styled runs and must place `token.text`
 * through a text-safe API such as `textContent`.
 */

export const ADORNMENT_SCHEMA = "semantic-play.adornment-plan/v1";
export const IDENTITY_REGISTRY_SCHEMA = "semantic-play.identity-registry/v1";
export const RESOLVED_REFERENCES_SCHEMA = "semantic-play.resolved-references/v1";
export const RECOMMENDED_MUD_BACKGROUND = "#10131a";

const freezeColor = (hue, saturation, lightness, ansi256) => Object.freeze({
  hue,
  saturation,
  lightness,
  css: `hsl(${hue} ${saturation}% ${lightness}%)`,
  ansi256
});

const paletteEntry = (id, hue, saturation, quoteLightness, dialogueLightness, quoteAnsi, dialogueAnsi) => Object.freeze({
  id,
  quote: freezeColor(hue, saturation, quoteLightness, quoteAnsi),
  dialogue: freezeColor(hue, saturation, dialogueLightness, dialogueAnsi)
});

/**
 * Curated for legibility on RECOMMENDED_MUD_BACKGROUND. Every pair keeps one
 * hue: punctuation/labels use the bright member and dialogue uses the slightly
 * darker member.
 */
export const SPEAKER_PALETTE = Object.freeze([
  paletteEntry("qud-cyan", 190, 92, 82, 57, 159, 45),
  paletteEntry("verdigris", 165, 70, 80, 53, 158, 79),
  paletteEntry("salt-green", 135, 70, 81, 54, 157, 78),
  paletteEntry("sun-gold", 43, 92, 81, 54, 229, 179),
  paletteEntry("ember-orange", 25, 91, 82, 57, 223, 173),
  paletteEntry("rose-glass", 350, 90, 85, 60, 218, 211),
  paletteEntry("orchid", 315, 75, 84, 58, 219, 176),
  paletteEntry("amethyst", 265, 78, 86, 65, 189, 141),
  paletteEntry("ion-blue", 215, 90, 84, 59, 153, 75)
]);

const accentEntry = (id, hue, saturation, lightness, ansi256, emphasis = "normal") => Object.freeze({
  id,
  color: freezeColor(hue, saturation, lightness, ansi256),
  emphasis
});

/**
 * Safe semantic vocabulary for optional Qud-like `⟦sp:kind|text⟧` markup.
 * It intentionally contains presentation categories, not story-state values.
 */
export const SEMANTIC_ACCENTS = Object.freeze({
  notable: accentEntry("notable", 43, 92, 72, 220, "strong"),
  mystic: accentEntry("mystic", 265, 78, 76, 147),
  danger: accentEntry("danger", 5, 88, 72, 210, "strong"),
  item: accentEntry("item", 190, 82, 70, 80),
  place: accentEntry("place", 165, 65, 69, 79),
  system: accentEntry("system", 215, 22, 72, 110)
});

const DEFAULT_ACCENT_LIMIT = 12;
const HARD_ACCENT_LIMIT = 24;
const MAX_ACCENT_TEXT = 160;
const MAX_MARKED_DIALOGUE = 1800;
const MAX_MARKED_DIALOGUES = 48;
const MAX_IDENTITIES = 48;
const MAX_ALIASES_PER_IDENTITY = 12;
const MAX_PRONOUNS_PER_IDENTITY = 16;
const MAX_IDENTITY_NAME = 64;
const MAX_PRONOUN_LENGTH = 32;
const MAX_RESOLVED_REFERENCES = 128;
const MAX_RESOLVED_REFERENCE_LENGTH = 160;
const UNATTRIBUTED_SPEAKER_SEED = "unattributed dialogue";
const SPEAKER_LABEL = /^(\s*)(?:\[([^\]\r\n]{1,64})\]|([\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}\p{Pc}.'’\- ]{0,63}?))(\s*(?::|—)\s*)(?=["“])/u;
const SEMANTIC_MARKUP = /⟦sp:([a-z][a-z0-9-]{0,23})\|([^⟦⟧\r\n]{1,2000})⟧/gu;
const RAW_SEMANTIC_MARKUP = /⟦[^⟦⟧\r\n]{1,240}⟧/gu;
const REFERENCE_WORD = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;
const PARAGRAPH_BREAK = /(?:\r\n|\r|\n)[\t ]*(?:\r\n|\r|\n)/u;
const SENTENCE_BREAK = /[.!?](?:["'’”)\]]+)?(?:[ \t]+|$)/gu;
const SPEECH_VERB = /\b(?:adds?|answers?|asks?|begins?|calls?|continues?|cries?|demands?|murmurs?|replies?|responds?|says?|shouts?|speaks?|whispers?|yells?)\b/iu;
const ATTRIBUTION_WINDOW = 180;

export function normalizeSpeakerName(name) {
  const normalized = String(name ?? "")
    .normalize("NFKC")
    .replace(/[‘’ʻʼ]/gu, "'")
    .replace(/[‐‑‒–—―]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en-US");
  return normalized || "anonymous";
}

/** Stable FNV-1a hash of the normalized name. */
export function hashSpeakerName(name) {
  const normalized = normalizeSpeakerName(name);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function appearanceForSpeaker(name) {
  const normalizedName = normalizeSpeakerName(name);
  const hash = hashSpeakerName(normalizedName);
  const paletteIndex = hash % SPEAKER_PALETTE.length;
  const palette = SPEAKER_PALETTE[paletteIndex];
  return Object.freeze({
    normalizedName,
    hash,
    paletteIndex,
    paletteId: palette.id,
    quote: palette.quote,
    dialogue: palette.dialogue
  });
}

function displayIdentityName(value, field) {
  if (typeof value !== "string") throw new TypeError(`${field} must be a string.`);
  const name = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!name || name.length > MAX_IDENTITY_NAME) {
    throw new RangeError(`${field} must contain 1-${MAX_IDENTITY_NAME} characters.`);
  }
  return name;
}

function collectPronounValues(value, output = []) {
  if (typeof value === "string") {
    output.push(...value.split(/[\s/,]+/gu));
  } else if (Array.isArray(value)) {
    for (const item of value) collectPronounValues(item, output);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectPronounValues(item, output);
  } else if (value !== undefined && value !== null) {
    throw new TypeError("Identity pronouns must be strings, arrays, or an object of string forms.");
  }
  return output;
}

function normalizePronoun(value) {
  const pronoun = normalizedReferenceWord(value);
  if (!pronoun) return null;
  if (pronoun.length > MAX_PRONOUN_LENGTH || !/^[\p{L}\p{M}]+(?:['\-][\p{L}\p{M}]+)*$/u.test(pronoun)) {
    throw new RangeError(`Pronoun forms must be single words no longer than ${MAX_PRONOUN_LENGTH} characters.`);
  }
  return pronoun;
}

function normalizedReferenceWord(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[‘’ʻʼ]/gu, "'")
    .replace(/[‐‑‒–—―]/gu, "-")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function isIdentityRegistry(value) {
  return Boolean(
    value
    && typeof value === "object"
    && value.schema === IDENTITY_REGISTRY_SCHEMA
    && Array.isArray(value.identities)
  );
}

/**
 * Creates a bounded, serializable identity registry. It contains only public
 * display identity and grammatical forms; no relationship or story state.
 */
export function createIdentityRegistry(entries = []) {
  if (isIdentityRegistry(entries)) return entries;
  if (!Array.isArray(entries)) throw new TypeError("Identity registry input must be an array.");
  if (entries.length > MAX_IDENTITIES) throw new RangeError(`Identity registry supports at most ${MAX_IDENTITIES} identities.`);

  const seenIds = new Set();
  const identities = entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError(`Identity at index ${index} must be an object.`);
    }
    const name = displayIdentityName(entry.name, `Identity ${index} name`);
    const id = normalizeSpeakerName(name);
    if (seenIds.has(id)) throw new RangeError(`Duplicate identity name: ${name}.`);
    seenIds.add(id);

    const rawAliases = entry.aliases === undefined ? [] : entry.aliases;
    if (!Array.isArray(rawAliases)) throw new TypeError(`Aliases for ${name} must be an array.`);
    if (rawAliases.length > MAX_ALIASES_PER_IDENTITY) {
      throw new RangeError(`${name} has more than ${MAX_ALIASES_PER_IDENTITY} aliases.`);
    }
    const aliases = [];
    const seenAliases = new Set([id]);
    for (let aliasIndex = 0; aliasIndex < rawAliases.length; aliasIndex += 1) {
      const alias = displayIdentityName(rawAliases[aliasIndex], `${name} alias ${aliasIndex}`);
      const normalizedAlias = normalizeSpeakerName(alias);
      if (!seenAliases.has(normalizedAlias)) aliases.push(alias);
      seenAliases.add(normalizedAlias);
    }

    const pronouns = [...new Set(collectPronounValues(entry.pronouns).map(normalizePronoun).filter(Boolean))];
    if (pronouns.length > MAX_PRONOUNS_PER_IDENTITY) {
      throw new RangeError(`${name} has more than ${MAX_PRONOUNS_PER_IDENTITY} pronoun forms.`);
    }

    Object.freeze(aliases);
    Object.freeze(pronouns);
    return Object.freeze({ id, name, aliases, pronouns });
  });
  Object.freeze(identities);
  return Object.freeze({ schema: IDENTITY_REGISTRY_SCHEMA, identities });
}

function identityContext(registryInput) {
  const registry = createIdentityRegistry(registryInput);
  const identityById = new Map();
  const aliasClaims = new Map();
  const pronounForms = new Set();
  for (const identity of registry.identities) {
    identityById.set(identity.id, identity);
    for (const reference of [identity.name, ...identity.aliases]) {
      const normalized = normalizeSpeakerName(reference);
      const claims = aliasClaims.get(normalized) ?? [];
      claims.push(identity);
      aliasClaims.set(normalized, claims);
    }
    for (const pronoun of identity.pronouns) pronounForms.add(pronoun);
  }
  return { registry, identityById, aliasClaims, pronounForms };
}

function uniqueIdentityForReference(context, reference) {
  const normalized = normalizeSpeakerName(reference);
  const direct = context.identityById.get(normalized);
  if (direct) return direct;
  const claims = context.aliasClaims.get(normalized) ?? [];
  return claims.length === 1 ? claims[0] : null;
}

/**
 * Validates exact source spans supplied by a future local resolver. These spans
 * are presentation hints only; the resolver remains outside this deterministic
 * renderer contract.
 */
export function normalizeResolvedReferences(sourceText, spans = [], identities = []) {
  if (typeof sourceText !== "string") throw new TypeError("Resolved-reference source must be text.");
  if (!Array.isArray(spans)) throw new TypeError("Resolved references must be an array.");
  if (spans.length > MAX_RESOLVED_REFERENCES) {
    throw new RangeError(`At most ${MAX_RESOLVED_REFERENCES} resolved references are accepted.`);
  }
  const context = identityContext(identities);
  const normalized = spans.map((span, index) => {
    if (!span || typeof span !== "object" || Array.isArray(span)) {
      throw new TypeError(`Resolved reference ${index} must be an object.`);
    }
    const start = Number(span.start);
    const end = Number(span.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > sourceText.length) {
      throw new RangeError(`Resolved reference ${index} has an invalid source range.`);
    }
    if (end - start > MAX_RESOLVED_REFERENCE_LENGTH || /[\r\n]/u.test(sourceText.slice(start, end))) {
      throw new RangeError(`Resolved reference ${index} is too long or crosses a line boundary.`);
    }
    const identity = uniqueIdentityForReference(context, span.identity);
    if (!identity) throw new RangeError(`Resolved reference ${index} names an unknown or ambiguous identity.`);
    const kind = span.kind ?? "reference";
    if (!new Set(["name", "pronoun", "reference"]).has(kind)) {
      throw new RangeError(`Resolved reference ${index} has an unsupported kind.`);
    }
    return { start, end, identityId: identity.id, kind };
  }).sort((first, second) => first.start - second.start || first.end - second.end);

  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].start < normalized[index - 1].end) {
      throw new RangeError("Resolved reference spans must not overlap.");
    }
  }
  for (const span of normalized) Object.freeze(span);
  return Object.freeze({ schema: RESOLVED_REFERENCES_SCHEMA, spans: Object.freeze(normalized) });
}

export function isResolvedReferences(value) {
  return Boolean(
    value
    && typeof value === "object"
    && value.schema === RESOLVED_REFERENCES_SCHEMA
    && Array.isArray(value.spans)
  );
}

export function isAdornmentPlan(value) {
  return Boolean(
    value
    && typeof value === "object"
    && value.schema === ADORNMENT_SCHEMA
    && typeof value.sourceText === "string"
    && Array.isArray(value.tokens)
  );
}

function clampAccentLimit(value) {
  if (value === undefined) return DEFAULT_ACCENT_LIMIT;
  const integer = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : DEFAULT_ACCENT_LIMIT;
  return Math.max(0, Math.min(HARD_ACCENT_LIMIT, integer));
}

function plainToken(text, sourceStart, sourceEnd) {
  return { kind: "text", text, sourceStart, sourceEnd };
}

function pushPlain(tokens, text, sourceStart, sourceEnd) {
  if (!text) return;
  const previous = tokens[tokens.length - 1];
  if (previous?.kind === "text" && previous.sourceEnd === sourceStart) {
    previous.text += text;
    previous.sourceEnd = sourceEnd;
    return;
  }
  tokens.push(plainToken(text, sourceStart, sourceEnd));
}

function speakerStyle(appearance, role, tone) {
  const color = tone === "bright" ? appearance.quote : appearance.dialogue;
  return {
    family: "speaker",
    role,
    tone,
    paletteId: appearance.paletteId,
    color
  };
}

function markedDialogueStyle(appearance) {
  return {
    family: "speaker",
    role: "marked-dialogue",
    tone: "body",
    paletteId: appearance.paletteId,
    color: appearance.dialogue,
    quoteColor: appearance.quote
  };
}

function pushSemanticText(tokens, text, absoluteStart, context) {
  SEMANTIC_MARKUP.lastIndex = 0;
  let consumed = 0;
  let match;
  while ((match = SEMANTIC_MARKUP.exec(text)) !== null) {
    const [sourceMarkup, accentId, visibleText] = match;
    const accent = SEMANTIC_ACCENTS[accentId];
    if (accentId === "say") {
      const separator = visibleText.indexOf("|");
      const speakerName = separator >= 0 ? visibleText.slice(0, separator).trim() : "";
      const dialogueText = separator >= 0 ? visibleText.slice(separator + 1).trim() : "";
      if (
        !speakerName
        || speakerName.length > MAX_IDENTITY_NAME
        || !dialogueText
        || dialogueText.length > MAX_MARKED_DIALOGUE
        || context.speechCount >= MAX_MARKED_DIALOGUES
      ) continue;
      pushPlain(tokens, text.slice(consumed, match.index), absoluteStart + consumed, absoluteStart + match.index);
      const appearance = appearanceForSpeaker(speakerName);
      tokens.push({
        kind: "marked-dialogue",
        text: `“${dialogueText}”`,
        dialogueText,
        rawText: sourceMarkup,
        sourceStart: absoluteStart + match.index,
        sourceEnd: absoluteStart + match.index + sourceMarkup.length,
        speaker: speakerName,
        style: markedDialogueStyle(appearance)
      });
      context.speechCount += 1;
      consumed = match.index + sourceMarkup.length;
      continue;
    }
    if (!accent || context.accentCount >= context.accentLimit || visibleText.length > MAX_ACCENT_TEXT) continue;

    pushPlain(tokens, text.slice(consumed, match.index), absoluteStart + consumed, absoluteStart + match.index);
    tokens.push({
      kind: "accent",
      text: visibleText,
      sourceStart: absoluteStart + match.index,
      sourceEnd: absoluteStart + match.index + sourceMarkup.length,
      style: {
        family: "semantic-accent",
        role: accent.id,
        tone: "accent",
        color: accent.color,
        emphasis: accent.emphasis
      }
    });
    context.accentCount += 1;
    consumed = match.index + sourceMarkup.length;
  }
  pushPlain(tokens, text.slice(consumed), absoluteStart + consumed, absoluteStart + text.length);
}

function isEscaped(text, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function nextOpeningQuote(text, start) {
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "“") return { index, close: "”" };
    if (text[index] === '"' && !isEscaped(text, index)) return { index, close: '"' };
  }
  return null;
}

function closingQuoteIndex(text, opening) {
  for (let index = opening.index + 1; index < text.length; index += 1) {
    if (text[index] !== opening.close) continue;
    if (opening.close === '"' && isEscaped(text, index)) continue;
    return index;
  }
  return -1;
}

function pushDialogueText(tokens, text, absoluteStart, speakerName, context) {
  const seed = speakerName || UNATTRIBUTED_SPEAKER_SEED;
  const appearance = appearanceForSpeaker(seed);
  const normalizedSpeaker = speakerName ? appearance.normalizedName : null;
  let consumed = 0;

  while (consumed < text.length) {
    const opening = nextOpeningQuote(text, consumed);
    if (!opening) break;
    const closing = closingQuoteIndex(text, opening);
    if (closing < 0) break;

    pushSemanticText(tokens, text.slice(consumed, opening.index), absoluteStart + consumed, context);
    tokens.push({
      kind: "quote-mark",
      text: text[opening.index],
      sourceStart: absoluteStart + opening.index,
      sourceEnd: absoluteStart + opening.index + 1,
      speaker: normalizedSpeaker,
      style: speakerStyle(appearance, "dialogue-quote", "bright")
    });
    if (closing > opening.index + 1) {
      tokens.push({
        kind: "dialogue",
        text: text.slice(opening.index + 1, closing),
        sourceStart: absoluteStart + opening.index + 1,
        sourceEnd: absoluteStart + closing,
        speaker: normalizedSpeaker,
        style: speakerStyle(appearance, "dialogue", "body")
      });
    }
    tokens.push({
      kind: "quote-mark",
      text: text[closing],
      sourceStart: absoluteStart + closing,
      sourceEnd: absoluteStart + closing + 1,
      speaker: normalizedSpeaker,
      style: speakerStyle(appearance, "dialogue-quote", "bright")
    });
    consumed = closing + 1;
  }

  pushSemanticText(tokens, text.slice(consumed), absoluteStart + consumed, context);
}

function pushMarkupAwareDialogue(tokens, text, absoluteStart, speakerName, context) {
  let consumed = 0;
  const matches = text.matchAll(new RegExp(SEMANTIC_MARKUP.source, SEMANTIC_MARKUP.flags));
  for (const match of matches) {
    pushDialogueText(tokens, text.slice(consumed, match.index), absoluteStart + consumed, speakerName, context);
    pushSemanticText(tokens, match[0], absoluteStart + match.index, context);
    consumed = match.index + match[0].length;
  }
  pushDialogueText(tokens, text.slice(consumed), absoluteStart + consumed, speakerName, context);
}

function pushLine(tokens, line, absoluteStart, defaultSpeaker, context) {
  const match = SPEAKER_LABEL.exec(line);
  if (!match) {
    pushMarkupAwareDialogue(tokens, line, absoluteStart, defaultSpeaker, context);
    return;
  }

  const leading = match[1];
  const seedName = match[2] ?? match[3];
  const visibleLabel = match[2] !== undefined ? `[${match[2]}]` : match[3];
  const appearance = appearanceForSpeaker(seedName);
  pushPlain(tokens, leading, absoluteStart, absoluteStart + leading.length);
  const labelStart = absoluteStart + leading.length;
  tokens.push({
    kind: "speaker-label",
    text: visibleLabel,
    sourceStart: labelStart,
    sourceEnd: labelStart + visibleLabel.length,
    speaker: appearance.normalizedName,
    style: speakerStyle(appearance, "speaker-label", "bright")
  });

  const separatorStart = labelStart + visibleLabel.length;
  const separator = match[0].slice(leading.length + visibleLabel.length);
  pushPlain(tokens, separator, separatorStart, separatorStart + separator.length);
  pushMarkupAwareDialogue(tokens, line.slice(match[0].length), absoluteStart + match[0].length, seedName, context);
}

function tokenizeSource(sourceText, options) {
  const tokens = [];
  const context = { accentCount: 0, accentLimit: clampAccentLimit(options.accentLimit), speechCount: 0 };
  const defaultSpeaker = typeof options.defaultSpeaker === "string" && options.defaultSpeaker.trim()
    ? options.defaultSpeaker
    : null;
  let cursor = 0;

  while (cursor < sourceText.length) {
    let newlineStart = cursor;
    while (newlineStart < sourceText.length && sourceText[newlineStart] !== "\r" && sourceText[newlineStart] !== "\n") {
      newlineStart += 1;
    }
    pushLine(tokens, sourceText.slice(cursor, newlineStart), cursor, defaultSpeaker, context);
    if (newlineStart >= sourceText.length) break;

    const newlineEnd = sourceText[newlineStart] === "\r" && sourceText[newlineStart + 1] === "\n"
      ? newlineStart + 2
      : newlineStart + 1;
    pushPlain(tokens, sourceText.slice(newlineStart, newlineEnd), newlineStart, newlineEnd);
    cursor = newlineEnd;
  }

  return tokens;
}

function regexEscape(character) {
  return /[\\^$.*+?()[\]{}|]/u.test(character) ? `\\${character}` : character;
}

function flexibleReferencePattern(reference) {
  let pattern = "";
  for (const character of normalizeSpeakerName(reference)) {
    if (character === " ") pattern += "[ \\t]+";
    else if (character === "'") pattern += "['‘’ʻʼ]";
    else if (character === "-") pattern += "[-‐‑‒–—―]";
    else pattern += regexEscape(character);
  }
  return pattern;
}

function referenceMatcher(context) {
  const references = [...context.aliasClaims.keys()].sort((first, second) => second.length - first.length);
  if (!references.length) return null;
  return new RegExp(references.map(flexibleReferencePattern).join("|"), "giu");
}

function wordCharacter(character) {
  return Boolean(character && /[\p{L}\p{M}\p{N}_]/u.test(character));
}

function boundaryMatch(text, start, end) {
  return !wordCharacter(text[start - 1]) && !wordCharacter(text[end]);
}

function rangesOverlap(first, second) {
  return first.start < second.end && second.start < first.end;
}

function blockedMarkupRanges(text) {
  const ranges = [];
  RAW_SEMANTIC_MARKUP.lastIndex = 0;
  let match;
  while ((match = RAW_SEMANTIC_MARKUP.exec(text)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

function automaticReferenceEvents(text, context, resolvedEvents) {
  const events = [];
  const blocked = blockedMarkupRanges(text);
  const overlapsProtectedRange = candidate => (
    resolvedEvents.some(event => rangesOverlap(candidate, event))
    || blocked.some(range => rangesOverlap(candidate, range))
  );
  const matcher = referenceMatcher(context);
  if (matcher) {
    let match;
    while ((match = matcher.exec(text)) !== null) {
      const event = { start: match.index, end: match.index + match[0].length, type: "name" };
      if (!boundaryMatch(text, event.start, event.end) || overlapsProtectedRange(event)) continue;
      const identity = uniqueIdentityForReference(context, match[0]);
      if (!identity) continue;
      events.push({ ...event, identity });
    }
  }

  REFERENCE_WORD.lastIndex = 0;
  let word;
  while ((word = REFERENCE_WORD.exec(text)) !== null) {
    const pronoun = normalizedReferenceWord(word[0]);
    if (!context.pronounForms.has(pronoun)) continue;
    const event = { start: word.index, end: word.index + word[0].length, type: "pronoun", pronoun };
    if (overlapsProtectedRange(event) || events.some(existing => rangesOverlap(event, existing))) continue;
    events.push(event);
  }
  return events;
}

function identityStyle(identity, kind) {
  const appearance = appearanceForSpeaker(identity.id);
  const pronoun = kind === "pronoun";
  return {
    family: "identity",
    role: pronoun ? "identity-pronoun" : "identity-name",
    tone: pronoun ? "body" : "bright",
    paletteId: appearance.paletteId,
    color: pronoun ? appearance.dialogue : appearance.quote
  };
}

function identityToken(text, sourceStart, sourceEnd, identity, kind, resolution) {
  const semanticKind = kind === "pronoun" ? "pronoun" : "name";
  return {
    kind: "identity-mention",
    text,
    sourceStart,
    sourceEnd,
    identity: identity.id,
    canonicalName: identity.name,
    resolution,
    style: identityStyle(identity, semanticKind)
  };
}

function advanceReferenceContext(text, state) {
  if (PARAGRAPH_BREAK.test(text)) {
    state.paragraphSeen.clear();
    state.lineSeen.clear();
    state.sentenceSeen.clear();
    state.previousSentenceSeen.clear();
  }
  if (/[\r\n]/u.test(text)) state.lineSeen.clear();
  const sentenceBreaks = text.match(SENTENCE_BREAK) ?? [];
  for (const _break of sentenceBreaks) {
    state.previousSentenceSeen = new Set(state.sentenceSeen);
    state.sentenceSeen.clear();
  }
}

function rememberIdentity(state, identity) {
  state.sentenceSeen.add(identity.id);
  state.lineSeen.add(identity.id);
  state.paragraphSeen.add(identity.id);
}

function inferredPronounIdentity(state, context, pronoun) {
  const matching = ids => [...ids]
    .map(id => context.identityById.get(id))
    .filter(identity => identity?.pronouns.includes(pronoun));
  const sentenceMatches = matching(state.sentenceSeen);
  if (sentenceMatches.length) return sentenceMatches.length === 1 ? sentenceMatches[0] : null;
  const previousMatches = matching(state.previousSentenceSeen);
  return previousMatches.length === 1 ? previousMatches[0] : null;
}

function pushBaseRun(output, baseToken, text, sourceStart, sourceEnd) {
  if (!text) return;
  if (baseToken.kind === "text") {
    pushPlain(output, text, sourceStart, sourceEnd);
    return;
  }
  output.push({
    ...baseToken,
    text,
    sourceStart,
    sourceEnd
  });
}

function processReferenceToken(output, token, context, state, exactSpans) {
  const localResolved = exactSpans.map(span => ({
    start: span.start - token.sourceStart,
    end: span.end - token.sourceStart,
    type: "resolved",
    identity: context.identityById.get(span.identityId),
    referenceKind: span.kind,
    span
  }));
  const automatic = token.kind === "text" ? automaticReferenceEvents(token.text, context, localResolved) : [];
  const events = [...localResolved, ...automatic].sort((first, second) => (
    first.start - second.start
    || (first.type === "resolved" ? -1 : 1)
    || second.end - first.end
  ));
  let consumed = 0;
  for (const event of events) {
    if (event.start < consumed) continue;
    const before = token.text.slice(consumed, event.start);
    pushBaseRun(output, token, before, token.sourceStart + consumed, token.sourceStart + event.start);
    advanceReferenceContext(before, state);
    const eventText = token.text.slice(event.start, event.end);

    if (event.type === "resolved") {
      const kind = event.referenceKind === "reference" && event.identity.pronouns.includes(normalizedReferenceWord(eventText))
        ? "pronoun"
        : event.referenceKind;
      output.push(identityToken(
        eventText,
        token.sourceStart + event.start,
        token.sourceStart + event.end,
        event.identity,
        kind,
        "resolver-span"
      ));
      rememberIdentity(state, event.identity);
      event.span.used = true;
    } else if (event.type === "name") {
      output.push(identityToken(
        eventText,
        token.sourceStart + event.start,
        token.sourceStart + event.end,
        event.identity,
        "name",
        "registry-name"
      ));
      rememberIdentity(state, event.identity);
    } else {
      const identity = inferredPronounIdentity(state, context, event.pronoun);
      if (identity) {
        output.push(identityToken(
          eventText,
          token.sourceStart + event.start,
          token.sourceStart + event.end,
          identity,
          "pronoun",
          "conservative-pronoun"
        ));
      } else {
        pushBaseRun(output, token, eventText, token.sourceStart + event.start, token.sourceStart + event.end);
      }
    }
    consumed = event.end;
  }

  const after = token.text.slice(consumed);
  pushBaseRun(output, token, after, token.sourceStart + consumed, token.sourceEnd);
  advanceReferenceContext(after, state);
}

function canonicalizeSpeakerToken(token, context) {
  if (token.style?.family !== "speaker" || !token.speaker) return token;
  const identity = uniqueIdentityForReference(context, token.speaker);
  if (!identity) return token;
  const appearance = appearanceForSpeaker(identity.id);
  return {
    ...token,
    speaker: identity.id,
    identity: identity.id,
    style: token.kind === "marked-dialogue"
      ? markedDialogueStyle(appearance)
      : speakerStyle(appearance, token.style.role, token.style.tone)
  };
}

function registeredNameEvents(text, absoluteStart, context) {
  const events = [];
  const matcher = referenceMatcher(context);
  if (!matcher) return events;
  let match;
  while ((match = matcher.exec(text)) !== null) {
    if (!boundaryMatch(text, match.index, match.index + match[0].length)) continue;
    const identity = uniqueIdentityForReference(context, match[0]);
    if (!identity) continue;
    events.push({
      start: absoluteStart + match.index,
      end: absoluteStart + match.index + match[0].length,
      localStart: match.index,
      localEnd: match.index + match[0].length,
      identity
    });
  }
  return events;
}

function speechTaggedIdentity(text, absoluteStart, context, preferLast = false) {
  const candidates = registeredNameEvents(text, absoluteStart, context).filter(event => {
    const before = text.slice(Math.max(0, event.localStart - 28), event.localStart);
    const after = text.slice(event.localEnd, Math.min(text.length, event.localEnd + 28));
    return SPEECH_VERB.test(before) || SPEECH_VERB.test(after);
  });
  if (!candidates.length) return null;
  return (preferLast ? candidates.at(-1) : candidates[0]).identity;
}

function nearbyPronounSpeechTag(text) {
  return /\b(?:she|he|they|it)\b[^.!?“”"]{0,24}\b(?:adds?|answers?|asks?|begins?|calls?|continues?|cries?|demands?|murmurs?|replies?|responds?|says?|shouts?|speaks?|whispers?|yells?)\b/iu.test(text)
    || /\b(?:adds?|answers?|asks?|begins?|calls?|continues?|cries?|demands?|murmurs?|replies?|responds?|says?|shouts?|speaks?|whispers?|yells?)\b[^.!?“”"]{0,24}\b(?:she|he|they|it)\b/iu.test(text);
}

function nearestNarrativeIdentity(text, absoluteStart, context) {
  const boundaries = [...text.matchAll(SENTENCE_BREAK)].map(match => match.index + match[0].length);
  const segments = [];
  let end = text.length;
  for (let index = boundaries.length - 1; index >= -1 && segments.length < 2; index -= 1) {
    const start = index >= 0 ? boundaries[index] : 0;
    const segment = text.slice(start, end);
    if (segment.trim()) segments.push({ text: segment, start });
    end = index >= 0 ? boundaries[index] : 0;
  }
  for (const segment of segments) {
    const events = registeredNameEvents(segment.text, absoluteStart + segment.start, context);
    const identities = [...new Map(events.map(event => [event.identity.id, event.identity])).values()];
    if (identities.length) return identities.length === 1 ? identities[0] : null;
  }
  return null;
}

function dialogueGroups(tokens) {
  const groups = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].kind !== "quote-mark") continue;
    const bodyIndex = tokens[index + 1]?.kind === "dialogue" ? index + 1 : -1;
    const closeIndex = bodyIndex >= 0 ? index + 2 : index + 1;
    if (tokens[closeIndex]?.kind !== "quote-mark") continue;
    groups.push({ openIndex: index, bodyIndex, closeIndex });
    index = closeIndex;
  }
  return groups;
}

/**
 * Attribute ordinary prose quotations before identity tokenization. This is a
 * deliberately small discourse resolver: explicit nearby speech tags win,
 * then quote continuations, then the nearest registered narrative subject.
 * It never invents an identity outside the admitted registry.
 */
function attributeProseDialogue(tokens, context, sourceText) {
  const output = tokens.map(token => ({ ...token, style: token.style ? { ...token.style } : token.style }));
  const groups = dialogueGroups(output);
  let previousSpeaker = null;

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    const open = output[group.openIndex];
    const close = output[group.closeIndex];
    if (open.speaker) {
      previousSpeaker = uniqueIdentityForReference(context, open.speaker);
      continue;
    }

    const previousEnd = groupIndex > 0 ? output[groups[groupIndex - 1].closeIndex].sourceEnd : 0;
    const nextStart = groupIndex + 1 < groups.length ? output[groups[groupIndex + 1].openIndex].sourceStart : sourceText.length;
    const prefixStart = Math.max(previousEnd, open.sourceStart - ATTRIBUTION_WINDOW);
    const suffixEnd = Math.min(nextStart, close.sourceEnd + ATTRIBUTION_WINDOW);
    const prefix = sourceText.slice(prefixStart, open.sourceStart);
    const suffix = sourceText.slice(close.sourceEnd, suffixEnd);

    const suffixTagged = speechTaggedIdentity(suffix, close.sourceEnd, context, false);
    const prefixTagged = speechTaggedIdentity(prefix, prefixStart, context, true);
    const pronounContinuation = previousSpeaker && (nearbyPronounSpeechTag(prefix) || nearbyPronounSpeechTag(suffix));
    const nearest = nearestNarrativeIdentity(prefix, prefixStart, context);
    const identity = suffixTagged || prefixTagged || (pronounContinuation ? previousSpeaker : null) || nearest;
    if (!identity) {
      previousSpeaker = null;
      continue;
    }

    const attribution = suffixTagged || prefixTagged
      ? "speech-tag"
      : pronounContinuation
        ? "quote-continuation"
        : "prose-referent";
    const appearance = appearanceForSpeaker(identity.id);
    for (const tokenIndex of [group.openIndex, group.bodyIndex, group.closeIndex].filter(index => index >= 0)) {
      const token = output[tokenIndex];
      token.speaker = identity.id;
      token.identity = identity.id;
      token.attribution = attribution;
      token.style = speakerStyle(appearance, token.style.role, token.style.tone);
      if (tokenIndex === group.openIndex) token.quotePosition = "open";
      if (tokenIndex === group.closeIndex) token.quotePosition = "close";
    }
    previousSpeaker = identity;
  }
  return output;
}

function uniqueSeenIdentity(state, context) {
  const identities = ids => [...ids]
    .map(id => context.identityById.get(id))
    .filter(Boolean);
  const sentenceIdentities = identities(state.sentenceSeen);
  if (sentenceIdentities.length) return sentenceIdentities.length === 1 ? sentenceIdentities[0] : null;
  const previousIdentities = identities(state.previousSentenceSeen);
  return previousIdentities.length === 1 ? previousIdentities[0] : null;
}

function canonicalizeUnattributedDialogueToken(token, context, state) {
  if (
    token.style?.family !== "speaker"
    || token.speaker
    || !new Set(["quote-mark", "dialogue"]).has(token.kind)
  ) return token;
  const identity = uniqueSeenIdentity(state, context);
  if (!identity) return token;
  const appearance = appearanceForSpeaker(identity.id);
  return {
    ...token,
    speaker: identity.id,
    identity: identity.id,
    attribution: "prose-referent",
    style: speakerStyle(appearance, token.style.role, token.style.tone)
  };
}

function applyIdentityAdornments(tokens, registryInput, resolvedInput, sourceText) {
  const context = identityContext(registryInput);
  if (!context.registry.identities.length) {
    if (resolvedInput?.length || isResolvedReferences(resolvedInput) && resolvedInput.spans.length) {
      throw new RangeError("Resolved references require a non-empty identity registry.");
    }
    return tokens.map(token => token.kind === "marked-dialogue"
      ? plainToken(token.rawText, token.sourceStart, token.sourceEnd)
      : token);
  }
  const rawReferences = isResolvedReferences(resolvedInput)
    ? resolvedInput.spans.map(span => ({
      start: span.start,
      end: span.end,
      identity: span.identityId,
      kind: span.kind
    }))
    : resolvedInput ?? [];
  const normalizedReferences = normalizeResolvedReferences(sourceText, rawReferences, context.registry);
  const exactSpans = normalizedReferences.spans.map(span => ({ ...span, used: false }));
  const output = [];
  const state = {
    sentenceSeen: new Set(),
    previousSentenceSeen: new Set(),
    lineSeen: new Set(),
    paragraphSeen: new Set()
  };
  const attributedTokens = attributeProseDialogue(tokens, context, sourceText);

  for (const originalToken of attributedTokens) {
    const speakerToken = canonicalizeSpeakerToken(originalToken, context);
    const token = canonicalizeUnattributedDialogueToken(speakerToken, context, state);
    if (token.kind === "marked-dialogue") {
      if (!token.identity) {
        pushPlain(output, token.rawText, token.sourceStart, token.sourceEnd);
        advanceReferenceContext(token.rawText, state);
      } else {
        const identity = context.identityById.get(token.identity);
        if (identity) rememberIdentity(state, identity);
        output.push(token);
        advanceReferenceContext(token.dialogueText, state);
      }
      continue;
    }
    if ((token.kind === "speaker-label" || token.kind === "quote-mark" && token.quotePosition === "open") && token.identity) {
      const identity = context.identityById.get(token.identity);
      if (identity) rememberIdentity(state, identity);
    }
    const overlaps = exactSpans.filter(span => span.start < token.sourceEnd && token.sourceStart < span.end);
    if (overlaps.some(span => span.start < token.sourceStart || span.end > token.sourceEnd)) {
      throw new RangeError("A resolved reference must fit within one display token.");
    }
    if ((token.kind === "text" || token.kind === "dialogue") && (overlaps.length || token.kind === "text")) {
      processReferenceToken(output, token, context, state, overlaps);
    } else {
      if (overlaps.length) throw new RangeError("Resolved references may target narrative or dialogue text only.");
      output.push(token);
      if (token.kind === "dialogue") advanceReferenceContext(token.text, state);
    }
  }
  if (exactSpans.some(span => !span.used)) throw new RangeError("A resolved reference did not match displayable source text.");
  return output;
}

function freezePlan(plan) {
  for (const token of plan.tokens) {
    if (token.style?.color) Object.freeze(token.style.color);
    if (token.style?.quoteColor) Object.freeze(token.style.quoteColor);
    if (token.style) Object.freeze(token.style);
    Object.freeze(token);
  }
  Object.freeze(plan.tokens);
  return Object.freeze(plan);
}

/**
 * Builds an immutable display projection while retaining the exact transcript
 * source. Passing an existing plan returns it unchanged (idempotence).
 */
export function createAdornmentPlan(input, options = {}) {
  if (isAdornmentPlan(input)) return input;
  if (typeof input !== "string") throw new TypeError("Adornment input must be transcript text or an adornment plan.");
  const baseTokens = tokenizeSource(input, options);
  return freezePlan({
    schema: ADORNMENT_SCHEMA,
    sourceText: input,
    tokens: applyIdentityAdornments(baseTokens, options.identities ?? [], options.resolvedReferences, input)
  });
}

/** Visible text after recognized presentation markup is removed. */
export function displayTextFromPlan(plan) {
  if (!isAdornmentPlan(plan)) throw new TypeError("Expected a Semantic Play adornment plan.");
  return plan.tokens.map(token => token.text).join("");
}
