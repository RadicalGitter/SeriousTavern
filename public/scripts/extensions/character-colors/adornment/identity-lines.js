import { createIdentityRegistry } from "./index.js";

/**
 * Human-editable identity grammar:
 *
 *     Display Name | she/her/hers | Alias, Formal Title
 *
 * Pronouns and aliases are optional. Parsing remains strict so a typo cannot
 * silently associate color with the wrong character.
 */
export function parseIdentityLines(value) {
  const entries = String(value ?? "")
    .split(/\r?\n/gu)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const fields = line.split("|").map(field => field.trim());
      if (fields.length > 3) throw new RangeError(`Identity line ${index + 1} has too many | separators.`);
      const [name, pronounField = "", aliasField = ""] = fields;
      return {
        name,
        pronouns: pronounField ? pronounField.split(/[\s/,]+/gu).filter(Boolean) : [],
        aliases: aliasField ? aliasField.split(",").map(alias => alias.trim()).filter(Boolean) : []
      };
    });
  return createIdentityRegistry(entries);
}

export function formatIdentityLines(registryInput) {
  const registry = createIdentityRegistry(registryInput);
  return registry.identities.map(identity => [
    identity.name,
    identity.pronouns.join("/"),
    identity.aliases.join(", ")
  ].join(" | ").replace(/(?: \| ){1,2}$/u, "")).join("\n");
}
