import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type RuntimeCapability = { projectId: string; buildId: string; expiresAt: number };

function secret(): string {
  const value = process.env.HAEL_RUNTIME_PROVENANCE_SECRET?.trim();
  if (!value || value.length < 32 || value.startsWith("replace-with-")) {
    throw new Error("HAEL_RUNTIME_PROVENANCE_SECRET must contain at least 32 non-placeholder characters.");
  }
  return value;
}

function signature(encodedPayload: string): Buffer {
  return createHmac("sha256", secret()).update(`hael-runtime-v1.${encodedPayload}`).digest();
}

export function issueRuntimeCapability(projectId: string, buildId: string, lifetimeSeconds = 30 * 24 * 60 * 60): string {
  const payload: RuntimeCapability & { version: 1; nonce: string } = {
    version: 1, projectId, buildId, expiresAt: Math.floor(Date.now() / 1000) + lifetimeSeconds,
    nonce: randomBytes(12).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `hael-runtime-v1.${encoded}.${signature(encoded).toString("base64url")}`;
}

export function verifyRuntimeCapability(token: string): RuntimeCapability | null {
  const [version, encoded, encodedSignature, extra] = token.split(".");
  if (version !== "hael-runtime-v1" || !encoded || !encodedSignature || extra !== undefined) return null;
  let provided: Buffer;
  let payload: unknown;
  try {
    provided = Buffer.from(encodedSignature, "base64url");
    const expected = signature(encoded);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
  } catch { return null; }
  if (typeof payload !== "object" || payload === null) return null;
  const claims = payload as Record<string, unknown>;
  if (claims.version !== 1 || typeof claims.projectId !== "string"
    || typeof claims.buildId !== "string" || typeof claims.expiresAt !== "number"
    || claims.expiresAt <= Math.floor(Date.now() / 1000) || typeof claims.nonce !== "string") return null;
  return { projectId: claims.projectId, buildId: claims.buildId, expiresAt: claims.expiresAt };
}
