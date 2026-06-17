import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  BROWSER_ID_PATH,
  CDP_WS_PATH,
  createCloudBrowser,
  resolveWebSocketUrl,
} from "../cloud.js";

// Connect the persistent harness session to the cloud browser and focus a tab.
// The session lives in the sandbox's long-running browser-harness-js REPL, so a
// single connect carries across the agent's later `browser-harness-js` calls.
function connectSnippet(wsUrl: string): string {
  return [
    `await session.connect({ wsUrl: ${JSON.stringify(wsUrl)} });`,
    `const targets = await listPageTargets();`,
    `if (targets[0]) await session.use(targets[0].targetId);`,
    // Enable the domains the agent relies on so events (e.g. load) are delivered
    // and waitFor() works.
    `await session.Page.enable();`,
    `await session.Runtime.enable();`,
    `"connected";`,
  ].join(" ");
}

/**
 * Provisions a Browser Use cloud browser (in the app runtime, where the API key
 * lives), resolves its WebSocket URL, hands ONLY that URL to the sandbox, and
 * connects the driver. The agent then drives via `browser-harness-js`.
 */
export default defineTool({
  description:
    "Open a cloud browser for web browsing. Call this once before using browser-harness-js. Returns a liveUrl you can share to watch the session.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const { id, cdpUrl, liveUrl } = await createCloudBrowser();
    const wsUrl = await resolveWebSocketUrl(cdpUrl);

    const sandbox = await ctx.getSandbox();
    // Non-secret: a scoped WS endpoint + the browser id (for teardown).
    await sandbox.writeTextFile({ path: CDP_WS_PATH, content: wsUrl });
    await sandbox.writeTextFile({ path: BROWSER_ID_PATH, content: id });

    const { exitCode, stderr } = await sandbox.run({
      command: `source /workspace/.bu-env && browser-harness-js '${connectSnippet(wsUrl)}'`,
    });
    if (exitCode !== 0) {
      throw new Error(`failed to connect the browser driver: ${stderr}`);
    }

    return {
      ok: true,
      liveUrl,
      instructions:
        "Cloud browser ready and connected. Drive it with: source /workspace/.bu-env && browser-harness-js '<async JS using session.*>'. Call stop_cloud_browser when done.",
    };
  },
});
