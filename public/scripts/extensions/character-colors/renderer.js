import { createAdornmentPlan } from "./adornment/index.js";

const adornmentSources = new WeakMap();
const ADORNMENT_ROOT_SELECTOR = "[data-character-colors-root]";
const ADORNMENT_SKIP_SELECTOR = [
  "pre", "code", "a", "button", "input", "textarea", "select", "option",
  "script", "style", "[contenteditable]", "[role='button']", ".mes_button",
  ".menu_button", ".interactable", ADORNMENT_ROOT_SELECTOR,
  "[data-character-colors]", "[data-semantic-play-adornment-root]"
].join(",");
const ACCENT_GLYPHS = Object.freeze({
  notable: "[+]",
  mystic: "[*]",
  danger: "[!]",
  item: "[=]",
  place: "[@]",
  system: "[>]"
});
function createStyledToken(token) {
  const span = document.createElement("span");
  span.dataset.characterColors = token.kind;
  span.classList.add("cc-adornment-token");
  if (token.style?.family === "speaker") span.classList.add("cc-adornment-speaker");
  if (token.style?.family === "identity") span.classList.add("cc-adornment-identity");
  if (token.style?.family === "semantic-accent") span.classList.add("cc-adornment-accent");
  if (token.style?.tone === "bright") span.classList.add("cc-adornment-bright");
  if (token.style?.tone === "body") span.classList.add("cc-adornment-body");
  if (token.style?.emphasis === "strong") span.classList.add("cc-adornment-strong");
  if (token.style?.color?.css) span.style.setProperty("--cc-adornment-color", token.style.color.css);

  if (token.kind === "marked-dialogue") {
    span.classList.add("cc-marked-dialogue");
    const opening = document.createElement("span");
    opening.className = "cc-marked-dialogue-quote";
    opening.textContent = "“";
    const body = document.createElement("span");
    body.className = "cc-marked-dialogue-body";
    body.textContent = token.dialogueText;
    const closing = document.createElement("span");
    closing.className = "cc-marked-dialogue-quote";
    closing.textContent = "”";
    if (token.style?.quoteColor?.css) {
      opening.style.setProperty("--cc-quote-color", token.style.quoteColor.css);
      closing.style.setProperty("--cc-quote-color", token.style.quoteColor.css);
    }
    span.append(opening, body, closing);
    return span;
  }

  const glyph = token.style?.family === "semantic-accent" ? ACCENT_GLYPHS[token.style.role] : null;
  if (glyph) {
    const marker = document.createElement("span");
    marker.className = "cc-adornment-glyph";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = glyph;
    span.append(marker, document.createTextNode(" "));
  }
  span.append(document.createTextNode(token.text));
  if (token.kind === "identity-mention" && token.canonicalName) {
    span.title = token.canonicalName;
    span.setAttribute("aria-label", `${token.text} (${token.canonicalName})`);
  }
  return span;
}

function tokenPieceForRange(token, start, end) {
  const intersectionStart = Math.max(start, token.sourceStart);
  const intersectionEnd = Math.min(end, token.sourceEnd);
  if (intersectionEnd <= intersectionStart) return null;
  if (token.kind === "text") {
    return {
      ...token,
      text: token.text.slice(intersectionStart - token.sourceStart, intersectionEnd - token.sourceStart),
      sourceStart: intersectionStart,
      sourceEnd: intersectionEnd
    };
  }
  if (token.sourceStart < start || token.sourceEnd > end) {
    throw new RangeError("A styled adornment token crossed a rendered Markdown node boundary.");
  }
  return token;
}

function replaceTextGroupWithAdornment(nodes, registry) {
  const source = nodes.map(node => node.nodeValue || "").join("");
  if (!source.trim()) return;
  let plan;
  try {
    plan = createAdornmentPlan(source, { identities: registry, accentLimit: 8 });
  } catch (error) {
    console.warn("Character Colors skipped an invalid adornment projection.", error);
    return;
  }
  if (plan.tokens.every(token => token.kind === "text")) return;

  let cursor = 0;
  const replacements = [];
  try {
    for (const node of nodes) {
      const nodeSource = node.nodeValue || "";
      const start = cursor;
      const end = start + nodeSource.length;
      cursor = end;
      const pieces = plan.tokens.map(token => tokenPieceForRange(token, start, end)).filter(Boolean);
      if (pieces.every(token => token.kind === "text")) continue;
      const root = document.createElement("span");
      root.className = "cc-adornment-root";
      root.dataset.characterColorsRoot = "v1";
      adornmentSources.set(root, nodeSource);
      for (const token of pieces) {
        root.append(token.kind === "text" ? document.createTextNode(token.text) : createStyledToken(token));
      }
      replacements.push({ node, root });
    }
  } catch (error) {
    console.warn("Character Colors left a Markdown-split adornment plain.", error);
    return;
  }
  for (const { node, root } of replacements) node.replaceWith(root);
}


export function renderColors(container, registry) {
  if (!container || container.querySelector(ADORNMENT_ROOT_SELECTOR) || container.querySelector("[data-semantic-play-adornment-root]")) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      return parent && !parent.closest(ADORNMENT_SKIP_SELECTOR)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });
  const groups = new Map();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const block = node.parentElement.closest("p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th") || container;
    const nodes = groups.get(block) || [];
    nodes.push(node);
    groups.set(block, nodes);
  }
  for (const nodes of groups.values()) replaceTextGroupWithAdornment(nodes, registry);
}

export function clearColors(container) {
  container.querySelectorAll(ADORNMENT_ROOT_SELECTOR).forEach(root => {
    const source = adornmentSources.get(root);
    root.replaceWith(document.createTextNode(source ?? root.textContent ?? ""));
  });
  container.normalize();
}
