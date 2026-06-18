#!/usr/bin/env node
// End-to-end integration check for @browser_use/eve.
//
// Opt-in (not part of `npm test`): it costs cloud-browser credits and needs a
// running eve app that uses this package, plus BROWSER_USE_API_KEY + model creds.
//
// Usage:
//   1. In an eve app with @browser_use/eve wired in:  npm run dev -- --no-ui --port 3737
//   2. node scripts/integration.mjs [baseUrl]
//
// Asserts: the agent opened a cloud browser (a liveUrl appeared), read the
// example.com title ("Example Domain"), and stopped the browser.
const base = process.argv[2] ?? "http://127.0.0.1:3737";

function ok(cond, msg) {
  console.log(`${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) process.exitCode = 1;
}

const res = await fetch(`${base}/eve/v1/session`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    message:
      "Open a cloud browser, go to https://example.com, report the exact page title, then stop the browser.",
  }),
});
if (!res.ok) {
  console.error(`❌ could not create session (${res.status}). Is the eve app running at ${base}?`);
  process.exit(1);
}
const { sessionId } = await res.json();
console.log(`session: ${sessionId}`);

// Stream NDJSON until the session completes. eve's session stream stays OPEN
// after session.completed (durable sessions), so we break out and abort it
// ourselves rather than waiting for the network to close.
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 300_000);
const stream = await fetch(`${base}/eve/v1/session/${sessionId}/stream`, {
  signal: controller.signal,
});
let sawLiveUrl = false;
let sawStop = false;
let reply = "";
let done = false;
const decoder = new TextDecoder();
let buf = "";
try {
  for await (const chunk of stream.body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        continue;
      }
      const blob = JSON.stringify(evt.data ?? {});
      if (blob.includes("liveUrl")) sawLiveUrl = true;
      if (evt.type === "action.result" && blob.includes("stopped")) sawStop = true;
      if (evt.type === "message.completed") {
        const m = evt.data?.message ?? evt.data;
        reply = typeof m === "string" ? m : JSON.stringify(m);
      }
      if (evt.type === "session.completed") {
        done = true;
        break;
      }
    }
    if (done) break;
  }
} catch (err) {
  if (err?.name !== "AbortError") throw err;
} finally {
  clearTimeout(timeout);
  controller.abort();
}
if (!done) console.warn("⚠️  stream ended/timed out before session.completed");

console.log("\n--- assertions ---");
ok(sawLiveUrl, "opened a cloud browser (liveUrl surfaced)");
ok(/Example Domain/.test(reply), 'read the title ("Example Domain")');
ok(sawStop, "stopped the cloud browser (billing ended)");
console.log(`\nreply:\n${reply.slice(0, 600)}`);
process.exit(process.exitCode ?? 0);
