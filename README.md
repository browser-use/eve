# @browser-use/eve

Give a [Vercel **eve**](https://eve.dev) agent a [Browser Use](https://browser-use.com)
**cloud browser**, in one install. Your agent can browse, scrape, click, and
screenshot the live web — and you can watch it via a liveUrl.

```bash
npm i github:browser-use/eve      # internal install (private repo)
npx browser-use-eve add
# add BROWSER_USE_API_KEY=bu_... to .env.local
```

That's it — ask your agent to "open example.com and tell me the title."

> Internal/private today. When published publicly the install becomes
> `npm i @browser-use/eve`. See `PUBLISHING.md`.

## What `add` scaffolds

Four thin files (the logic lives in the package, so `npm update` ships fixes):

```ts
// agent/sandbox/sandbox.ts
import { browserUseSandbox } from "@browser-use/eve/sandbox";
export default browserUseSandbox();

// agent/skills/browser-use.ts
export { default } from "@browser-use/eve/skill";

// agent/tools/open_cloud_browser.ts
export { default } from "@browser-use/eve/tools/open-cloud-browser";

// agent/tools/stop_cloud_browser.ts
export { default } from "@browser-use/eve/tools/stop-cloud-browser";
```

(Re-run is safe — existing files are skipped unless you pass `--force`.)

## How it works (hardened by default)

The API key lives **only in your app runtime**, never in the sandbox:

1. `open_cloud_browser` (app runtime) provisions a cloud browser via the official
   `browser-use-sdk` and resolves its WebSocket URL.
2. Only that scoped WS URL is handed to the sandbox.
3. The agent drives the browser with `browser-harness-js` (raw, typed CDP).
4. `stop_cloud_browser` ends the cloud browser to stop billing.

## Status

Early prototype. v1 covers the harness-in-sandbox path; an MCP-connection mode
and a `browser-use-eve add` scaffolder are planned. See `PLAN.md`.
