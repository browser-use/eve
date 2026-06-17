// App-runtime helpers for the Browser Use cloud browser. These run in eve's app
// runtime (full process.env), NOT in the sandbox, so BROWSER_USE_API_KEY never
// leaves the host. Backed by the official `browser-use-sdk`.
import { BrowserUse } from "browser-use-sdk";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Where the agent's sandbox reads the (non-secret) scoped WS URL and the id. */
export const CDP_WS_PATH = ".bu-cdp";
export const BROWSER_ID_PATH = ".bu-browser-id";

export interface CloudBrowserOptions {
  /** Two-letter country for the Browser Use residential proxy, e.g. "us", "de". */
  proxyCountryCode?: string;
  /** Reuse a saved cloud profile (logged-in cookies) by id. */
  profileId?: string;
}

function client(): BrowserUse {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BROWSER_USE_API_KEY is not set in the app runtime. Add it to .env.local.",
    );
  }
  return new BrowserUse({ apiKey });
}

export interface ProvisionedBrowser {
  id: string;
  cdpUrl: string;
  liveUrl: string | null;
}

/** Create a cloud browser and wait until its cdpUrl is available. */
export async function createCloudBrowser(
  opts: CloudBrowserOptions = {},
): Promise<ProvisionedBrowser> {
  const c = client();
  // The SDK types proxyCountryCode as a country-code enum; our public option is
  // a plain string (validated server-side), so cast to the SDK's body type.
  const body = { ...opts } as Parameters<typeof c.browsers.create>[0];
  let b = await c.browsers.create(body);
  // cdpUrl can be null while the browser is still provisioning.
  for (let i = 0; i < 30 && !b.cdpUrl; i++) {
    await sleep(1000);
    b = await c.browsers.get(b.id);
  }
  if (!b.cdpUrl) {
    throw new Error(`cloud browser ${b.id} did not return a cdpUrl in time`);
  }
  return { id: b.id, cdpUrl: b.cdpUrl, liveUrl: b.liveUrl ?? null };
}

/**
 * browser-harness-js connects with `new WebSocket(wsUrl)`, so it needs a
 * ws/wss browser-level URL — not the HTTPS cdpUrl. Resolve it from the cloud
 * endpoint's /json/version (its `webSocketDebuggerUrl`).
 */
export async function resolveWebSocketUrl(cdpUrl: string): Promise<string> {
  const base = cdpUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/json/version`);
  if (!res.ok) {
    throw new Error(`GET ${base}/json/version failed: ${res.status}`);
  }
  const info = (await res.json()) as { webSocketDebuggerUrl?: string };
  if (!info.webSocketDebuggerUrl) {
    throw new Error(`no webSocketDebuggerUrl from ${base}/json/version`);
  }
  return info.webSocketDebuggerUrl;
}

/** Stop a cloud browser to end billing. Idempotent-friendly: swallows not-found. */
export async function stopCloudBrowser(id: string): Promise<void> {
  try {
    await client().browsers.stop(id);
  } catch (err) {
    // A browser already stopped/expired should not fail teardown.
    if (process.env.BROWSER_USE_EVE_DEBUG) console.error("stopCloudBrowser", err);
  }
}
