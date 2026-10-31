import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, opendir, open, readFile, realpath, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";

const execFileAsync = promisify(execFile);
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 1000;
const MAX_EXTRACTED_BYTES = 256 * 1024 * 1024;
const githubRepository = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i;

export type TerminalEntry = { name: string; kind: "folder" | "file"; size?: number };
export type TerminalSnapshot = { workspace: string; cwd: string; entries: TerminalEntry[] };
export type ParsedTerminalCommand = { action: "pwd" | "ls" | "cd" | "unzip" | "clone"; path?: string; repository?: string };

export class TerminalCommandError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); this.name = "TerminalCommandError"; }
}

function workspaceRoot() {
  const configured = process.env.HAEL_WORKSPACE_ROOT?.trim();
  if (configured) {
    if (process.env.NODE_ENV === "production" && !path.isAbsolute(configured)) throw new TerminalCommandError("HAEL_WORKSPACE_ROOT must be an absolute path in production.", 503);
    return path.resolve(configured);
  }
  if (process.env.NODE_ENV === "production") throw new TerminalCommandError("The isolated project workspace is not configured.", 503);
  return path.resolve(process.cwd(), ".hael-workspaces");
}

async function ensureProjectRoot(projectId: string) {
  const root = workspaceRoot();
  await mkdir(root, { recursive: true });
  const safeRoot = await realpath(root);
  const projectRoot = path.join(safeRoot, projectId);
  try {
    const info = await lstat(projectRoot);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new TerminalCommandError("The project workspace is not a safe directory.", 409);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(projectRoot, { recursive: false });
  }
  return { root: safeRoot, projectRoot };
}

function normalizeRelative(input: string, cwd = ".") {
  if (input.includes("\0") || input.includes("\\") || input.startsWith("/") || /^[A-Za-z]:/.test(input)) throw new TerminalCommandError("Use a relative path inside this project, with forward slashes.");
  const resolved = path.posix.normalize(path.posix.join(cwd, input || "."));
  if (resolved === ".." || resolved.startsWith("../") || path.posix.isAbsolute(resolved)) {
    throw new TerminalCommandError("That path leaves this project workspace.");
  }
  return resolved === "." ? "" : resolved;
}

async function safePath(projectRoot: string, relative: string, allowMissing = false) {
  const fullPath = path.resolve(projectRoot, ...relative.split("/").filter(Boolean));
  if (fullPath !== projectRoot && !fullPath.startsWith(`${projectRoot}${path.sep}`)) throw new TerminalCommandError("That path leaves this project workspace.");
  const segments = relative.split("/").filter(Boolean);
  let cursor = projectRoot;
  for (let index = 0; index < segments.length; index += 1) {
    cursor = path.join(cursor, segments[index]!);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) throw new TerminalCommandError("This action does not follow symbolic links.", 409);
      if (index < segments.length - 1 && !info.isDirectory()) throw new TerminalCommandError("A path segment is not a folder.", 409);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && allowMissing) break;
      throw error;
    }
  }
  return fullPath;
}

export async function readTerminalSnapshot(projectId: string, requestedCwd = "") : Promise<TerminalSnapshot> {
  const { projectRoot } = await ensureProjectRoot(projectId);
  const cwd = normalizeRelative(requestedCwd);
  const folder = await safePath(projectRoot, cwd);
  const info = await stat(folder).catch(() => null);
  if (!info?.isDirectory()) throw new TerminalCommandError("That folder does not exist in this project.", 404);
  const entries: TerminalEntry[] = [];
  const directory = await opendir(folder);
  for await (const entry of directory) {
    if (entry.name.startsWith(".")) continue;
    const entryInfo = await lstat(path.join(folder, entry.name));
    if (entryInfo.isSymbolicLink()) continue;
    entries.push({ name: entry.name, kind: entryInfo.isDirectory() ? "folder" : "file", ...(entryInfo.isFile() ? { size: entryInfo.size } : {}) });
  }
  entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1));
  return { workspace: `/projects/${projectId}`, cwd: cwd ? `/projects/${projectId}/${cwd}` : `/projects/${projectId}`, entries };
}

export function parseTerminalCommand(input: string): ParsedTerminalCommand {
  const command = input.trim().replace(/[.!?]+$/, "");
  if (/^(pwd|where am i|show current (?:working )?directory|what directory am i in)$/i.test(command)) return { action: "pwd" };
  if (/^(ls|dir|list files|show files|list this folder|what is in this folder)$/i.test(command)) return { action: "ls" };
  const cd = command.match(/^(?:cd|go to|open folder|change directory to)\s+["']?(.+?)["']?$/i);
  if (cd) return { action: "cd", path: cd[1]!.trim() };
  const unzip = command.match(/^(?:unzip|extract|unpack)\s+["']?(.+?\.zip)["']?$/i);
  if (unzip) return { action: "unzip", path: unzip[1]!.trim() };
  const clone = command.match(/^(?:git\s+clone|clone(?:\s+(?:the\s+)?repository)?)\s+["']?(https:\/\/github\.com\/[^\s"']+|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?)["']?$/i);
  if (clone) {
    let repository = clone[1]!;
    if (!repository.startsWith("https://")) repository = `https://github.com/${repository.replace(/\.git$/i, "")}.git`;
    if (!githubRepository.test(repository)) throw new TerminalCommandError("Clone a public GitHub repository using owner/repository or its https://github.com URL.");
    return { action: "clone", repository };
  }
  throw new TerminalCommandError("I do not know that command yet. Try pwd, ls, cd, unzip, or git clone. Open Help for examples.");
}

function zipPath(value: string) {
  const normalized = value.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) || normalized.split("/").some((part) => part === ".." || part === ".")) {
    throw new TerminalCommandError("The archive contains a path outside the project folder.", 400);
  }
  return normalized.replace(/\/$/, "");
}

type ZipItem = { name: string; flags: number; method: number; compressedSize: number; size: number; crc: number; offset: number; directory: boolean; unixMode: number };

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function readZipDirectory(buffer: Buffer): ZipItem[] {
  if (buffer.length < 22 || buffer.length > MAX_ARCHIVE_BYTES) throw new TerminalCommandError("The ZIP file is empty or larger than 64 MB.");
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new TerminalCommandError("This is not a supported ZIP archive.");
  const count = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  let offset = buffer.readUInt32LE(eocd + 16);
  if (count > MAX_ARCHIVE_FILES || count === 0xffff || centralSize === 0xffffffff || offset === 0xffffffff || offset + centralSize > buffer.length) throw new TerminalCommandError("This ZIP archive is too large or uses an unsupported ZIP64 format.");
  const items: ZipItem[] = [];
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new TerminalCommandError("This ZIP archive has a damaged directory.");
    const madeBy = buffer.readUInt16LE(offset + 4);
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const unixMode = buffer.readUInt32LE(offset + 38) >>> 16;
    const localOffset = buffer.readUInt32LE(offset + 42);
    const rawName = buffer.subarray(offset + 46, offset + 46 + nameLength);
    const name = zipPath(rawName.toString("utf8"));
    if (flags & 1 || ![0, 8].includes(method) || compressedSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) throw new TerminalCommandError("This ZIP contains encrypted or unsupported entries.");
    if (madeBy >> 8 === 3 && (unixMode & 0o170000) === 0o120000) throw new TerminalCommandError("ZIP entries that are symbolic links are not supported.");
    items.push({ name, flags, method, compressedSize, size, crc, offset: localOffset, directory: rawName.toString().endsWith("/"), unixMode });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (items.reduce((total, item) => total + item.size, 0) > MAX_EXTRACTED_BYTES) throw new TerminalCommandError("The extracted archive would exceed 256 MB.");
  return items;
}

async function extractZip(projectRoot: string, cwd: string, archivePath: string) {
  const relativeArchive = normalizeRelative(archivePath, cwd);
  const absoluteArchive = await safePath(projectRoot, relativeArchive);
  const buffer = await readFile(absoluteArchive);
  const items = readZipDirectory(buffer);
  const base = path.posix.dirname(relativeArchive) === "." ? "" : path.posix.dirname(relativeArchive);
  const outputs = items.map((item) => ({ ...item, relative: normalizeRelative([base, item.name].filter(Boolean).join("/")) }));
  for (const item of outputs) {
    const target = await safePath(projectRoot, item.relative, true);
    const existing = await lstat(target).catch(() => null);
    if (existing && !item.directory) throw new TerminalCommandError(`Cannot overwrite “${item.relative}”. Move or remove it first.`, 409);
  }
  const written: string[] = [];
  try {
    for (const item of outputs) {
      const target = await safePath(projectRoot, item.relative, true);
      if (item.directory) { await mkdir(target, { recursive: true }); continue; }
      await mkdir(path.dirname(target), { recursive: true });
      const local = item.offset;
      if (buffer.readUInt32LE(local) !== 0x04034b50) throw new TerminalCommandError("This ZIP has a damaged file entry.");
      const nameLength = buffer.readUInt16LE(local + 26);
      const extraLength = buffer.readUInt16LE(local + 28);
      const dataStart = local + 30 + nameLength + extraLength;
      const compressed = buffer.subarray(dataStart, dataStart + item.compressedSize);
      if (dataStart + item.compressedSize > buffer.length) throw new TerminalCommandError("This ZIP has a truncated file entry.");
      const contents = item.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: MAX_EXTRACTED_BYTES });
      if (contents.length !== item.size || crc32(contents) !== item.crc) throw new TerminalCommandError("A ZIP entry failed its size or integrity check.");
      const file = await open(target, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      try { await file.writeFile(contents); } finally { await file.close(); }
      written.push(target);
    }
  } catch (error) {
    await Promise.all(written.map((file) => rm(file, { force: true })));
    throw error;
  }
  return outputs.filter((item) => !item.directory).map((item) => item.relative);
}

export async function executeTerminalCommand(projectId: string, cwd: string, command: ParsedTerminalCommand) {
  const { projectRoot } = await ensureProjectRoot(projectId);
  const workingDirectory = normalizeRelative(cwd);
  if (command.action === "pwd") return { cwd: workingDirectory, message: (await readTerminalSnapshot(projectId, workingDirectory)).cwd };
  if (command.action === "ls") {
    const snapshot = await readTerminalSnapshot(projectId, workingDirectory);
    return { cwd: workingDirectory, message: snapshot.entries.length ? snapshot.entries.map((entry) => `${entry.kind === "folder" ? "▸" : "·"} ${entry.name}`).join("\n") : "This folder is empty." };
  }
  if (command.action === "cd") {
    const nextCwd = normalizeRelative(command.path ?? "", workingDirectory);
    const nextSnapshot = await readTerminalSnapshot(projectId, nextCwd);
    return { cwd: nextCwd, message: `Now in ${nextSnapshot.cwd}` };
  }
  if (command.action === "unzip") {
    const files = await extractZip(projectRoot, workingDirectory, command.path ?? "");
    return { cwd: workingDirectory, message: `Extracted ${files.length} file${files.length === 1 ? "" : "s"}:\n${files.slice(0, 12).join("\n")}${files.length > 12 ? `\n…and ${files.length - 12} more` : ""}` };
  }
  const repository = command.repository ?? "";
  const match = githubRepository.exec(repository);
  if (!match) throw new TerminalCommandError("Only public GitHub HTTPS repositories can be cloned.");
  const destination = `${match[2]!.replace(/\.git$/i, "")}`;
  if (!/^[A-Za-z0-9_.-]+$/.test(destination) || destination === "." || destination === "..") throw new TerminalCommandError("The repository name is not a safe folder name.");
  const relativeDestination = normalizeRelative(destination, workingDirectory);
  const absoluteDestination = await safePath(projectRoot, relativeDestination, true);
  if (await lstat(absoluteDestination).catch(() => null)) throw new TerminalCommandError(`“${destination}” already exists here. Choose another folder first.`, 409);
  try {
    await execFileAsync("git", ["clone", "--depth", "1", "--", repository, absoluteDestination], { timeout: 120_000, maxBuffer: 1024 * 1024, windowsHide: true });
  } catch (error) {
    await rm(absoluteDestination, { recursive: true, force: true }).catch(() => undefined);
    const message = error instanceof Error && "stderr" in error ? String((error as Error & { stderr?: string }).stderr).trim() : "Git could not clone that repository.";
    throw new TerminalCommandError(message.slice(0, 300) || "Git could not clone that repository.", 502);
  }
  return { cwd: workingDirectory, message: `Cloned ${repository} into ${relativeDestination}.` };
}

export async function saveTerminalArchive(projectId: string, cwd: string, name: string, contents: Buffer) {
  if (!name.toLowerCase().endsWith(".zip") || name.includes("/") || name.includes("\\") || name === ".zip" || name.includes("\0")) {
    throw new TerminalCommandError("Choose a ZIP archive with a simple file name.");
  }
  if (!contents.length || contents.length > MAX_ARCHIVE_BYTES) throw new TerminalCommandError("ZIP archives must be between 1 byte and 64 MB.");
  const { projectRoot } = await ensureProjectRoot(projectId);
  const folder = normalizeRelative(cwd);
  const destination = normalizeRelative(name, folder);
  const absolute = await safePath(projectRoot, destination, true);
  if (await lstat(absolute).catch(() => null)) throw new TerminalCommandError(`“${name}” already exists in this folder.`, 409);
  const file = await open(absolute, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try { await file.writeFile(contents); } finally { await file.close(); }
  return { cwd: folder, name, size: contents.length };
}
