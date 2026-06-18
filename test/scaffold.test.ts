import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HARNESS_FILES, scaffold, ScaffoldError } from "../src/cli/scaffold.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bue-scaffold-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writePkg(json = "{}"): void {
  writeFileSync(join(dir, "package.json"), json);
}

describe("scaffold", () => {
  it("writes the four thin files", () => {
    writePkg();
    const r = scaffold(dir);
    expect(r.written.sort()).toEqual(Object.keys(HARNESS_FILES).sort());
    for (const f of Object.keys(HARNESS_FILES)) {
      expect(existsSync(join(dir, f))).toBe(true);
    }
    expect(readFileSync(join(dir, "agent/sandbox/sandbox.ts"), "utf8")).toContain(
      "browserUseSandbox",
    );
  });

  it("is idempotent — skips existing files without --force", () => {
    writePkg();
    scaffold(dir);
    const r = scaffold(dir);
    expect(r.written).toEqual([]);
    expect(r.skipped).toHaveLength(4);
  });

  it("overwrites with force", () => {
    writePkg();
    scaffold(dir);
    writeFileSync(join(dir, "agent/sandbox/sandbox.ts"), "// hand-edited");
    const r = scaffold(dir, { force: true });
    expect(r.written).toHaveLength(4);
    expect(readFileSync(join(dir, "agent/sandbox/sandbox.ts"), "utf8")).toContain(
      "browserUseSandbox",
    );
  });

  it("throws ScaffoldError when there is no package.json", () => {
    expect(() => scaffold(dir)).toThrow(ScaffoldError);
  });

  it("reports missing dependency and key", () => {
    writePkg('{"dependencies":{}}');
    const r = scaffold(dir);
    expect(r.missingDep).toBe(true);
    expect(r.missingKey).toBe(true);
  });

  it("clears the nudges when dep + key are present", () => {
    writePkg('{"dependencies":{"@browser_use/eve":"*"}}');
    writeFileSync(join(dir, ".env.local"), "BROWSER_USE_API_KEY=bu_test\n");
    const r = scaffold(dir);
    expect(r.missingDep).toBe(false);
    expect(r.missingKey).toBe(false);
  });
});
