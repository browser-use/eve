#!/usr/bin/env node
// @browser_use/eve — scaffolds the thin files that wire @browser_use/eve into an
// eve app. Mirrors the ergonomics of `eve channels add <kind>`.
import { resolve } from "node:path";
import { scaffold, ScaffoldError } from "./scaffold.js";

function runAdd(args: string[]): void {
  const force = args.includes("--force");
  const target = args.find((a) => !a.startsWith("--"));
  const root = resolve(target ?? ".");

  let result;
  try {
    result = scaffold(root, { force });
  } catch (err) {
    const msg = err instanceof ScaffoldError ? err.message : String(err);
    console.error(`@browser_use/eve: ${msg}`);
    process.exit(1);
  }

  console.log("\n  @browser_use/eve — cloud browser for your eve agent\n");
  for (const f of result.written) console.log(`  + ${f}`);
  for (const f of result.skipped) console.log(`  · ${f}  (exists — re-run with --force to overwrite)`);

  const next: string[] = [];
  if (result.missingDep) next.push("npm i @browser_use/eve");
  if (result.missingKey) next.push("add BROWSER_USE_API_KEY=bu_... to .env.local");
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
      runAdd(rest);
      break;
    case undefined:
    case "-h":
    case "--help":
      console.log("Usage: @browser_use/eve add [target-dir] [--force]");
      break;
    default:
      console.error(`@browser_use/eve: unknown command "${cmd}". Try: @browser_use/eve add`);
      process.exit(1);
  }
}

main();
