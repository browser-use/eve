import { defineTool } from "eve/tools";
import { z } from "zod";
import { BROWSER_ID_PATH, stopCloudBrowser } from "../cloud.js";

/**
 * Stops the cloud browser opened by `open_cloud_browser`, ending billing. Reads
 * the browser id the open tool wrote into the sandbox; the stop call itself runs
 * in the app runtime (where the API key lives).
 */
export default defineTool({
  description:
    "Stop the cloud browser and end its billing. Call this when you are finished browsing.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const sandbox = await ctx.getSandbox();
    const { stdout } = await sandbox.run({
      command: `cat /workspace/${BROWSER_ID_PATH} 2>/dev/null || true`,
    });
    const id = stdout.trim();
    if (!id) {
      return { ok: true, note: "No cloud browser was open." };
    }
    await stopCloudBrowser(id);
    await sandbox.run({ command: `rm -f /workspace/${BROWSER_ID_PATH}` });
    return { ok: true, stopped: id };
  },
});
