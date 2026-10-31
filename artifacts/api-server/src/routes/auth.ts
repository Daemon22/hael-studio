import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { createStudioSession, revokeStudioSession, verifyIdentityToken } from "../lib/studioIdentity";

type OidcMetadata = {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
};
type LoginChallenge = { state: string; nonce: string; verifier: string; expiresAt: number };

const router: IRouter = Router();
let metadataCache: { expiresAt: number; value: OidcMetadata } | undefined;
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
});

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function hmac(value: string): Buffer {
  const secret = requiredEnv("STUDIO_SESSION_SECRET");
  if (Buffer.byteLength(secret) < 32) throw new Error("STUDIO_SESSION_SECRET must contain at least 32 bytes.");
  return createHmac("sha256", secret).update(value).digest();
}

function sign(value: string): string {
  const encoded = Buffer.from(value).toString("base64url");
  return `${encoded}.${hmac(encoded).toString("base64url")}`;
}

function unsign(value: string): string | null {
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra !== undefined) return null;
  let provided: Buffer;
  try { provided = Buffer.from(signature, "base64url"); } catch { return null; }
  const expected = hmac(encoded);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try { return Buffer.from(encoded, "base64url").toString("utf8"); } catch { return null; }
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.header("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key !== name) continue;
    try { return value.length ? decodeURIComponent(value.join("=")) : null; } catch { return null; }
  }
  return null;
}

function cookieFlags(): string {
  return `Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

function trustedEndpoint(value: unknown): string {
  if (typeof value !== "string") throw new Error("The identity provider returned an invalid endpoint.");
  const url = new URL(value);
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localHosts.has(url.hostname))) {
    throw new Error("The identity provider endpoint must use HTTPS.");
  }
  return url.toString();
}

async function getMetadata(): Promise<OidcMetadata> {
  if (metadataCache && metadataCache.expiresAt > Date.now()) return metadataCache.value;
  const issuer = requiredEnv("OIDC_ISSUER").replace(/\/$/, "");
  const issuerUrl = new URL(issuer);
  trustedEndpoint(issuerUrl.toString());
  const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
  const response = await fetch(discoveryUrl, { signal: AbortSignal.timeout(4000), redirect: "error", headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Identity discovery returned HTTP ${response.status}.`);
  const value = await response.json() as OidcMetadata;
  if (value.issuer !== requiredEnv("OIDC_ISSUER")) throw new Error("The identity provider issuer does not match configuration.");
  value.authorization_endpoint = trustedEndpoint(value.authorization_endpoint);
  value.token_endpoint = trustedEndpoint(value.token_endpoint);
  metadataCache = { expiresAt: Date.now() + 5 * 60_000, value };
  return value;
}

router.get("/login", async (_req, res) => {
  try {
    const metadata = await getMetadata();
    const clientId = requiredEnv("OIDC_CLIENT_ID");
    if (clientId !== requiredEnv("OIDC_AUDIENCE")) throw new Error("OIDC_CLIENT_ID must match OIDC_AUDIENCE.");
    const redirectUri = trustedEndpoint(requiredEnv("OIDC_REDIRECT_URI"));
    const challenge: LoginChallenge = {
      state: randomBytes(32).toString("base64url"),
      nonce: randomBytes(32).toString("base64url"),
      verifier: randomBytes(48).toString("base64url"),
      expiresAt: Date.now() + 5 * 60_000,
    };
    const cookie = sign(JSON.stringify(challenge));
    res.setHeader("Set-Cookie", `hael_oidc_state=${encodeURIComponent(cookie)}; Path=/api/auth/callback; HttpOnly; SameSite=Lax; Max-Age=300${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    const authorizationUrl = new URL(metadata.authorization_endpoint!);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("scope", "openid profile email");
    authorizationUrl.searchParams.set("state", challenge.state);
    authorizationUrl.searchParams.set("nonce", challenge.nonce);
    authorizationUrl.searchParams.set("code_challenge", createHash("sha256").update(challenge.verifier).digest("base64url"));
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    res.redirect(302, authorizationUrl.toString());
  } catch {
    res.status(503).json({ error: "Studio sign-in is not configured correctly.", code: "identity_provider_unavailable" });
  }
});

router.get("/callback", async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const rawChallenge = readCookie(req, "hael_oidc_state");
  const challengeValue = rawChallenge ? unsign(rawChallenge) : null;
  let challenge: LoginChallenge | null = null;
  try { challenge = challengeValue ? JSON.parse(challengeValue) as LoginChallenge : null; } catch { challenge = null; }
  res.append("Set-Cookie", `hael_oidc_state=; Path=/api/auth/callback; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  if (!challenge || challenge.expiresAt <= Date.now() || challenge.state !== state || !code || code.length > 4096 || req.query.error) {
    res.status(400).json({ error: "Sign-in could not be verified. Please start again.", code: "invalid_login_callback" });
    return;
  }

  try {
    const metadata = await getMetadata();
    const clientId = requiredEnv("OIDC_CLIENT_ID");
    if (clientId !== requiredEnv("OIDC_AUDIENCE")) throw new Error("OIDC_CLIENT_ID must match OIDC_AUDIENCE.");
    const clientSecret = requiredEnv("OIDC_CLIENT_SECRET");
    const redirectUri = trustedEndpoint(requiredEnv("OIDC_REDIRECT_URI"));
    const form = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: challenge.verifier });
    const headers = new Headers({ accept: "application/json", "content-type": "application/x-www-form-urlencoded" });
    const supported = metadata.token_endpoint_auth_methods_supported ?? [];
    if (supported.length && !supported.includes("client_secret_post") && !supported.includes("client_secret_basic")) {
      throw new Error("The identity provider token authentication method is unsupported.");
    }
    if (supported.includes("client_secret_post")) {
      form.set("client_id", clientId);
      form.set("client_secret", clientSecret);
    } else {
      headers.set("authorization", `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`);
    }
    const response = await fetch(metadata.token_endpoint!, { method: "POST", headers, body: form, signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!response.ok) throw new Error("The token exchange failed.");
    const tokens = await response.json() as { id_token?: unknown };
    if (typeof tokens.id_token !== "string" || tokens.id_token.length > 12_000) throw new Error("The identity provider returned no valid ID token.");
    const identity = await verifyIdentityToken(tokens.id_token, challenge.nonce);
    const session = await createStudioSession(identity.subject);
    res.append("Set-Cookie", `hael_studio_session=${encodeURIComponent(session.cookieValue)}; ${cookieFlags()}; Max-Age=${session.maxAgeSeconds}`);
    res.redirect(303, "/");
  } catch {
    res.status(401).json({ error: "Sign-in could not be completed. Please try again.", code: "identity_exchange_failed" });
  }
});

router.get("/session", (_req, res) => {
  const actor = res.locals.studioActor as { subject: string };
  res.json({ subject: actor.subject });
});

router.post("/logout", async (_req, res) => {
  const sessionId = res.locals.studioSessionId as string | undefined;
  if (sessionId) await revokeStudioSession(sessionId);
  res.setHeader("Set-Cookie", `hael_studio_session=; ${cookieFlags()}; Max-Age=0`);
  res.status(204).end();
});

export default router;
