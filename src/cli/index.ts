#!/usr/bin/env node
// browser-use-eve — scaffolds the thin files that wire @browser-use/eve into an
// eve app. Mirrors the ergonomics of `eve channels add <kind>`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The harness-mode files. Each is a one-liner; the logic lives in the package. */
const HARNESS_FILES: Record<string, string> = {
  "agent/sandbox/sandbox.ts":
    'import { browserUseSandbox } from "@browser-use/eve/sandbox";\nexport default browserUseSandbox();\n',
  "agent/skills/browser-use.ts":
    'export { default } from "@browser-use/eve/skill";\n',
  "agent/tools/open_cloud_browser.ts":
    'export { default } from "@browser-use/eve/tools/open-cloud-browser";\n',
  "agent/tools/stop_cloud_browser.ts":
    'export { default } from "@browser-use/eve/tools/stop-cloud-browser";\n',
};

function fail(msg: string): never {
  console.error(`browser-use-eve: ${msg}`);
  process.exit(1);
}

function add(args: string[]): void {
  const force = args.includes("--force");
  const target = args.find((a) => !a.startsWith("--"));
  const root = resolve(target ?? ".");

  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) {
    fail(
      `no package.json in ${root}. Run this from your eve app root, or pass the path.`,
    );
  }

  const written: string[] = [];
  const skipped: string[] = [];
  for (const [rel, content] of Object.entries(HARNESS_FILES)) {
    const abs = join(root, rel);
    if (existsSync(abs) && !force) {
      skipped.push(rel);
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    written.push(rel);
  }

  console.log("\n  @browser-use/eve — cloud browser for your eve agent\n");
  for (const f of written) console.log(`  + ${f}`);
  for (const f of skipped) console.log(`  · ${f}  (exists — re-run with --force to overwrite)`);

  // Nudges: missing dependency / missing key.
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    /* ignore */
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const next: string[] = [];
  if (!deps["@browser-use/eve"]) next.push("npm i @browser-use/eve");
  const envPath = join(root, ".env.local");
  const hasKey =
    existsSync(envPath) && /^BROWSER_USE_API_KEY=/m.test(readFileSync(envPath, "utf8"));
  if (!hasKey) next.push("add BROWSER_USE_API_KEY=bu_... to .env.local");

  if (next.length) {
    console.log("\n  next steps:");
    for (const n of next) console.log(`    - ${n}`);
  }
  console.log("\n  Then ask your agent to browse the web. ✨\n");
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "add":
      add(rest);
      break;
    case undefined:
    case "-h":
    case "--help":
      console.log("Usage: browser-use-eve add [target-dir] [--force]");
      break;
    default:
      fail(`unknown command "${cmd}". Try: browser-use-eve add`);
  }
}

main();
