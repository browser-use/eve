// Pure scaffolding logic — no console, no process.exit — so it's unit-testable.
// The bin (./index.ts) wraps this with argv parsing and output.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** The harness-mode thin files. Each is a one-liner; logic lives in the package. */
export const HARNESS_FILES: Record<string, string> = {
  "agent/sandbox/sandbox.ts":
    'import { browserUseSandbox } from "@browser_use/eve/sandbox";\nexport default browserUseSandbox();\n',
  "agent/skills/browser-use.ts":
    'export { default } from "@browser_use/eve/skill";\n',
  "agent/tools/open_cloud_browser.ts":
    'export { default } from "@browser_use/eve/tools/open-cloud-browser";\n',
  "agent/tools/stop_cloud_browser.ts":
    'export { default } from "@browser_use/eve/tools/stop-cloud-browser";\n',
};

export class ScaffoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScaffoldError";
  }
}

export interface ScaffoldResult {
  written: string[];
  skipped: string[];
  missingDep: boolean;
  missingKey: boolean;
}

/**
 * Write the thin files into an eve app at `root`. Skips existing files unless
 * `force`. Throws ScaffoldError if `root` has no package.json.
 */
export function scaffold(root: string, opts: { force?: boolean } = {}): ScaffoldResult {
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) {
    throw new ScaffoldError(
      `no package.json in ${root}. Run this from your eve app root, or pass the path.`,
    );
  }

  const written: string[] = [];
  const skipped: string[] = [];
  for (const [rel, content] of Object.entries(HARNESS_FILES)) {
    const abs = join(root, rel);
    if (existsSync(abs) && !opts.force) {
      skipped.push(rel);
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    written.push(rel);
  }

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    /* ignore malformed package.json — just means we nudge to install */
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const missingDep = !deps["@browser_use/eve"];

  const envPath = join(root, ".env.local");
  const missingKey = !(
    existsSync(envPath) && /^BROWSER_USE_API_KEY=/m.test(readFileSync(envPath, "utf8"))
  );

  return { written, skipped, missingDep, missingKey };
}
