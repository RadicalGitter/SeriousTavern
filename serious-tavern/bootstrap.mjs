import path from "node:path";
import { fileURLToPath } from "node:url";

import { bootstrapSeriousTavern } from "./bootstrap-core.mjs";

const seriousRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const appRoot = path.resolve(seriousRoot, "..");

function parseArguments(argv) {
  const options = {
    appRoot,
    lockPath: path.join(seriousRoot, "extensions.lock.json"),
    presetPath: path.join(seriousRoot, "roleplay-settings.json"),
    pack: "roleplay-v1",
    check: false,
    refreshExtensions: false,
    forceSettings: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") options.check = true;
    else if (argument === "--refresh-extensions") options.refreshExtensions = true;
    else if (argument === "--force-settings") options.forceSettings = true;
    else if (["--data-root", "--config-path", "--pack", "--port"].includes(argument)) {
      const key = { "--data-root": "dataRoot", "--config-path": "configPath", "--pack": "pack", "--port": "port" }[argument];
      options[key] = argv[++index];
    } else throw new Error(`Unknown SeriousTavern bootstrap argument: ${argument}`);
  }
  if (!options.dataRoot || !options.configPath) throw new Error("--data-root and --config-path are required.");
  return options;
}

const options = parseArguments(process.argv.slice(2));
const result = await bootstrapSeriousTavern(options);
for (const extension of result.report) {
  console.log(`${extension.id}: ${extension.status}${extension.commit ? ` (${extension.commit.slice(0, 12)})` : ""}`);
}
console.log(`memory settings: ${result.settingsReady ? "ready" : "drifted"}`);
console.log(`extension updates: ${result.configReady ? "locked" : "enabled"}`);

const unsafe = result.report.filter(item => item.status !== "ready");
if (unsafe.length || !result.settingsReady || !result.configReady) {
  if (unsafe.length) console.error(`Extension pack is not reproducible: ${unsafe.map(item => `${item.id}=${item.status}`).join(", ")}`);
  if (!result.settingsReady) console.error("Memory settings differ from the SeriousTavern preset. Use --force-settings to restore them deliberately.");
  if (!result.configReady) console.error("Automatic extension updates are enabled. Use --force-settings to restore the lock invariant deliberately.");
  if (unsafe.length || !result.configReady || options.check) process.exitCode = 1;
}
