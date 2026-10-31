export type GitHubCommit = { sha: string; url: string };
export class GitHubUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "GitHubUnavailableError"; }
}

function repositoryPath(value: string): string {
  if (!/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(value)) throw new Error("GitHub repository must use owner/name format.");
  return value;
}

function branchName(value: string): string {
  const invalid = !/^[A-Za-z0-9._/-]{1,128}$/.test(value) || value.startsWith("/") || value.endsWith("/")
    || value.includes("..") || value.includes("//") || value.includes("@{") || /[~^:?*\\\[\s]/.test(value)
    || value.split("/").some((part) => part.startsWith(".") || part.endsWith(".lock"));
  if (invalid) throw new Error("GitHub branch name is invalid.");
  return value;
}

async function readGitHubJson(path: string): Promise<Record<string, unknown>> {
  const headers = new Headers({ accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "HAEL-Studio" });
  const token = process.env.HAEL_GITHUB_TOKEN?.trim();
  if (token) {
    if (token.length < 20 || token.startsWith("replace-with-")) throw new Error("HAEL_GITHUB_TOKEN is invalid.");
    headers.set("authorization", `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(new URL(path, "https://api.github.com"), { headers, signal: AbortSignal.timeout(8000), redirect: "error" });
  } catch {
    throw new GitHubUnavailableError("GitHub could not be reached.");
  }
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 256_000) throw new GitHubUnavailableError("GitHub returned an oversized response.");
  if (!response.body) throw new GitHubUnavailableError("GitHub returned an empty response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 256_000) {
      await reader.cancel();
      throw new GitHubUnavailableError("GitHub returned an oversized response.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const text = new TextDecoder().decode(bytes);
  let payload: unknown;
  try { payload = JSON.parse(text) as unknown; } catch { payload = null; }
  if (!response.ok) {
    if (response.status === 404) throw new Error("GitHub repository or commit was not found. Check repository access and HAEL_GITHUB_TOKEN.");
    if (response.status === 401 || response.status === 403) throw new GitHubUnavailableError("GitHub denied access. Check HAEL_GITHUB_TOKEN permissions and rate limits.");
    throw new GitHubUnavailableError(`GitHub returned HTTP ${response.status}.`);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw new GitHubUnavailableError("GitHub returned an invalid response.");
  return payload as Record<string, unknown>;
}

export async function resolveGitHubCommit(repository: string, ref: string): Promise<GitHubCommit> {
  const safeRepository = repositoryPath(repository);
  if (!/^[A-Za-z0-9._/-]{1,128}$/.test(ref) || ref.split("/").some((part) => part === ".." || part === ".")) throw new Error("GitHub ref is invalid.");
  const payload = await readGitHubJson(`/repos/${safeRepository}/commits/${encodeURIComponent(ref)}`);
  if (typeof payload.sha !== "string" || !/^[a-f0-9]{40}$/i.test(payload.sha) || typeof payload.html_url !== "string") {
    throw new Error("GitHub returned an invalid commit identity.");
  }
  return { sha: payload.sha.toLowerCase(), url: payload.html_url };
}

export async function resolveGitHubBranchCommit(repository: string, branch: string, requestedRef: string): Promise<GitHubCommit> {
  const safeRepository = repositoryPath(repository);
  const safeBranch = branchName(branch);
  const [branchHead, requestedCommit] = await Promise.all([
    resolveGitHubCommit(safeRepository, safeBranch),
    resolveGitHubCommit(safeRepository, requestedRef),
  ]);
  const comparison = await readGitHubJson(`/repos/${safeRepository}/compare/${requestedCommit.sha}...${branchHead.sha}`);
  const status = comparison.status;
  if (status !== "ahead" && status !== "identical") {
    throw new Error("The requested source commit is not contained in the connected branch.");
  }
  return requestedCommit;
}

export function validateGitHubRepository(repository: string): string {
  return repositoryPath(repository);
}

export function validateGitHubBranch(branch: string): string {
  return branchName(branch);
}

