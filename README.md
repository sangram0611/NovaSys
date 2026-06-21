# NOVASYS

**A professional command-line tool for developer system auditing and safe, sandboxed code file management.**

Built in plain Node.js with zero runtime dependencies. No `chalk`, no `commander`, no `inquirer` — just the standard library, used carefully.

---

## Table of Contents

1. [What Is NovaSys?](#what-is-Novasys)
2. [Why It Exists](#why-it-exists)
3. [Features](#features)
4. [Installation](#installation)
5. [Quick Start](#quick-start)
6. [Command Reference](#command-reference)
7. [Usage Examples](#usage-examples)
8. [How It Works (Code Flow)](#how-it-works-code-flow)
9. [Project Architecture](#project-architecture)
10. [Design Strategy](#design-strategy)
11. [Error Handling](#error-handling)
12. [Security Considerations](#security-considerations)
13. [Try It Yourself](#try-it-yourself)
14. [FAQ](#faq)
15. [License](#license)

---

## What Is NovaSys?

NovaSys is a two-in-one developer CLI:

| Capability | What it does |
|---|---|
| **`sysinfo`** | Inspects the current machine (OS, CPU, memory, Node version, a few environment variables) and prints a clean, readable report. |
| **`files`** | Lets you create, read, update, delete, and list code files — but only inside one dedicated `workspace/` folder, which it actively defends against being escaped. |

Think of it as a small, honest utility: it tells you about the machine you're on, and it gives you a safe little sandbox to manage files in, without ever touching anything outside of that sandbox.

## Why It Exists

Two everyday developer needs, solved simply:

- **"What does this machine look like?"** — Useful when filing a bug report, onboarding a new environment, or sanity-checking a CI runner. Instead of running five different commands (`uname -a`, `node -v`, `free -h`, `whoami`, `echo $PATH`...) and copy-pasting the output, `NovaSys sysinfo` gives you one clean report.
- **"I want a safe scratch space for code files."** — Sometimes you want a tool to manage files programmatically (e.g. as part of a larger automation) without worrying that a typo in a path will write or delete something important elsewhere on disk. NovaSys's `files` command is that scratch space — every operation is checked against the sandbox boundary before it touches the filesystem.

## Features

### System Information (`sysinfo`)
- Operating system type, platform, release version, and CPU architecture
- Hostname
- Installed Node.js version
- Home directory and username
- Memory: total, used, free, and used-percentage
- CPU: model name, core count, clock speed
- Exactly **four** environment variables — `PATH`, `HOME` (or `USERPROFILE` on Windows), `SHELL`, `NODE_ENV` — and nothing else. NovaSys never iterates over your full environment.
- **Crash-proof by design**: if any single piece of information fails to load (this happens more than you'd think — e.g. `os.userInfo()` throws in some Docker containers with no associated user), that one field falls back to a placeholder instead of taking down the whole report.

### File Management (`files`)
- `list` — see every file currently in the workspace, with size and last-modified time
- `create` — add a new file with optional starting content
- `read` — print a file's contents
- `update` — overwrite a file's contents
- `delete` — remove a file, with a confirmation prompt first
- **Sandboxing**: every single path is resolved and checked before any disk operation. `../../etc/passwd`, `/etc/passwd`, and similar escape attempts are rejected outright — not by accident, but by an explicit check.
- **Extension allow-list**: `create` and `update` only accept recognizable code/text extensions (`.js`, `.py`, `.md`, `.json`, etc.), so the tool can't be turned into a generic binary-file writer.
- **Confirm before destroy**: deleting a file asks "are you sure?" by default. There's a `--force` flag for when you genuinely want to skip that (e.g. inside a script), but nothing gets deleted silently by accident.

### Command-Line Experience
- Colored, aligned output — implemented by hand in about 60 lines, no dependency needed
- Output automatically degrades to plain text when piped to a file, run in CI, or when `NO_COLOR` is set
- Clear ✔ (success), ✘ (error), ⚠ (warning), ℹ (info) markers so you can scan results at a glance
- Every error comes with a plain-English explanation and, where relevant, the correct usage — never a raw stack trace

## Installation

**Prerequisites:** Node.js 18 or newer (check with `node -v`).

```bash
# 1. Get the code
git clone <your-repo-url> NovaSys
cd NovaSys

# 2. There's nothing to install — NovaSys has zero dependencies —
#    but running this keeps npm tooling happy and sets up node_modules/.bin if you add anything later.
npm install
```

You can run it two ways:

```bash
# Option A — run directly with Node
node src/index.js sysinfo

# Option B — install it as a global command on your machine
npm link
NovaSys sysinfo
```

From here on, this README uses `NovaSys` as shorthand for either `NovaSys` (if linked) or `node src/index.js` (if not).

## Quick Start

```bash
NovaSys sysinfo                 # see your system report
NovaSys files list               # see what's in the workspace
NovaSys files create hello.js --content "console.log('hi');"
NovaSys files read hello.js
NovaSys files delete hello.js
```

## Command Reference

| Command | Arguments | Flags | Description |
|---|---|---|---|
| `NovaSys sysinfo` | — | — | Prints the full system report. |
| `NovaSys files list` | — | — | Lists every file in the workspace with size and last-modified date. |
| `NovaSys files create <filename>` | filename (required) | `--content "text"` | Creates a new file. Fails if the file already exists. |
| `NovaSys files read <filename>` | filename (required) | — | Prints the file's contents. |
| `NovaSys files update <filename>` | filename (required) | `--content "text"` | Overwrites the file's contents. Fails if the file doesn't exist yet. |
| `NovaSys files delete <filename>` | filename (required) | `--force` | Deletes the file. Prompts for confirmation unless `--force` is passed. |
| `NovaSys help` | — | — | Shows usage help. |

**About `--content`:** if you don't pass `--content`, NovaSys checks whether anything was piped into it on `stdin`. If so, it uses that as the file's content. If neither is provided, it creates/updates the file as empty.

```bash
# These two are equivalent:
NovaSys files create notes.md --content "# Hello"
echo "# Hello" | NovaSys files create notes.md
```

## Usage Examples

### Checking your system
```bash
$ NovaSys sysinfo

────────────────────────────────────────
  NovaSys — System Information
────────────────────────────────────────

  Operating System
  Type             Linux
  Platform         linux
  Release          6.18.5
  Architecture     x64
  Hostname         my-machine

  Node.js
  Version          v22.22.2

  User
  Username         alex
  Home Dir         /home/alex

  CPU
  Model            Intel(R) Xeon(R) Processor @ 2.10GHz
  Cores            4

  Memory
  Total            7982 MB
  Used             2240 MB (28%)
  Free             5742 MB

  Environment Variables
  PATH             /usr/local/bin:/usr/bin:/bin...
  HOME             /home/alex
  SHELL            /bin/bash
  NODE_ENV         not set
```

### Managing files
```bash
$ NovaSys files create demo.js --content "console.log('hello');"
✔ Created demo.js (23 B)
ℹ Path: /path/to/NovaSys/workspace/demo.js

$ NovaSys files list
────────────────────────────────────────
  NovaSys — Workspace Files
────────────────────────────────────────
  demo.js               23 B  6/21/2026, 10:02:11 AM
  welcome.md           293 B  6/20/2026, 8:18:16 AM

$ NovaSys files read demo.js
────────────────────────────────────────
  File: demo.js
────────────────────────────────────────
console.log('hello');

$ NovaSys files delete demo.js
⚠  Delete "demo.js" permanently? (y/N) y
✔ Deleted demo.js
```

### What happens if you try to escape the sandbox
```bash
$ NovaSys files read ../../etc/passwd
✘ "../../etc/passwd" resolves outside the workspace directory and was blocked.

$ NovaSys files create /tmp/evil.js --content "x"
✘ Absolute paths are not allowed. Use a name relative to the workspace.

$ NovaSys files create payload.exe --content "x"
✘ Extension ".exe" is not permitted for write operations. Allowed: .js, .mjs, .cjs, .ts, ...
```

## How It Works (Code Flow)

Here's what happens, end to end, when you run a command:

1. **`src/index.js` starts.** It reads `process.argv` — the raw command-line arguments — and splits them into a command (`sysinfo` or `files`), and for `files`, a subcommand (`list`, `create`, `read`, `update`, `delete`).

2. **Flags get parsed.** A small hand-written `parseArgs()` function separates positional arguments (like the filename) from `--flag` options (like `--content` or `--force`). This is intentionally simple — the CLI's surface area is small enough that a parsing library would be more code than it saves.

3. **The matching handler runs.** Each subcommand has a small `run*` function in `index.js` — e.g. `runFilesCreate()`. It:
   - Checks that required arguments were actually given (and throws a friendly error with usage instructions if not),
   - Calls into the relevant module to do the real work,
   - Passes the result to the formatter for display.

4. **The "doing" modules never print anything.** `system/systemInfo.js` and `files/fileManager.js` are both pure: they take input, do work, and either return a result or throw an error. They never call `console.log`. This separation matters — it's what makes the system module trivially "crash-proof" and easy to test, because nothing about the console or terminal leaks into the logic.

5. **Every file path goes through one gatekeeper.** Before `fileManager.js` touches the filesystem with a path the user typed, it calls `resolveWorkspacePath()` in `utils/validator.js`. This function turns the given filename into an absolute path and checks that the result is genuinely inside the `workspace/` folder. If it isn't, it throws — and the file operation never happens.

6. **Display is a separate concern.** `utils/formatter.js` is the only file that knows about ANSI color codes, padding, and layout. It exposes small helpers like `printSuccess()`, `printError()`, and a dedicated `printSystemInfo()` that knows how to lay out the system report nicely.

7. **Errors are caught in exactly one place.** `main()` in `index.js` wraps the whole command dispatch in a single `try/catch`. Expected, "this is the user's fault" errors are a custom `ValidationError` class and get a short, friendly red message. Anything else (an unexpected OS-level error, say) gets a generic "Unexpected error" message. Either way, the program exits cleanly with exit code `1` — it never crashes with a raw JavaScript stack trace.

## Project Architecture

```
NovaSys/
├── src/
│   ├── index.js                # CLI entry point: parses args, routes commands, catches errors
│   ├── system/
│   │   └── systemInfo.js       # Pure data collection — OS, CPU, memory, env. Never prints.
│   ├── files/
│   │   └── fileManager.js      # CRUD logic. Delegates ALL path safety to validator.js.
│   └── utils/
│       ├── formatter.js        # ANSI colors, layout, the system-report renderer
│       └── validator.js        # The security boundary: workspace path resolution
├── workspace/                   # The sandbox. The only folder file commands can touch.
│   └── welcome.md
├── package.json
└── README.md
```

**Dependency direction is one-way:**

```
index.js
   │
   ├──► system/systemInfo.js  ──► (nothing — it's a leaf module)
   │
   └──► files/fileManager.js  ──► utils/validator.js
            │
            └──► utils/formatter.js (used by index.js for display, not by fileManager.js itself)
```

Neither `systemInfo.js` nor `fileManager.js` ever imports from `index.js`. And critically, `fileManager.js` never reaches into `node:fs` with a raw, user-supplied path — it always goes through `validator.js` first.

## Design Strategy

A few deliberate choices, and the reasoning behind them:

- **Zero dependencies.** This is a tool that reads system internals and writes to disk — exactly the kind of tool where "what packages does this pull in, and do I trust them?" is a fair question to ask. An empty `dependencies` field in `package.json` is a small but real signal that there's no extra surface area to worry about.
- **Data and display are separate.** `systemInfo.js` and `fileManager.js` only ever return values or throw — they never print. This single decision is what makes two of the harder requirements (*"never crash"* and *"return structured JSON internally"*) fall out naturally, because the data layer doesn't have to think about the terminal at all.
- **One gatekeeper, not many guards.** Rather than checking "is this path safe?" in five different places, there's exactly one function (`resolveWorkspacePath`) that every write or read funnels through. One function to get right, one function to test, one place to look if something's ever wrong.
- **When in doubt, don't.** If there's no `--force` flag on a delete, or no terminal to prompt a user in, NovaSys doesn't guess "yes" — it does nothing destructive and tells you why.

## Error Handling

| Situation | What happens |
|---|---|
| Missing required argument (e.g. `files create` with no filename) | `ValidationError` → red message showing correct usage |
| Path tries to escape the workspace | `ValidationError` → red message naming the blocked path |
| File doesn't exist (`read`, `update`, `delete`) | `ValidationError` → "File ... does not exist" |
| File already exists (`create`) | `ValidationError` → "File ... already exists. Use update." |
| Disallowed file extension (`create`, `update`) | `ValidationError` → lists the allowed extensions |
| A single `sysinfo` field fails to load (e.g. no CPU info available) | That field shows a placeholder; the rest of the report still prints |
| Any other unexpected error (e.g. a permissions error from the OS) | Generic "Unexpected error: ..." message, no stack trace shown |

In every case, the process exits with status code `1` on failure and `0` on success, so NovaSys behaves correctly if you ever script around it.

## Security Considerations

- **The sandbox can't be moved.** The `workspace/` directory's location is calculated from the source file's own location (using `import.meta.url`), not from your current working directory. Running the CLI from a different folder, or with a different shell `cd`, doesn't change which directory is protected.
- **Path traversal is checked properly, not guessed at.** NovaSys doesn't just look for the string `".."` in the input — it resolves the full absolute path and then asks Node's own `path.relative()` whether that result is still inside the workspace. Absolute paths and filenames containing null bytes are rejected immediately, before any resolution happens.
- **Writes are limited to code/text files.** The extension allow-list means `create` and `update` can't be used to drop arbitrary binaries (`.exe`, `.sh`-disguised-as-something-else, etc.) into the sandbox.
- **Deleting always asks first — unless you explicitly say otherwise.** And if there's no interactive terminal to ask in (for example, the command is running inside a script with no TTY attached), NovaSys refuses to guess. It will not auto-confirm; you must pass `--force`.
- **The environment is read narrowly.** `sysinfo` reads exactly four named variables. It never loops over `process.env` as a whole, so anything else sitting in your environment (API keys, tokens, etc.) is never collected, displayed, or logged.
- **No networking, no persistence, no shell execution.** NovaSys only touches `node:os`, `node:fs`, and `process.env` for reading, and only ever writes inside `workspace/`. It doesn't spawn child processes, open any sockets, or write to any startup/profile files.

## Try It Yourself

A few commands to verify the safety claims above for yourself:

```bash
# This should be blocked:
NovaSys files read ../../etc/passwd

# This should also be blocked:
NovaSys files create /tmp/whatever.js --content "test"

# This should ask for confirmation, not delete immediately:
NovaSys files create scratch.txt --content "temp"
NovaSys files delete scratch.txt
```

<img width="2400" height="600" alt="image" src="https://github.com/user-attachments/assets/d7607f7e-3e3b-4076-bf19-6cbda30f4e65" />

