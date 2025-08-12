#!/usr/bin/env node
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const linker = join(__dirname, "node-linker-pro.mjs");

function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: true });
    p.on("close", (code) => (code === 0 ? resolve() : reject(code)));
  });
}

(async () => {
  try {
    // Link node_modules (will STOP on failure and print helpful steps)
    await run("node", [linker]);

    // Always run npm install once (no-op if already installed; ensures lockfile integrity)
    await run("npm", ["install"]);
  } catch (code) {
    process.exit(typeof code === "number" ? code : 1);
  }
})();
