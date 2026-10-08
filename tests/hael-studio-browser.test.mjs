import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import {
  getFreePort,
  startStudio,
  startWorkspaceApi,
  waitForHttp,
} from "./support/server.mjs";

const execFileAsync = promisify(execFile);
const chromiumPath = findChromium();
let api;
let studio;
let proxy;
let browserUrl;

before(async () => {
  if (!chromiumPath) return;
  const apiPort = await getFreePort();
  const studioPort = await getFreePort();
  const proxyPort = await getFreePort();

  api = startWorkspaceApi(apiPort);
  await waitForHttp(`http://127.0.0.1:${apiPort}/api/healthz`);

  studio = startStudio(studioPort);
  try {
    await waitForHttp(`http://127.0.0.1:${studioPort}/`);
  } catch (error) {
    throw new Error(`${error}\nStudio output:\n${studio.getOutput()}`);
  }

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
  if (proxy) {
    proxy.closeAllConnections?.();
    await new Promise((resolve) => proxy.close(resolve));
  }
  await studio?.stop();
  await api?.stop();
});

test("browser loads the workspace rendered from the API", { skip: !chromiumPath }, async () => {
  const { stdout, stderr } = await execFileAsync(
    chromiumPath,
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

function findChromium() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  const candidates = process.platform === "win32"
    ? ["chrome.exe", "msedge.exe"]
    : process.platform === "darwin"
      ? ["chromium", "Google Chrome"]
      : ["chromium", "chromium-browser", "google-chrome", "microsoft-edge"];
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")
    : [""];
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    for (const candidate of candidates) {
      for (const extension of extensions) {
        const executable = path.join(directory, path.extname(candidate) ? candidate : `${candidate}${extension}`);
        if (existsSync(executable)) return executable;
      }
    }
  }
  return existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined;
}
