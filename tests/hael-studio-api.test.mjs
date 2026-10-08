import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
  getFreePort,
  startBuiltWorkspaceApi,
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
  try {
    await waitForHttp(`${baseUrl}/healthz`);
  } catch (error) {
    await api.stop();
    throw new Error(`${error}\nAPI output:\n${api.getOutput()}`);
  }
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

  test("saves runtime state with versioned conflict protection", async () => {
    const firstState = { components: { canvas: { selected: "orren" } } };
    const firstResponse = await request("/workspace/runtime-state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision: 0, state: firstState }),
    });
    const first = await json(firstResponse);

    assert.equal(firstResponse.status, 200);
    assert.equal(first.revision, 1);
    assert.deepEqual(first.state, firstState);

    const conflictResponse = await request("/workspace/runtime-state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision: 0, state: { lost: true } }),
    });
    const conflict = await json(conflictResponse);

    assert.equal(conflictResponse.status, 409);
    assert.match(conflict.error, /changed since it was read/);
    assert.equal(conflict.current.revision, 1);
    assert.deepEqual(conflict.current.state, firstState);

    const secondState = { ...firstState, inspector: { expanded: true } };
    const secondResponse = await request("/workspace/runtime-state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRevision: conflict.current.revision, state: secondState }),
    });
    const second = await json(secondResponse);
    assert.equal(secondResponse.status, 200);
    assert.equal(second.revision, 2);
    assert.deepEqual(second.state, secondState);

    const concurrent = await Promise.all([
      request("/workspace/runtime-state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: 2, state: { writer: "left" } }),
      }),
      request("/workspace/runtime-state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: 2, state: { writer: "right" } }),
      }),
    ]);
    const outcomes = await Promise.all(concurrent.map(async (response) => ({
      status: response.status,
      body: await json(response),
    })));
    assert.deepEqual(outcomes.map(({ status }) => status).sort(), [200, 409]);
    const winner = outcomes.find(({ status }) => status === 200).body;
    const rejected = outcomes.find(({ status }) => status === 409).body;
    assert.equal(winner.revision, 3);
    assert.equal(rejected.current.revision, 3);
    assert.deepEqual(rejected.current.state, winner.state);
  });

  test("fails clearly when production starts without DATABASE_URL", async () => {
    const port = await getFreePort();
    const productionApi = startBuiltWorkspaceApi(port, { nodeEnv: "production", logLevel: "error" });
    const result = await productionApi.exit;
    assert.equal(result.code, 1);
    assert.match(result.output, /DATABASE_URL is required in production/);
  });

  test("fails clearly when production cannot reach Postgres", async () => {
    const port = await getFreePort();
    const productionApi = startBuiltWorkspaceApi(port, {
      nodeEnv: "production",
      logLevel: "error",
      databaseUrl: "postgresql://hael_test:hael_test@127.0.0.1:1/hael_test",
    });
    const result = await productionApi.exit;
    assert.equal(result.code, 1);
    assert.match(result.output, /Could not connect to PostgreSQL using DATABASE_URL/);
    assert.doesNotMatch(result.output, /hael_test/);
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
