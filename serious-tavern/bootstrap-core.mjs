import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SAFE_ID = /^[a-z0-9-]+$/;
const SAFE_DIRECTORY = /^[A-Za-z0-9._-]+$/;
const COMMIT = /^[0-9a-f]{40}$/;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function validateLock(lock) {
  if (!lock || lock.schemaVersion !== 1 || typeof lock.lockRevision !== "string") {
    throw new Error("Unsupported SeriousTavern extension lock.");
  }
  if (!lock.extensions || !lock.packs) throw new Error("Extension lock is missing packs or extensions.");
  for (const [id, extension] of Object.entries(lock.extensions)) {
    if (!SAFE_ID.test(id)) throw new Error(`Unsafe extension id: ${id}`);
    if (!SAFE_DIRECTORY.test(extension.directory || "")) throw new Error(`Unsafe extension directory: ${id}`);
    if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(extension.repository || "")) {
      throw new Error(`Only explicit HTTPS GitHub extension repositories are accepted: ${id}`);
    }
    if (!COMMIT.test(extension.commit || "")) throw new Error(`Extension is not pinned to a full commit: ${id}`);
  }
  for (const [pack, ids] of Object.entries(lock.packs)) {
    if (!SAFE_ID.test(pack) || !Array.isArray(ids) || ids.length === 0) throw new Error(`Invalid extension pack: ${pack}`);
    if (new Set(ids).size !== ids.length) throw new Error(`Extension pack contains duplicates: ${pack}`);
    for (const id of ids) if (!lock.extensions[id]) throw new Error(`Unknown extension '${id}' in pack '${pack}'.`);
  }
  return lock;
}

export function assertSafeDataRoot(input) {
  const resolved = path.resolve(input || "");
  if (!input || resolved === path.parse(resolved).root) throw new Error("Refusing a broad or empty data root.");
  const extensionRoot = path.join(resolved, "default-user", "extensions");
  const relative = path.relative(resolved, extensionRoot);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Extension root escapes the selected data root.");
  return resolved;
}

export function normalizeRemote(value) {
  return String(value || "")
    .trim()
    .replace(/^git@github\.com:/i, "https://github.com/")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "")
    .toLowerCase();
}

export function mergeRoleplaySettings(current, preset) {
  if (!preset || preset.schemaVersion !== 1 || typeof preset.revision !== "string") {
    throw new Error("Unsupported SeriousTavern settings preset.");
  }
  const settings = cloneJson(current || {});
  settings.extension_settings = settings.extension_settings && typeof settings.extension_settings === "object"
    ? settings.extension_settings
    : {};
  const extensions = settings.extension_settings;
  const disabled = Array.isArray(extensions.disabledExtensions) ? extensions.disabledExtensions : [];
  extensions.disabledExtensions = [...new Set([...disabled, ...preset.disableBuiltIns])];
  extensions.memory = Object.assign({}, extensions.memory || {}, preset.memory || {});
  extensions.vectors = Object.assign({}, extensions.vectors || {}, preset.vectors || {});

  const source = preset.summaryception || {};
  const customPromptName = source.customPromptName;
  const patch = cloneJson(source);
  delete patch.customPromptName;
  const existingSummary = extensions.summaryception && typeof extensions.summaryception === "object"
    ? extensions.summaryception
    : {};
  const savedCustomPrompts = Object.assign({}, existingSummary.savedCustomPrompts || {});
  if (customPromptName) savedCustomPrompts[customPromptName] = source.summarizerUserPrompt;
  extensions.summaryception = Object.assign({}, existingSummary, patch, {
    savedCustomPrompts,
    lastCustomPrompt: source.summarizerUserPrompt
  });
  return settings;
}

export function settingsMatchPreset(settings, preset) {
  const extensions = settings?.extension_settings;
  if (!extensions || !Array.isArray(extensions.disabledExtensions)) return false;
  if (!preset.disableBuiltIns.every(id => extensions.disabledExtensions.includes(id))) return false;
  for (const [key, value] of Object.entries(preset.memory || {})) {
    if (extensions.memory?.[key] !== value) return false;
  }
  for (const [key, value] of Object.entries(preset.vectors || {})) {
    if (extensions.vectors?.[key] !== value) return false;
  }
  for (const [key, value] of Object.entries(preset.summaryception || {})) {
    if (key === "customPromptName") continue;
    if (JSON.stringify(extensions.summaryception?.[key]) !== JSON.stringify(value)) return false;
  }
  const name = preset.summaryception?.customPromptName;
  return !name || extensions.summaryception?.savedCustomPrompts?.[name] === preset.summaryception.summarizerUserPrompt;
}

export function patchConfigText(input) {
  const lines = String(input).split(/\r?\n/);
  let inExtensions = false;
  let extensionAutoUpdateFound = false;
  let serverAutoUpdateFound = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^extensions:\s*(?:#.*)?$/.test(line)) {
      inExtensions = true;
      continue;
    }
    if (inExtensions && /^\S/.test(line) && !/^\s*#/.test(line)) inExtensions = false;
    if (inExtensions && /^\s{2}autoUpdate:\s*/.test(line)) {
      lines[index] = line.replace(/autoUpdate:\s*(?:true|false)/, "autoUpdate: false");
      extensionAutoUpdateFound = true;
    }
    if (/^enableServerPluginsAutoUpdate:\s*/.test(line)) {
      lines[index] = line.replace(/enableServerPluginsAutoUpdate:\s*(?:true|false)/, "enableServerPluginsAutoUpdate: false");
      serverAutoUpdateFound = true;
    }
  }
  if (!extensionAutoUpdateFound || !serverAutoUpdateFound) {
    throw new Error("Profile config does not expose the expected extension update controls.");
  }
  return lines.join("\n");
}

async function runGit(args, cwd) {
  try {
    const result = await execFileAsync("git", args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true
    });
    return String(result.stdout || "").trim();
  } catch (error) {
    const detail = String(error.stderr || error.message || "Git command failed").trim();
    throw new Error(`git ${args[0]} failed: ${detail}`);
  }
}

async function inspectExtension(target, spec) {
  try {
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) return { status: "unsafe-link", target };
    if (!stat.isDirectory()) return { status: "not-directory", target };
  } catch (error) {
    if (error.code === "ENOENT") return { status: "missing", target };
    throw error;
  }

  let topLevel;
  try {
    topLevel = path.resolve(await runGit(["rev-parse", "--show-toplevel"], target));
  } catch {
    return { status: "not-git", target };
  }
  if (topLevel !== path.resolve(target)) return { status: "wrong-root", target };
  const remote = await runGit(["remote", "get-url", "origin"], target);
  if (normalizeRemote(remote) !== normalizeRemote(spec.repository)) return { status: "wrong-remote", target, remote };
  const dirty = await runGit(["status", "--porcelain", "--untracked-files=all"], target);
  if (dirty) return { status: "dirty", target };
  const commit = await runGit(["rev-parse", "HEAD"], target);
  return { status: commit === spec.commit ? "ready" : "wrong-commit", target, commit };
}

async function installMissingExtension(extensionRoot, spec) {
  await fs.mkdir(extensionRoot, { recursive: true });
  const target = path.join(extensionRoot, spec.directory);
  const temporary = path.join(extensionRoot, `.${spec.directory}.serious-install-${process.pid}-${Date.now()}`);
  const relative = path.relative(extensionRoot, temporary);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Temporary extension path escaped its root.");
  try {
    await runGit(["clone", "--no-checkout", spec.repository, temporary], extensionRoot);
    await runGit(["checkout", "--detach", spec.commit], temporary);
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    throw error;
  }
  return target;
}

async function refreshExtension(target, spec) {
  await runGit(["fetch", "origin", spec.commit], target);
  await runGit(["checkout", "--detach", spec.commit], target);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readMarker(markerPath) {
  try {
    return await readJson(markerPath);
  } catch (error) {
    if (error.code === "ENOENT") return { schemaVersion: 1 };
    throw error;
  }
}

async function backupFile(source, backupRoot, label) {
  try {
    await fs.access(source);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  await fs.mkdir(backupRoot, { recursive: true });
  const target = path.join(backupRoot, `${timestamp()}-${label}`);
  await fs.copyFile(source, target);
  return target;
}

async function isPortListening(port) {
  if (!port) return false;
  return new Promise(resolve => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = value => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(350, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

export async function bootstrapSeriousTavern(options) {
  const appRoot = path.resolve(options.appRoot);
  const dataRoot = assertSafeDataRoot(options.dataRoot);
  const configPath = path.resolve(options.configPath);
  const lock = validateLock(await readJson(options.lockPath));
  const preset = await readJson(options.presetPath);
  const ids = lock.packs[options.pack];
  if (!ids) throw new Error(`Unknown SeriousTavern extension pack: ${options.pack}`);
  if (!options.check && await isPortListening(Number(options.port || 0))) {
    throw new Error(`Profile appears to be running on port ${options.port}; stop it before changing extensions or settings.`);
  }

  const extensionRoot = path.join(dataRoot, "default-user", "extensions");
  const report = [];
  for (const id of ids) {
    const spec = lock.extensions[id];
    const target = path.join(extensionRoot, spec.directory);
    let state = await inspectExtension(target, spec);
    if (!options.check && state.status === "missing") {
      await installMissingExtension(extensionRoot, spec);
      state = await inspectExtension(target, spec);
    } else if (!options.check && options.refreshExtensions && state.status === "wrong-commit") {
      await refreshExtension(target, spec);
      state = await inspectExtension(target, spec);
    }
    report.push({ id, ...state });
  }

  const stateRoot = path.join(dataRoot, "serious-tavern");
  const markerPath = path.join(stateRoot, "bootstrap-state.json");
  const backupRoot = path.join(stateRoot, "backups");
  const marker = await readMarker(markerPath);
  const settingsPath = path.join(dataRoot, "default-user", "settings.json");
  let settings;
  try {
    settings = await readJson(settingsPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    settings = await readJson(path.join(appRoot, "default", "content", "settings.json"));
  }

  const settingsAlreadyMatch = settingsMatchPreset(settings, preset);
  if (!options.check && (!marker.settingsRevision || options.forceSettings)) {
    if (!settingsAlreadyMatch) {
      await backupFile(settingsPath, backupRoot, "settings.json");
      settings = mergeRoleplaySettings(settings, preset);
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, `${JSON.stringify(settings, null, 4)}\n`, "utf8");
    }
    marker.settingsRevision = preset.revision;
  }

  const originalConfig = await fs.readFile(configPath, "utf8");
  const patchedConfig = patchConfigText(originalConfig);
  const configAlreadyMatch = originalConfig === patchedConfig;
  if (!options.check && (!marker.configRevision || options.forceSettings)) {
    if (!configAlreadyMatch) {
      await backupFile(configPath, backupRoot, "config.yaml");
      await fs.writeFile(configPath, patchedConfig, "utf8");
    }
    marker.configRevision = "extension-updates-disabled-v1";
  }

  if (!options.check) {
    marker.schemaVersion = 1;
    marker.pack = options.pack;
    marker.lockRevision = lock.lockRevision;
    marker.lastBootstrap = new Date().toISOString();
    marker.fingerprint = crypto.createHash("sha256")
      .update(JSON.stringify({ pack: options.pack, lock: lock.lockRevision, settings: preset.revision }))
      .digest("hex");
    await fs.mkdir(stateRoot, { recursive: true });
    await fs.writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
  }

  const finalSettings = options.check ? settings : await readJson(settingsPath);
  return {
    report,
    settingsReady: settingsMatchPreset(finalSettings, preset),
    configReady: (await fs.readFile(configPath, "utf8")) === patchConfigText(await fs.readFile(configPath, "utf8")),
    markerPath
  };
}
