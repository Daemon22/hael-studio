import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
  getFreePort,
  startWorkspaceApi,
  waitForHttp,
} from "./support/server.mjs";

let api;
let baseUrl;

async function request(path, options) {
  return fetch(`${baseUrl}${path}`, options);
}

async function json(response) {
  return response.json();
}

before(async () => {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}/api`;
  api = startWorkspaceApi(port);
  await waitForHttp(`${baseUrl}/healthz`);
});

after(async () => {
  await api.stop();
});

describe("Hael Studio API contracts", { concurrency: false }, () => {
  test("returns a healthy API status", async () => {
    const response = await request("/healthz");
    assert.equal(response.status, 200);
    assert.deepEqual(await json(response), { status: "ok" });
  });

  test("loads the active workspace snapshot", async () => {
    const response = await request("/workspace");
    const workspace = await json(response);

    assert.equal(response.status, 200);
    assert.equal(workspace.id, "gqobonco-lineage");
    assert.equal(workspace.name, "Gqobonco / Lineage");
    assert.equal(workspace.status, "flowing");
    assert.ok(workspace.nodes.length > 0);
    assert.ok(workspace.messages.length > 0);
    assert.ok(workspace.capabilities.length > 0);
  });

  test("creates a workspace message and links Orren messages", async () => {
    const response = await request("/workspace/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "Test the semantic handoff", target: "orren" }),
    });
    const message = await json(response);

    assert.equal(response.status, 201);
    assert.match(message.id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(
      {
        author: message.author,
        role: message.role,
        body: message.body,
        tone: message.tone,
        linkedNodeId: message.linkedNodeId,
      },
      {
        author: "You",
        role: "human",
        body: "Test the semantic handoff",
        tone: "human",
        linkedNodeId: "orren",
      },
    );
  });

  test("rejects an empty workspace message", async () => {
    const response = await request("/workspace/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "", target: "loom" }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await json(response), { error: "Message body is invalid." });
  });

  test("rejects a workspace message with an invalid target", async () => {
    const response = await request("/workspace/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "Invalid target", target: "unknown" }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await json(response), { error: "Message body is invalid." });
  });

  test("queues a review and moves the workspace into review status", async () => {
    const response = await request("/workspace/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Review the release candidate", branch: "main" }),
    });
    const review = await json(response);
    const workspace = await json(await request("/workspace"));

    assert.equal(response.status, 201);
    assert.match(review.id, /^[0-9a-f-]{36}$/);
    assert.equal(review.status, "queued");
    assert.equal(review.title, "Review the release candidate");
    assert.equal(review.branch, "main");
    assert.ok(Number.isNaN(Date.parse(review.createdAt)) === false);
    assert.equal(workspace.status, "review");
  });

  test("rejects a review without a title", async () => {
    const response = await request("/workspace/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "", branch: "main" }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await json(response), { error: "Review request is invalid." });
  });

  test("lists replayable runtime scenarios", async () => {
    const response = await request("/runtime/scenarios");
    const scenarios = await json(response);

    assert.equal(response.status, 200);
    assert.ok(scenarios.length >= 3);
    assert.equal(scenarios[0].id, "multilingual");
    assert.ok(scenarios[0].events.length > 0);
    assert.equal(scenarios[0].events[0].scenarioId, scenarios[0].id);
  });

  test("injects a human-authored runtime event", async () => {
    const input = {
      scenarioId: "multilingual",
      time: 7,
      topic: "studio.test.event",
      label: "Test event",
      detail: "A test signal entered the runtime.",
      tone: "gold",
    };
    const response = await request("/runtime/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const event = await json(response);

    assert.equal(response.status, 201);
    assert.match(event.id, /^[0-9a-f-]{36}$/);
    assert.deepEqual({ ...event, id: undefined }, { ...input, id: undefined });
  });

  test("rejects a runtime event with a negative time", async () => {
    const response = await request("/runtime/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenarioId: "multilingual",
        time: -1,
        topic: "studio.invalid.event",
        label: "Invalid event",
        detail: "This event should not be accepted.",
        tone: "gold",
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await json(response), { error: "Runtime event is invalid." });
  });

  test("rejects a runtime event with an unsupported tone", async () => {
    const response = await request("/runtime/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenarioId: "multilingual",
        time: 2,
        topic: "studio.invalid.event",
        label: "Invalid event",
        detail: "This event should not be accepted.",
        tone: "purple",
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await json(response), { error: "Runtime event is invalid." });
  });
});