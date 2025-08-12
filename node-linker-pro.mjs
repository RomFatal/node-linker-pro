#!/usr/bin/env node
/**
 * node-linker-pro — External node_modules linker (CACHE-BASED)
 * -----------------------------------------------------------
 * Moves ./node_modules to a cache outside your cloud folder and links back.
 * Stops with a clear error if the link/junction cannot be created.
 *
 * USAGE
 *   node-linker-pro         # link + auto-install if cache empty
 *   node-linker-pro --help
 *
 * ENV
 *   EXTERNAL_NODE_MODULES_DIR=/custom/cache/path  # override cache location
 */

import fsp from "fs/promises";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { spawn } from "child_process";

const HELP_TEXT = `
------------------------------------------------------------
node-linker-pro — External node_modules linker (CACHE-BASED)
------------------------------------------------------------

USAGE
  node-linker-pro
  node-linker-pro --help

WHAT IT DOES
  • Moves ./node_modules to a local cache (outside cloud sync)
  • Creates a link (symlink on macOS/Linux, junction on Windows)
  • Auto-runs "npm install" if the cache is empty

DEFAULT CACHE LOCATIONS
  • macOS:   ~/Library/Caches/node_modules_store
  • Linux:   ~/.cache/node_modules_store
  • Windows: %LOCALAPPDATA%\\Temp\\node_modules_cache

OVERRIDE CACHE LOCATION
  macOS/Linux:
    EXTERNAL_NODE_MODULES_DIR="/path/to/cache" node-linker-pro
  Windows (PowerShell):
    $env:EXTERNAL_NODE_MODULES_DIR="D:\\path\\to\\cache"; node-linker-pro

STOP-ON-FAILURE
  If link creation fails (e.g., Developer Mode off on Windows), the program
  stops with instructions so you don't accidentally sync node_modules.
`;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(HELP_TEXT);
  process.exit(0);
}

const isWin = process.platform === "win32";
const projectDir = process.cwd();
const nmPath = path.join(projectDir, "node_modules");

function defaultStoreDir() {
  if (isWin) {
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
async function isSymlink(p) {
  try { return (await fsp.lstat(p)).isSymbolicLink(); } catch { return false; }
}

function normalizeForCompare(p) {
  const n = path.resolve(p);
  return isWin ? n.toLowerCase() : n;
}

async function verifyLinkPointsTo(linkPath, wantTarget) {
  // Verify it's a symbolic link and points to the expected target
  const st = await fsp.lstat(linkPath).catch(() => null);
  if (!st || !st.isSymbolicLink()) return false;

  // readlink may return relative path; resolve against link's parent
  const raw = await fsp.readlink(linkPath).catch(() => null);
  if (!raw) return false;
  const resolved = path.resolve(path.dirname(linkPath), raw);

  return normalizeForCompare(resolved) === normalizeForCompare(wantTarget);
}

async function windowsJunctionPreflight() {
  // Try creating a throwaway junction to detect permission issues early
  const tmpRoot = path.join(os.tmpdir(), `nlp-preflight-${Date.now()}`);
  const tmpTarget = path.join(tmpRoot, "tgt");
  const tmpLink = path.join(tmpRoot, "lnk");

  try {
    await fsp.mkdir(tmpTarget, { recursive: true });
    await fsp.symlink(tmpTarget, tmpLink, "junction");
    const ok = await verifyLinkPointsTo(tmpLink, tmpTarget);
    return ok;
  } catch {
    return false;
  } finally {
    // Best-effort cleanup
    try { await fsp.rm(tmpLink, { force: true, recursive: true }); } catch {}
    try { await fsp.rm(tmpTarget, { force: true, recursive: true }); } catch {}
    try { await fsp.rm(tmpRoot, { force: true, recursive: true }); } catch {}
  }
}

async function runNpmInstall() {
  return new Promise((resolve, reject) => {
    console.log("Installing dependencies...");
    const proc = spawn("npm", ["install"], { stdio: "inherit", shell: true });
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`npm install failed (${code})`)));
  });
}

async function main() {
  // Preflight: ensure cache root exists
  await fsp.mkdir(storeDir, { recursive: true });

  // If already a link, ensure it's pointing to our target; install if empty
  if (await isSymlink(nmPath)) {
    const ok = await verifyLinkPointsTo(nmPath, target);
    if (!ok) {
      throw new Error(
        "node_modules is a symlink but not pointing to the expected cache target.\n" +
        `Expected: ${target}\n` +
        "Fix: remove node_modules and re-run."
      );
    }
    console.log(`node_modules already linked -> ${target}`);

    // If cache directory is missing/empty, install now
    const cacheExists = await exists(target);
    const files = cacheExists ? await fsp.readdir(target) : [];
    if (!cacheExists || files.length === 0) {
      await runNpmInstall();
    }
    return;
  }

  // If a real folder exists, move it to cache
  if (await exists(nmPath) && !(await isSymlink(nmPath))) {
    await fsp.mkdir(target, { recursive: true });
    await fsp.rename(nmPath, target);
    console.log(`Moved node_modules to ${target}`);
  } else {
    await fsp.mkdir(target, { recursive: true });
  }

  // Remove any leftover path at project node_modules
  try { await fsp.rm(nmPath, { recursive: true, force: true }); } catch {}

  // Windows: preflight junction capability
  if (isWin) {
    const ok = await windowsJunctionPreflight();
    if (!ok) {
      throw new Error(
        "❌ Failed preflight to create a junction (Windows).\n\n" +
        "This usually means Developer Mode is OFF or you lack permissions to create links.\n\n" +
        "Fix:\n" +
        "  1) Enable Developer Mode:\n" +
        "     Settings → Privacy & Security → For Developers → Developer Mode (On)\n" +
        "  2) Delete local node_modules if present:\n" +
        "     PowerShell: Remove-Item -Recurse -Force .\\node_modules\n" +
        "  3) Re-run: npm-setup (or node-linker-pro)\n"
      );
    }
  }

  // Create the link (junction on Windows, dir symlink elsewhere)
  const linkType = isWin ? "junction" : "dir";
  await fsp.symlink(target, nmPath, linkType).catch((err) => {
    // Fail fast with a helpful error
    const msg = isWin
      ? "Failed to create a junction for node_modules.\n" +
        "Likely causes:\n" +
        "  • Developer Mode is OFF\n" +
        "  • Insufficient permissions\n\n" +
        "Fix:\n" +
        "  1) Enable Developer Mode (Settings → Privacy & Security → For Developers)\n" +
        "  2) Remove local node_modules if present: Remove-Item -Recurse -Force .\\node_modules\n" +
        "  3) Re-run: npm-setup (or node-linker-pro)\n" +
        `Original error: ${err && err.message ? err.message : String(err)}`
      : "Failed to create a symlink for node_modules.\n" +
        "Try:\n" +
        "  • Ensure you have write permissions to the project folder\n" +
        "  • Remove any existing node_modules then re-run\n" +
        `Original error: ${err && err.message ? err.message : String(err)}`;
    throw new Error(msg);
  });

  // Verify the link points to the right target (STOP ON FAILURE)
  const linkedOk = await verifyLinkPointsTo(nmPath, target);
  if (!linkedOk) {
    // Clean up the bad link to avoid confusion
    try { await fsp.rm(nmPath, { recursive: true, force: true }); } catch {}
    throw new Error(
      "Link verification failed: node_modules is not a valid link to the cache target.\n" +
      `Expected target: ${target}\n` +
      (isWin
        ? "Hint: Ensure Developer Mode is enabled, then re-run."
        : "Hint: Check permissions and re-run.")
    );
  }

  console.log(`Linked node_modules -> ${target} (${linkType})`);

  // Install if cache empty
  const files = await fsp.readdir(target);
  if (files.length === 0) {
    await runNpmInstall();
  } else {
    console.log("Dependencies already cached — no install needed.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
