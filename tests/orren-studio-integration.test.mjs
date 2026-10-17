import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const readBytes = (path) => readFileSync(new URL(path, import.meta.url));

const manifest = JSON.parse(read("../artifacts/hael-studio/public/manus-routes.json"));
const hubHtml = read("../artifacts/hael-studio/public/orren/index.html");
const hubApp = read("../artifacts/hael-studio/public/orren/app.js");
const readonlyGuard = read("../artifacts/hael-studio/public/orren/studio-readonly.js");
const studioHome = read("../artifacts/hael-studio/src/pages/Home.tsx");
const integrationDoc = read("../docs/integrations/orren-visual-hub.md");

 test("Hael Studio declares the Orren static sub-application route", () => {
  assert.ok(manifest.routes.some((route) => route.path === "/orren/index.html"));
  assert.match(studioHome, /href="\/orren\/index\.html"[^>]*target="_blank"/);
  assert.match(studioHome, /rel="noopener noreferrer"/);
});

test("the hosted Orren sample is clearly labeled and excludes the live Engine bridge", () => {
  assert.match(hubHtml, /Illustrative sample only · no live SIR connection · read-only/);
  assert.match(hubHtml, /studio-readonly\.js/);
  assert.doesNotMatch(hubHtml, /runtime\.js/);
  assert.doesNotMatch(hubApp, /\bfetch\s*\(|XMLHttpRequest|\/api\/(?:field|action)/i);
});

test("semantic mutation controls and drag actions are blocked in the Studio mirror", () => {
  for (const selector of ["#node-form", "#intent-form", "#relation-dialog", "#action-realize", "#connect-mode"]) {
    assert.ok(readonlyGuard.includes(selector), `missing read-only guard for ${selector}`);
  }
  for (const eventName of ["submit", "dragstart", "dragover", "drop"]) {
    assert.ok(readonlyGuard.includes(`"${eventName}"`), `missing blocked event ${eventName}`);
  }
  assert.match(integrationDoc, /does not persist edits, connect to a live SIR session/i);
});

test("the vendored Orren visual identity files remain byte-identical to their reviewed checksums", () => {
  const expected = {
    "../artifacts/hael-studio/public/orren/assets/orren-emblem.webp": "dec227b7d6efbe0e7c232c2f26393d12b085d8058dc308593abfe98fae8dc8bf",
    "../artifacts/hael-studio/public/orren/assets/orren-sanctuary.webp": "4c84864c411e320ea23722c20457487dc344388d4ce2ce1ee7de9833afe7b591",
  };
  for (const [path, digest] of Object.entries(expected)) {
    const actual = createHash("sha256").update(readBytes(path)).digest("hex");
    assert.equal(actual, digest, `${path} checksum changed`);
  }
});
