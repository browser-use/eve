import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXAMPLE_SNIPPETS } from "../src/skill/index.ts";

// --- Mirror of browser-harness-js sdk/repl.ts output semantics (keep in sync). ---
// The REPL only auto-returns a SINGLE expression (no `;`/newline, not starting
// with a statement keyword); anything else is run without a `return` and yields
// `undefined`. renderResult prints nothing for undefined/""/[]/{}.
function isExpression(code: string): boolean {
  const t = code.trim();
  if (/[;\n]/.test(t)) return false;
  if (/^(let|const|var|if|for|while|do|switch|class|function|throw|try|return|import|export)\b/.test(t)) return false;
  return true;
}
async function runSnippet(code: string): Promise<unknown> {
  const body = isExpression(code) ? `return (${code});` : code;
  const wrapped = `(async () => { ${body} })()`;
  return await (0, eval)(wrapped);
}
function renderResult(s: unknown): string {
  if (s === undefined || s === null) return "";
  if (typeof s === "string") return s;
  if (Array.isArray(s) && s.length === 0) return "";
  if (typeof s === "object" && s !== null && Object.keys(s as object).length === 0) return "";
  return JSON.stringify(s);
}

// Stub the globals the snippets reference (the REPL exposes `session` +
// `listPageTargets`; example placeholders `x`/`y` are coordinates).
beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.x = 100;
  g.y = 200;
  g.listPageTargets = async () => [{ targetId: "t", title: "x", url: "https://x" }];
  g.session = {
    Page: {
      navigate: async () => ({ frameId: "f" }),
      captureScreenshot: async () => ({ data: "AAAA" }),
      enable: async () => undefined,
    },
    Runtime: {
      evaluate: async () => ({ result: { value: ["a", "b", "c"] } }),
      enable: async () => undefined,
    },
    Input: { dispatchMouseEvent: async () => undefined },
    waitFor: async () => undefined,
    use: async () => "sid",
    connect: async () => undefined,
  };
});
afterAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const k of ["x", "y", "listPageTargets", "session"]) delete g[k];
});

describe("skill example snippets", () => {
  it("has examples", () => {
    expect(EXAMPLE_SNIPPETS.length).toBeGreaterThan(0);
  });

  for (const { label, code } of EXAMPLE_SNIPPETS) {
    it(`prints non-empty output: ${label}`, async () => {
      // Structural rule — the 0.0.3 bug was multi-statement (had a `;`).
      expect(isExpression(code), `must be one expression (no ; or newline): ${code}`).toBe(true);
      // Functional rule — actually produces output through the REPL.
      const printed = renderResult(await runSnippet(code));
      expect(printed, `printed empty: ${code}`).not.toBe("");
    });
  }

  it("self-check: the broken 0.0.3 pattern would fail this test", async () => {
    const broken = `(async () => { return JSON.stringify("ping"); })()`;
    expect(isExpression(broken)).toBe(false); // has `;`
    expect(renderResult(await runSnippet(broken))).toBe(""); // yields undefined → empty
  });
});
