import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import {
  getFreePort,
  startStudio,
  startWorkspaceApi,
  waitForHttp,
} from "./support/server.mjs";

const execFileAsync = promisify(execFile);
let api;
let studio;
let proxy;
let browserUrl;

before(async () => {
  const apiPort = await getFreePort();
  const studioPort = await getFreePort();
  const proxyPort = await getFreePort();

  api = startWorkspaceApi(apiPort);
  await waitForHttp(`http://127.0.0.1:${apiPort}/api/healthz`);

  studio = startStudio(studioPort);
  await waitForHttp(`http://127.0.0.1:${studioPort}/`);

  proxy = createServer((request, response) => {
    const targetPort = request.url?.startsWith("/api/") ? apiPort : studioPort;
    const target = new URL(request.url ?? "/", `http://127.0.0.1:${targetPort}`);
    const upstream = fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request,
      duplex: "half",
    });

    upstream.then(async (upstreamResponse) => {
      response.writeHead(upstreamResponse.status, Object.fromEntries(upstreamResponse.headers));
      response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
    }).catch((error) => {
      response.writeHead(502, { "content-type": "text/plain" });
      response.end(String(error));
    });
  });
  await new Promise((resolve, reject) => {
    proxy.once("error", reject);
    proxy.listen(proxyPort, "127.0.0.1", resolve);
  });
  browserUrl = `http://127.0.0.1:${proxyPort}/`;
});

after(async () => {
  proxy?.closeAllConnections?.();
  await new Promise((resolve) => proxy?.close(resolve));
  await studio?.stop();
  await api?.stop();
});

test("browser loads the workspace rendered from the API", async () => {
  const { stdout, stderr } = await execFileAsync(
    "/repl/tools/bin/chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--ignore-certificate-errors",
      "--virtual-time-budget=5000",
      "--run-all-compositor-stages-before-draw",
      "--dump-dom",
      browserUrl,
    ],
    { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
  );
  const dom = stdout || stderr;

  assert.match(dom, /Gqobonco \/ Lineage/);
  assert.match(dom, /The intelligence workspace/);
  assert.match(dom, /Responsive studio shell/);
  assert.doesNotMatch(dom, /Workspace unavailable/);
});