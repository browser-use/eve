import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Cloud SDK: a BrowserUse instance exposing a `browsers` resource.
// vi.hoisted so the mocks exist when the hoisted vi.mock factory runs.
const { create, get, stop } = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("browser-use-sdk", () => ({
  // A real class so `new BrowserUse({ apiKey })` yields an instance whose
  // `browsers` resource is our spies (vi.fn-as-constructor drops the returned obj).
  BrowserUse: class {
    browsers = { create, get, stop };
  },
}));

import {
  createCloudBrowser,
  resolveWebSocketUrl,
  stopCloudBrowser,
} from "../src/cloud.ts";

beforeEach(() => {
  process.env.BROWSER_USE_API_KEY = "test-key";
  create.mockReset();
  get.mockReset();
  stop.mockReset();
});

describe("resolveWebSocketUrl", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns webSocketDebuggerUrl from /json/version", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ webSocketDebuggerUrl: "wss://x/devtools/browser/abc" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const ws = await resolveWebSocketUrl("https://id.cdp.browser-use.com");
    expect(ws).toBe("wss://x/devtools/browser/abc");
    expect(fetchMock).toHaveBeenCalledWith("https://id.cdp.browser-use.com/json/version");
  });

  it("strips a trailing slash before appending /json/version", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ webSocketDebuggerUrl: "wss://x" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await resolveWebSocketUrl("https://id.cdp.browser-use.com/");
    expect(fetchMock).toHaveBeenCalledWith("https://id.cdp.browser-use.com/json/version");
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502 })));
    await expect(resolveWebSocketUrl("https://x")).rejects.toThrow(/502/);
  });

  it("throws when webSocketDebuggerUrl is absent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    await expect(resolveWebSocketUrl("https://x")).rejects.toThrow(/webSocketDebuggerUrl/);
  });
});

describe("createCloudBrowser", () => {
  it("maps id/cdpUrl/liveUrl from the create response", async () => {
    create.mockResolvedValue({ id: "b1", cdpUrl: "https://c", liveUrl: "https://l" });
    const r = await createCloudBrowser();
    expect(r).toEqual({ id: "b1", cdpUrl: "https://c", liveUrl: "https://l" });
  });

  it("polls get() until cdpUrl is available", async () => {
    create.mockResolvedValue({ id: "b2", cdpUrl: null, liveUrl: null });
    get.mockResolvedValue({ id: "b2", cdpUrl: "https://ready", liveUrl: null });
    const r = await createCloudBrowser();
    expect(get).toHaveBeenCalledWith("b2");
    expect(r.cdpUrl).toBe("https://ready");
  }, 10_000);

  it("defaults liveUrl to null", async () => {
    create.mockResolvedValue({ id: "b3", cdpUrl: "https://c" });
    const r = await createCloudBrowser();
    expect(r.liveUrl).toBeNull();
  });
});

describe("stopCloudBrowser", () => {
  it("calls browsers.stop with the id", async () => {
    stop.mockResolvedValue({});
    await stopCloudBrowser("b1");
    expect(stop).toHaveBeenCalledWith("b1");
  });

  it("swallows errors so teardown is idempotent", async () => {
    stop.mockRejectedValue(new Error("already stopped"));
    await expect(stopCloudBrowser("b1")).resolves.toBeUndefined();
  });

  it("does not throw when the API key is missing", async () => {
    delete process.env.BROWSER_USE_API_KEY;
    await expect(stopCloudBrowser("b1")).resolves.toBeUndefined();
  });
});
