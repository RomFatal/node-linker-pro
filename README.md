# linker-node-modules

[![npm version](https://img.shields.io/npm/v/linker-node-modules.svg)](https://www.npmjs.com/package/linker-node-modules)
[![npm downloads](https://img.shields.io/npm/dm/linker-node-modules.svg)](https://www.npmjs.com/package/linker-node-modules)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Keep `node_modules` out of cloud sync folders by linking them to a local cache.  
Cross-platform: macOS, Linux, and Windows.  
One-step global command: `npm setup`.

---

## Why this exists

If your projects live in cloud-synced folders like Google Drive, OneDrive, Dropbox, or iCloud, you’ve likely seen these problems:

- Slow syncs — `node_modules` can be hundreds of MBs.
- Wasted storage — dependencies don’t need to be backed up.
- CPU/bandwidth drain while coding.

---

## The solution

`linker-node-modules` moves your `node_modules` to a local cache folder outside  
cloud sync, then creates a link back so your project works exactly the same.

### Before

```text
/Google Drive/MyProject
  package.json
  node_modules/   ← huge folder synced to the cloud
```

### After

```text
/Google Drive/MyProject
  package.json
  node_modules → /Users/you/Library/Caches/node_modules_store/<hash>
```

`node_modules` is now stored locally, not synced — saving space and speeding up your workflow.

---

## Features

- Save cloud storage space.
- Faster project syncs.
- Cross-platform: macOS, Linux, Windows.
- Works with npm, Yarn, and pnpm.
- Auto-installs missing dependencies.
- No changes to your `package.json`.

---

## Installation

Install globally once:

```bash
npm i -g linker-node-modules
```

---

## Usage

From any project folder:

```bash
npm setup
```

This will:

1. Move `node_modules` to the cache folder.
2. Create a symlink (mac/Linux) or junction (Windows).
3. Install dependencies if the cache is empty.

If your npm version doesn’t support `npm setup`:

```bash
npm-setup
```

---

## Cache locations

| OS      | Default cache path                               |
| ------- | ------------------------------------------------ |
| macOS   | `~/Library/Caches/node_modules_store`            |
| Linux   | `~/.cache/node_modules_store`                    |
| Windows | `%LOCALAPPDATA%\Temp\node_modules_cache`       |

Custom path:

```bash
# mac/Linux
EXTERNAL_NODE_MODULES_DIR="/path/to/cache" npm setup
```

```powershell
# Windows PowerShell
$env:EXTERNAL_NODE_MODULES_DIR="D:\path\to\cache"; npm setup
```

---

## When to use it

- You keep projects in Google Drive, OneDrive, Dropbox, or iCloud.
- You want a cross-platform, cloud-safe workflow.
- You switch between multiple OSes and don’t want to re-download dependencies.

---

## When not to use it

- CI/CD pipelines (use `npm ci` instead).
- Highly isolated builds requiring separate installs for security.

---

## FAQ

**Will it break my project?**  
No. Your tools see `node_modules` normally.

**What if the cache is deleted?**  
Run `npm setup` again — dependencies will reinstall.

**Does it require admin rights on Windows?**  
No, if Developer Mode is enabled. Otherwise, Windows may ask.

---

## License

MIT — Free to use, modify, and share.

---

- **npm:** [linker-node-modules on npm](https://www.npmjs.com/package/linker-node-modules)  
- **GitHub:** [Your repository link here](https://github.com/yourname/yourrepo)
