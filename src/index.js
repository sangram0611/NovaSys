#!/usr/bin/env node
import readline from 'node:readline';
import { getSystemInfo } from './system/systemInfo.js';
import * as fileManager from './files/fileManager.js';
import { ValidationError } from './utils/validator.js';
import {
  color,
  printHeader,
  printRow,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printSystemInfo,
  formatBytes,
} from './utils/formatter.js';

const HELP_TEXT = `
${color.bold('SysScope')} — developer system & workspace auditing CLI

${color.bold('Usage:')}
  sysscope sysinfo
  sysscope files list
  sysscope files create <filename> [--content "text"]
  sysscope files read <filename>
  sysscope files update <filename> [--content "text"]
  sysscope files delete <filename> [--force]
  sysscope help

${color.bold('Examples:')}
  sysscope sysinfo
  sysscope files create notes.md --content "# Hello"
  sysscope files read notes.md
  echo "new content" | sysscope files update notes.md
  sysscope files delete notes.md

${color.dim('All file operations are sandboxed to the ./workspace directory.')}
`;

// --- argument parsing -------------------------------------------------

function parseArgs(args) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const eqIndex = arg.indexOf('=');
    if (eqIndex !== -1) {
      flags[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      continue;
    }

    const next = args[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[arg.slice(2)] = next;
      i++;
    } else {
      flags[arg.slice(2)] = true;
    }
  }

  return { positional, flags };
}

async function readStdin() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks).toString('utf8') : null;
}

async function resolveContent(flags) {
  if (typeof flags.content === 'string') return flags.content;
  const piped = await readStdin();
  return piped ?? '';
}

async function confirm(question) {
  if (!process.stdin.isTTY) return false; // never hang/auto-confirm in non-interactive contexts
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

// --- command handlers ---------------------------------------------------

async function runSysinfo() {
  printHeader('SysScope — System Information');
  const info = await getSystemInfo();
  printSystemInfo(info);
}

async function runFilesList() {
  printHeader('SysScope — Workspace Files');
  const files = await fileManager.listFiles();

  if (files.length === 0) {
    printInfo('Workspace is empty. Create one with: sysscope files create <filename>');
    return;
  }

  for (const file of files) {
    printRow(file.name, `${formatBytes(file.sizeBytes).padStart(9)}  ${color.dim(file.modified.toLocaleString())}`);
  }
}

async function runFilesCreate(positional, flags) {
  const [filename] = positional;
  if (!filename) throw new ValidationError('Usage: sysscope files create <filename> [--content "text"]');

  const content = await resolveContent(flags);
  const fullPath = await fileManager.createFile(filename, content);
  printSuccess(`Created ${color.bold(filename)} (${formatBytes(Buffer.byteLength(content))})`);
  printInfo(`Path: ${fullPath}`);
}

async function runFilesRead(positional) {
  const [filename] = positional;
  if (!filename) throw new ValidationError('Usage: sysscope files read <filename>');

  const content = await fileManager.readFile(filename);
  printHeader(`File: ${filename}`);
  console.log(content.length > 0 ? content : color.dim('(empty file)'));
}

async function runFilesUpdate(positional, flags) {
  const [filename] = positional;
  if (!filename) throw new ValidationError('Usage: sysscope files update <filename> [--content "text"]');

  const content = await resolveContent(flags);
  const fullPath = await fileManager.updateFile(filename, content);
  printSuccess(`Updated ${color.bold(filename)} (${formatBytes(Buffer.byteLength(content))})`);
  printInfo(`Path: ${fullPath}`);
}

async function runFilesDelete(positional, flags) {
  const [filename] = positional;
  if (!filename) throw new ValidationError('Usage: sysscope files delete <filename> [--force]');

  if (!flags.force) {
    const confirmed = await confirm(`${color.yellow('⚠')}  Delete "${filename}" permanently? (y/N) `);
    if (!confirmed) {
      printWarning('Delete cancelled. Pass --force to skip this prompt in scripts.');
      return;
    }
  }

  const fullPath = await fileManager.deleteFile(filename);
  printSuccess(`Deleted ${color.bold(filename)}`);
  printInfo(`Path: ${fullPath}`);
}

// --- dispatch -------------------------------------------------------------

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || ['help', '--help', '-h'].includes(command)) {
    console.log(HELP_TEXT);
    return;
  }

  try {
    if (command === 'sysinfo') {
      await runSysinfo();
      return;
    }

    if (command === 'files') {
      const [subcommand, ...subArgs] = rest;
      const { positional, flags } = parseArgs(subArgs);

      switch (subcommand) {
        case 'list':
          await runFilesList();
          break;
        case 'create':
          await runFilesCreate(positional, flags);
          break;
        case 'read':
          await runFilesRead(positional);
          break;
        case 'update':
          await runFilesUpdate(positional, flags);
          break;
        case 'delete':
          await runFilesDelete(positional, flags);
          break;
        default:
          printError(`Unknown files subcommand: "${subcommand ?? ''}"`);
          console.log(HELP_TEXT);
          process.exitCode = 1;
      }
      return;
    }

    printError(`Unknown command: "${command}"`);
    console.log(HELP_TEXT);
    process.exitCode = 1;
  } catch (err) {
    if (err instanceof ValidationError) {
      printError(err.message);
    } else {
      printError(`Unexpected error: ${err.message}`);
    }
    process.exitCode = 1;
  }
}

main();
