#!/usr/bin/env node
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const linker = join(__dirname, "link-node-modules.mjs");

function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: true });
    p.on("close", (code) => code === 0 ? resolve() : reject(code));
  });
}

(async () => {
  try {
    await run("node", [linker]);
    await run("npm", ["install"]);
  } catch (code) {
    process.exit(typeof code === "number" ? code : 1);
  }
})();
