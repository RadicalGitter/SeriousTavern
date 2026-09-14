import assert from "node:assert/strict";
import test from "node:test";

import { formatIdentityLines, parseIdentityLines } from "../../public/scripts/extensions/character-colors/adornment/identity-lines.js";

test("identity lines round-trip public names, pronouns, and aliases", () => {
  const source = "Kessa | she/her/hers | Kes, Engineer Kessa\nOrren | he/him";
  const registry = parseIdentityLines(source);
  assert.deepEqual(registry.identities[0], {
    id: "kessa",
    name: "Kessa",
    aliases: ["Kes", "Engineer Kessa"],
    pronouns: ["she", "her", "hers"]
  });
  assert.equal(formatIdentityLines(registry), source);
});

test("identity lines reject ambiguous extra fields", () => {
  assert.throws(() => parseIdentityLines("Kessa | she/her | Kes | secret"), /too many/);
});
