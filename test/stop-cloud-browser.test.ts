import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import stopTool from "../src/tools/stop-cloud-browser.js";

// Use the real SDK and eve.defineTool with a loopback HTTP fixture. The sandbox
// adapter executes the tool's two exact commands against owned temporary files.
const exec = promisify(execFile);
const nativeFetch = globalThis.fetch;
const id = "00000000-0000-4000-8000-000000000051";
let directory: string;
let origin: string;
let statuses: (number | "disconnect")[];
let requests = 0;
const server = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  expect(req.method).toBe("PATCH");
  expect(req.url).toBe(`/api/v2/browsers/${id}`);
  expect(JSON.parse(body)).toEqual({ action: "stop" });
  expect(req.headers["x-browser-use-api-key"]).toBe("synthetic-stop-test");
  requests++;
  const status = statuses.shift();
  if (status === "disconnect") return req.socket.destroy();
  res.writeHead(status ?? 500, { "content-type": "application/json", connection: "close" });
  res.end(JSON.stringify(status === 200 ? {
    id, status: "stopped", liveUrl: null, cdpUrl: null,
    startedAt: "2026-09-07T10:00:00Z", timeoutAt: "2026-09-07T12:00:00Z",
    finishedAt: "2026-09-07T10:01:00Z", proxyUsedMb: "0", proxyCost: "0", browserCost: "0",
  } : { detail: status === 404 ? "Session not found" : "Synthetic stop error" }));
});
const idPath = () => join(directory, ".bu-browser-id");
const context = {
  getSandbox: async () => ({
    run: async ({ command }: { command: string }) => {
      expect([
        "cat /workspace/.bu-browser-id 2>/dev/null || true",
        "rm -f /workspace/.bu-browser-id",
      ]).toContain(command);
      const localCommand = command.replace("/workspace/.bu-browser-id", JSON.stringify(idPath()));
      const result = await exec("/bin/sh", ["-c", localCommand], { cwd: directory, env: { PATH: "/usr/bin:/bin" } });
      return { ...result, exitCode: 0 };
    },
  }),
  // Other ToolContext methods are unused by stop_cloud_browser.
} as unknown as Parameters<NonNullable<typeof stopTool.execute>>[1];
const execute = () => stopTool.execute!({}, context);

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "eve-stop-test-"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No fixture address");
  origin = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => {
  await writeFile(idPath(), id);
  statuses = [];
  requests = 0;
  vi.stubEnv("BROWSER_USE_API_KEY", "synthetic-stop-test");
  vi.stubEnv("BROWSER_USE_X402_PRIVATE_KEY", "");
  vi.stubEnv("BROWSER_USE_EVE_DEBUG", "");
  vi.stubGlobal("fetch", (input: string, init: RequestInit) => {
    // No upstream URL can leave this process, even if the code changes.
    expect(input).toBe(`https://api.browser-use.com/api/v2/browsers/${id}`);
    expect(init.method).toBe("PATCH");
    return nativeFetch(`${origin}/api/v2/browsers/${id}`, init);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
});

it.each([200, 404])("clears the stored ID on HTTP %i", async (status) => {
  statuses = [status];
  await expect(execute()).resolves.toEqual({ ok: true, stopped: id });
  await expect(readFile(idPath(), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  expect(requests).toBe(1);
});

it.each([401, 403, 422, 500, 503, "disconnect"] as const)("keeps the ID and permits retry after %s", async (status) => {
  statuses = [status, 200];
  await expect(execute()).rejects.toThrow();
  expect(await readFile(idPath(), "utf8")).toBe(id);
  await expect(execute()).resolves.toEqual({ ok: true, stopped: id });
  await expect(readFile(idPath(), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  expect(requests).toBe(2);
});

it("keeps the ID when the API key is missing", async () => {
  vi.stubEnv("BROWSER_USE_API_KEY", "");
  await expect(execute()).rejects.toThrow("BROWSER_USE_API_KEY is not set");
  expect(await readFile(idPath(), "utf8")).toBe(id);
  expect(requests).toBe(0);
});

it("does not need a key or make a request without a stored browser", async () => {
  await rm(idPath());
  vi.stubEnv("BROWSER_USE_API_KEY", "");
  await expect(execute()).resolves.toEqual({ ok: true, note: "No cloud browser was open." });
  expect(requests).toBe(0);
});

it("preserves the SDK's existing 429 retry before clearing the ID", async () => {
  statuses = [429, 200];
  await expect(execute()).resolves.toEqual({ ok: true, stopped: id });
  expect(requests).toBe(2);
});
