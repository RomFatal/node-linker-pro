#!/usr/bin/env node
import fsp from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import { spawn } from "child_process";

const HELP_TEXT = `
------------------------------------------------------------
linker-node-modules — External node_modules linker (CACHE-BASED)
------------------------------------------------------------

USAGE
  linker-node-modules   # Move node_modules to cache, link it, and install if needed
  linker-node-modules --help

DEFAULT CACHE LOCATIONS (purgeable by OS/cleaners)
  • macOS:   ~/Library/Caches/node_modules_store
  • Linux:   ~/.cache/node_modules_store
  • Windows: %LOCALAPPDATA%\\Temp\\node_modules_cache

OVERRIDE CACHE LOCATION
  mac/Linux:
    EXTERNAL_NODE_MODULES_DIR="/path/to/cache" linker-node-modules
  Windows (PowerShell):
    $env:EXTERNAL_NODE_MODULES_DIR="D:\\path\\to\\cache"; linker-node-modules

NOTES
  • This is a CACHE; if cleared, dependencies can be reinstalled.
  • Windows uses a directory junction (no admin if Developer Mode is enabled).
`;

if (process.argv.includes("--help")) {
  console.log(HELP_TEXT);
  process.exit(0);
}

const projectDir = process.cwd();
const nmPath = path.join(projectDir, "node_modules");

function defaultStoreDir() {
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
    return path.join(base, "Temp", "node_modules_cache");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "node_modules_store");
  }
  return path.join(os.homedir(), ".cache", "node_modules_store");
}

const storeDir = process.env.EXTERNAL_NODE_MODULES_DIR || defaultStoreDir();
const hash = crypto.createHash("sha1").update(projectDir).digest("hex");
const target = path.join(storeDir, hash);

async function exists(p) {
  try { await fsp.lstat(p); return true; } catch { return false; }
}
async function isLink(p) {
  try { return (await fsp.lstat(p)).isSymbolicLink(); } catch { return false; }
}
async function runNpmInstall() {
  return new Promise((resolve, reject) => {
    console.log("Installing dependencies...");
    const proc = spawn("npm", ["install"], { stdio: "inherit", shell: true });
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(String(code))));
  });
}

async function main() {
  await fsp.mkdir(storeDir, { recursive: true });

  if (await isLink(nmPath)) {
    console.log(`node_modules already linked -> ${target}`);
    try {
      const files = await fsp.readdir(target);
      if (!files.length) await runNpmInstall();
    } catch {
      await runNpmInstall();
    }
    return;
  }

  if (await exists(nmPath) && !(await isLink(nmPath))) {
    await fsp.mkdir(target, { recursive: true });
    await fsp.rename(nmPath, target);
    console.log(`Moved node_modules to ${target}`);
  } else {
    await fsp.mkdir(target, { recursive: true });
  }

  try { await fsp.rm(nmPath, { recursive: true, force: true }); } catch {}

  const linkType = process.platform === "win32" ? "junction" : "dir";
  await fsp.symlink(target, nmPath, linkType);
  console.log(`Linked node_modules -> ${target} (${linkType})`);

  const files = await fsp.readdir(target);
  if (!files.length) {
    await runNpmInstall();
  } else {
    console.log("Dependencies already cached — no install needed.");
  }
}

main().catch((err) => {
  console.error("linker-node-modules failed:", err.message);
  process.exit(1);
});
