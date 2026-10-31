import { createHmac, createPublicKey, randomUUID, timingSafeEqual, verify } from "node:crypto";
import type { RequestHandler } from "express";
import { eq, lt } from "drizzle-orm";

export type StudioActor = { subject: string };
type JwtHeader = { alg?: unknown; kid?: unknown };
type JwtClaims = { iss?: unknown; aud?: unknown; azp?: unknown; sub?: unknown; exp?: unknown; nbf?: unknown; nonce?: unknown };
type JsonWebKey = import("node:crypto").webcrypto.JsonWebKey & { kid?: string; use?: string; alg?: string };
type JsonWebKeySet = { keys?: JsonWebKey[] };

let jwksCache: { expiresAt: number; keys: JsonWebKeySet["keys"] } | undefined;
const localSessions = new Map<string, { subject: string; expiresAt: number; absoluteExpiresAt: number; lastSeenAt: number }>();
let databaseModule: Promise<typeof import("@workspace/db")> | undefined;
const sessionLifetimeMs = 12 * 60 * 60 * 1000;
const sessionAbsoluteLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const sessionRenewAfterMs = 15 * 60 * 1000;

function decodeJson<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

function readToken(req: Parameters<RequestHandler>[0]): string | null {
  const authorization = req.header("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim() || null;
  return null;
}

function readCookie(req: Parameters<RequestHandler>[0], name: string): string | null {
  for (const item of (req.header("cookie") ?? "").split(";")) {
    const [key, ...parts] = item.trim().split("=");
    if (key !== name) continue;
    try { return parts.length ? decodeURIComponent(parts.join("=")) : null; } catch { return null; }
  }
  return null;
}

function hasTrustedOrigin(req: Parameters<RequestHandler>[0]): boolean {
  try {
    const publicOrigin = process.env.STUDIO_PUBLIC_ORIGIN;
    return Boolean(publicOrigin && req.header("origin") === new URL(publicOrigin).origin);
  } catch {
    return false;
  }
}

function getSessionSecret(): string {
  const secret = process.env.STUDIO_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("STUDIO_SESSION_SECRET must contain at least 32 bytes.");
  return secret;
}

function sessionSignature(sessionId: string): Buffer {
  return createHmac("sha256", getSessionSecret()).update(`studio-session:${sessionId}`).digest();
}

async function getSessionDatabase() {
  if (!process.env.DATABASE_URL) return null;
  databaseModule ??= import("@workspace/db");
  return databaseModule;
}

export async function createStudioSession(subject: string): Promise<{ cookieValue: string; maxAgeSeconds: number }> {
  const sessionId = randomUUID();
  const now = Date.now();
  const expiresAt = new Date(now + sessionLifetimeMs);
  const absoluteExpiresAt = new Date(now + sessionAbsoluteLifetimeMs);
  const db = await getSessionDatabase();
  if (db) {
    const { authSessions } = await import("@workspace/db/schema");
    await db.db.insert(authSessions).values({ id: sessionId, subject, expiresAt, absoluteExpiresAt, lastSeenAt: new Date(now) });
    await db.db.delete(authSessions).where(lt(authSessions.expiresAt, new Date(now)));
  } else {
    localSessions.set(sessionId, { subject, expiresAt: expiresAt.getTime(), absoluteExpiresAt: absoluteExpiresAt.getTime(), lastSeenAt: now });
  }
  const signature = sessionSignature(sessionId).toString("base64url");
  return { cookieValue: `${sessionId}.${signature}`, maxAgeSeconds: Math.floor(sessionLifetimeMs / 1000) };
}

export async function readStudioSession(cookieValue: string): Promise<{ subject: string; sessionId: string; maxAgeSeconds: number; renewed: boolean } | null> {
  const [sessionId, signature, extra] = cookieValue.split(".");
  if (!sessionId || !signature || extra !== undefined || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  let provided: Buffer;
  try { provided = Buffer.from(signature, "base64url"); } catch { return null; }
  const expected = sessionSignature(sessionId);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  const db = await getSessionDatabase();
  if (!db) {
    const session = localSessions.get(sessionId);
    const now = Date.now();
    if (!session || session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      localSessions.delete(sessionId);
      return null;
    }
    const renewed = now - session.lastSeenAt >= sessionRenewAfterMs;
    if (renewed) {
      session.expiresAt = Math.min(now + sessionLifetimeMs, session.absoluteExpiresAt);
      session.lastSeenAt = now;
    }
    return { subject: session.subject, sessionId, maxAgeSeconds: Math.floor((session.expiresAt - now) / 1000), renewed };
  }
  const { authSessions } = await import("@workspace/db/schema");
  const [session] = await db.db.select().from(authSessions).where(eq(authSessions.id, sessionId)).limit(1);
  const now = Date.now();
  if (!session || session.expiresAt.getTime() <= now || session.absoluteExpiresAt.getTime() <= now) {
    if (session) await db.db.delete(authSessions).where(eq(authSessions.id, sessionId));
    return null;
  }
  const renewed = now - session.lastSeenAt.getTime() >= sessionRenewAfterMs;
  const expiresAt = renewed
    ? new Date(Math.min(now + sessionLifetimeMs, session.absoluteExpiresAt.getTime()))
    : session.expiresAt;
  if (renewed) await db.db.update(authSessions).set({ lastSeenAt: new Date(now), expiresAt }).where(eq(authSessions.id, sessionId));
  return { subject: session.subject, sessionId, maxAgeSeconds: Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000)), renewed };
}

export async function revokeStudioSession(sessionId: string): Promise<void> {
  const db = await getSessionDatabase();
  if (!db) {
    localSessions.delete(sessionId);
    return;
  }
  const { authSessions } = await import("@workspace/db/schema");
  await db.db.delete(authSessions).where(eq(authSessions.id, sessionId));
}

async function loadJwks(): Promise<NonNullable<JsonWebKeySet["keys"]>> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys ?? [];
  const jwksUrl = process.env.OIDC_JWKS_URL;
  if (!jwksUrl) throw new Error("OIDC_JWKS_URL is not configured.");
  let url: URL;
  try {
    url = new URL(jwksUrl);
  } catch {
    throw new Error("OIDC_JWKS_URL is invalid.");
  }
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localHosts.has(url.hostname))) {
    throw new Error("OIDC_JWKS_URL must use HTTPS outside local development.");
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: "error", headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`OIDC key service returned HTTP ${response.status}.`);
  const result = await response.json() as JsonWebKeySet;
  if (!Array.isArray(result.keys) || result.keys.length === 0) throw new Error("OIDC key service returned no signing keys.");
  jwksCache = { expiresAt: Date.now() + 5 * 60_000, keys: result.keys };
  return result.keys;
}

export async function verifyIdentityToken(token: string, expectedNonce?: string): Promise<StudioActor & { expiresAt: number }> {
  const issuer = process.env.OIDC_ISSUER;
  const audience = process.env.OIDC_AUDIENCE;
  if (!issuer || !audience) throw new Error("OIDC_ISSUER and OIDC_AUDIENCE must be configured.");

  const pieces = token.split(".");
  if (pieces.length !== 3 || pieces.some((piece) => !piece)) throw new Error("The identity token is malformed.");
  const header = decodeJson<JwtHeader>(pieces[0]!);
  const claims = decodeJson<JwtClaims>(pieces[1]!);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("The identity token signing algorithm is unsupported.");
  const keys = await loadJwks();
  const jwk = keys.find((key) => key.kid === header.kid && (!key.use || key.use === "sig") && (!key.alg || key.alg === "RS256"));
  if (!jwk) throw new Error("The identity token signing key is unknown.");
  const signature = Buffer.from(pieces[2]!, "base64url");
  const signedContent = Buffer.from(`${pieces[0]}.${pieces[1]}`);
  if (!verify("RSA-SHA256", signedContent, createPublicKey({ key: jwk, format: "jwk" }), signature)) {
    throw new Error("The identity token signature is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  const audiences = typeof claims.aud === "string" ? [claims.aud] : claims.aud;
  if (claims.iss !== issuer || !Array.isArray(audiences) || !audiences.includes(audience)
    || (audiences.length > 1 && claims.azp !== audience)) throw new Error("The identity token issuer or audience is invalid.");
  if (typeof claims.exp !== "number" || claims.exp <= now || (typeof claims.nbf === "number" && claims.nbf > now)) {
    throw new Error("The identity token is expired or not yet valid.");
  }
  if (typeof claims.sub !== "string" || claims.sub.length < 1 || claims.sub.length > 255) throw new Error("The identity token subject is invalid.");
  if (expectedNonce !== undefined && claims.nonce !== expectedNonce) throw new Error("The identity token nonce is invalid.");
  return { subject: claims.sub, expiresAt: claims.exp };
}

export const authenticateStudioRequest: RequestHandler = async (req, res, next) => {
  if (req.method === "POST" && req.path === "/runtime/provenance") return next();
  if (req.path === "/healthz" || req.path === "/auth/login" || req.path === "/auth/callback") return next();
  res.setHeader("Cache-Control", "private, no-store");
  if (process.env.NODE_ENV !== "production") {
    res.locals.studioActor = { subject: process.env.STUDIO_DEV_SUBJECT ?? "local-developer" } satisfies StudioActor;
    return next();
  }

  const token = readToken(req);
  const sessionCookie = readCookie(req, "hael_studio_session");
  if (!token && !sessionCookie) {
    res.status(401).json({ error: "Sign in to continue.", code: "authentication_required" });
    return;
  }
  if (sessionCookie && !token && req.method !== "GET" && req.method !== "HEAD" && !hasTrustedOrigin(req)) {
    res.status(403).json({ error: "The request origin could not be verified.", code: "invalid_request_origin" });
    return;
  }
  try {
    const session = !token && sessionCookie ? await readStudioSession(sessionCookie) : null;
    if (session) {
      res.locals.studioSessionId = session.sessionId;
      if (session.renewed) {
        res.append("Set-Cookie", `hael_studio_session=${encodeURIComponent(sessionCookie!)}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}; Max-Age=${session.maxAgeSeconds}`);
      }
    }
    const identity = token ? await verifyIdentityToken(token) : session ? { subject: session.subject } : null;
    if (!identity) {
      res.status(401).json({ error: "The Studio session is invalid or expired.", code: "invalid_session" });
      return;
    }
    res.locals.studioActor = { subject: identity.subject } satisfies StudioActor;
    next();
  } catch {
    res.status(401).json({ error: "The Studio identity could not be verified.", code: "invalid_identity" });
  }
};
