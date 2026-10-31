const DEFAULT_ORREN_URL = "http://127.0.0.1:4173";
const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

export class OrrenUnavailableError extends Error {
  constructor(message = "Orren is not available.") {
    super(message);
    this.name = "OrrenUnavailableError";
  }
}

function getOrrenUrl(path: string): URL {
  let base: URL;
  try {
    base = new URL(process.env.ORREN_SERVICE_URL ?? DEFAULT_ORREN_URL);
  } catch {
    throw new OrrenUnavailableError("ORREN_SERVICE_URL is not a valid URL.");
  }
  if (base.protocol !== "https:" && !(base.protocol === "http:" && loopbackHosts.has(base.hostname))) {
    throw new OrrenUnavailableError("Orren must use HTTPS, or HTTP on loopback for local development.");
  }
  if (base.username || base.password || base.search || base.hash) {
    throw new OrrenUnavailableError("ORREN_SERVICE_URL must not contain credentials, query values, or fragments.");
  }
  const serviceToken = process.env.ORREN_SERVICE_TOKEN?.trim();
  if ((!loopbackHosts.has(base.hostname) || process.env.NODE_ENV === "production")
    && (!serviceToken || serviceToken.length < 32 || serviceToken.startsWith("replace-with-"))) {
    throw new OrrenUnavailableError("ORREN_SERVICE_TOKEN must contain at least 32 non-placeholder characters for remote Orren connections.");
  }
  base.pathname = `${base.pathname.replace(/\/$/, "")}${path}`;
  base.search = "";
  base.hash = "";
  return base;
}

async function requestOrren(path: string, method: "GET" | "POST", body?: unknown, extraHeaders: Record<string, string> = {}) {
  const url = getOrrenUrl(path);
  const headers = new Headers({ accept: "application/json", ...extraHeaders });
  if (body !== undefined) headers.set("content-type", "application/json");
  const serviceToken = process.env.ORREN_SERVICE_TOKEN;
  if (serviceToken?.trim()) headers.set("authorization", `Bearer ${serviceToken.trim()}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
  } catch {
    throw new OrrenUnavailableError("Could not reach the configured Orren service.");
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 2_000_000) {
    throw new OrrenUnavailableError("Orren returned a response larger than the 2 MB limit.");
  }
  if (!response.body) throw new OrrenUnavailableError("Orren returned an empty response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2_000_000) {
      await reader.cancel();
      throw new OrrenUnavailableError("Orren returned a response larger than the 2 MB limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { payload = null; }
  if (!response.ok) {
    if (response.status === 400 || response.status === 409) {
      const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Orren rejected the request.";
      throw Object.assign(new Error(message), { status: response.status, payload });
    }
    throw new OrrenUnavailableError(`Orren returned HTTP ${response.status}.`);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new OrrenUnavailableError("Orren returned an invalid response.");
  }
  return payload as Record<string, unknown>;
}

export async function callOrren(path: "/api/health" | "/api/field" | "/api/action", body?: unknown) {
  return requestOrren(path, body === undefined ? "GET" : "POST", body);
}

export async function readOrrenProject(projectId: string) {
  return requestOrren(`/v1/projects/${encodeURIComponent(projectId)}/snapshot`, "GET");
}

export async function commandOrrenProject(projectId: string, revision: number, idempotencyKey: string, action: unknown) {
  return requestOrren(`/v1/projects/${encodeURIComponent(projectId)}/commands`, "POST", { action }, {
    "if-match": `"${revision}"`, "idempotency-key": idempotencyKey,
  });
}
