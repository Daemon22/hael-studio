import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, describe, test } from "node:test";
import {
  getFreePort,
  startWorkspaceApi,
  waitForHttp,
} from "./support/server.mjs";

const databaseUrl = process.env.HAEL_TEST_DATABASE_URL;
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const workspaceRoot = new URL("../", import.meta.url);
let api;
let baseUrl;

function applyMigrations() {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpmCommand, ["--filter", "@workspace/db", "run", "migrate"], {
      cwd: workspaceRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Postgres migrations failed with exit code ${code}: ${output}`));
    });
  });
}

describe("Hael Studio Postgres persistence", { skip: !databaseUrl }, () => {
  before(async () => {
    await applyMigrations();
    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}/api`;
    api = startWorkspaceApi(port, { databaseUrl });
    await waitForHttp(`${baseUrl}/healthz`);
  });

  after(async () => {
    await api?.stop();
  });

  test("persists workspace messages and protects runtime revisions", async () => {
    const messageResponse = await fetch(`${baseUrl}/workspace/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: `Postgres persistence ${Date.now()}`, target: "loom" }),
    });
    assert.equal(messageResponse.status, 201);

    const snapshot = await (await fetch(`${baseUrl}/workspace`)).json();
    assert.ok(snapshot.messages.some((message) => message.body.startsWith("Postgres persistence ")));

    const reviewResponse = await fetch(`${baseUrl}/workspace/reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: `Postgres review ${Date.now()}`, branch: "main" }),
    });
    assert.equal(reviewResponse.status, 201);

    const eventInput = {
      scenarioId: "multilingual",
      time: 8,
      topic: "studio.postgres.test",
      label: "Postgres persistence",
      detail: "A persisted runtime event.",
      tone: "gold",
    };
    const eventResponse = await fetch(`${baseUrl}/runtime/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(eventInput),
    });
    assert.equal(eventResponse.status, 201);
    const events = await (await fetch(`${baseUrl}/runtime/events`)).json();
    assert.ok(events.some((event) => event.topic === eventInput.topic));

    const currentResponse = await fetch(`${baseUrl}/workspace/runtime-state`);
    const current = currentResponse.status === 404 ? null : await currentResponse.json();
    const expectedRevision = current?.revision ?? 0;
    const writes = await Promise.all([
      { writer: "left" },
      { writer: "right" },
    ].map((state) => fetch(`${baseUrl}/workspace/runtime-state`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision, state }),
    })));
    const results = await Promise.all(writes.map(async (response) => ({
      status: response.status,
      body: await response.json(),
    })));
    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
    const winner = results.find(({ status }) => status === 200).body;
    const rejected = results.find(({ status }) => status === 409).body;
    assert.equal(winner.revision, expectedRevision + 1);
    assert.equal(rejected.current.revision, winner.revision);
    assert.deepEqual(rejected.current.state, winner.state);
  });
});
