import { defineSandbox } from "eve/sandbox";

const HARNESS_REPO = "https://github.com/browser-use/browser-harness-js";

// Sourced before every browser-harness-js call: puts the CLI and Bun on PATH.
// No secret here — the cloud credential never enters the sandbox.
const ENV_FILE = ".bu-env";
const ENV_CONTENT = 'export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"\n';

export interface BrowserUseSandboxOptions {
  /**
   * Override eve's sandbox backend. Defaults to eve's availability-aware
   * backend (Vercel Sandbox in prod; Docker/microsandbox locally).
   */
  backend?: Parameters<typeof defineSandbox>[0]["backend"];
}

/**
 * An eve sandbox preconfigured to drive a Browser Use cloud browser.
 *
 * `bootstrap` (cached per template) installs the TypeScript driver
 * `browser-harness-js` and Bun, and puts both on PATH. Provisioning the actual
 * cloud browser happens lazily in the `open_cloud_browser` tool (app runtime),
 * so the API key never enters the sandbox.
 */
export function browserUseSandbox(opts: BrowserUseSandboxOptions = {}) {
  return defineSandbox({
    ...(opts.backend ? { backend: opts.backend } : {}),
    async bootstrap({ use }) {
      const sb = await use();
      // 1. The raw-CDP TypeScript driver, with its CLI on PATH.
      await sb.run({
        command: `git clone --depth 1 ${HARNESS_REPO} "$HOME/browser-harness-js"`,
      });
      await sb.run({
        command:
          'mkdir -p "$HOME/.local/bin" && ln -sf "$HOME/browser-harness-js/sdk/browser-harness-js" "$HOME/.local/bin/browser-harness-js"',
      });
      // 2. Bun (the driver's REPL is Bun-native). Pre-install so the first
      //    call is fast and deterministic instead of auto-installing live.
      await sb.run({ command: "curl -fsSL https://bun.sh/install | bash" });
      // 3. PATH env file the skill sources before each call.
      await sb.writeTextFile({ path: ENV_FILE, content: ENV_CONTENT });
    },
  });
}

export default browserUseSandbox;
