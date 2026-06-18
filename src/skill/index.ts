import { defineSkill } from "eve/skills";

const MARKDOWN = `You browse the live web with a Browser Use **cloud browser**, driven by the
\`browser-harness-js\` CLI. This is raw, typed Chrome DevTools Protocol — every
Chrome capability is \`session.<Domain>.<method>(params)\`. There are no
\`goto()\`/\`click()\` helpers; you write the CDP call directly.

## Workflow

1. **Open the browser.** Call the \`open_cloud_browser\` tool once. It provisions a
   cloud browser, connects the driver, focuses a tab, and returns a \`liveUrl\`
   (share it so a human can watch).

2. **Drive it.** Run each CDP snippet as a single bash command (the env file puts
   the CLI on PATH; the \`session\` is already connected, with the Page and Runtime
   domains enabled):

   \`\`\`bash
   source /workspace/.bu-env && browser-harness-js '<snippet>'
   \`\`\`

   ### Output — follow this exactly

   The CLI prints **only the value your snippet \`return\`s**, and prints **nothing**
   for \`undefined\`, \`""\`, \`[]\`, or \`{}\`. So wrap **every** snippet in an async IIFE
   that returns a **JSON string**:

   \`\`\`js
   (async () => { /* steps */ ; return JSON.stringify(value); })()
   \`\`\`

   - Always \`return\` — multi-statement code with no \`return\` evaluates to
     \`undefined\` and prints nothing.
   - Always \`JSON.stringify(...)\` — so arrays, objects, numbers, and booleans print
     instead of hitting the "empty" path.
   - Do **not** use \`console.log\` — it prints nothing.

   ### Examples (each is one bash command)

   - Navigate, then read the title:
     \`(async () => { await session.Page.navigate({ url: "https://example.com" }); await session.waitFor("Page.loadEventFired"); const r = await session.Runtime.evaluate({ expression: "document.title", returnByValue: true }); return JSON.stringify(r.result.value); })()\`
   - Extract a list (e.g. Hacker News titles):
     \`(async () => { const r = await session.Runtime.evaluate({ expression: "Array.from(document.querySelectorAll('.titleline a')).slice(0,5).map(a => a.textContent)", returnByValue: true }); return JSON.stringify(r.result.value); })()\`
   - Read body text:
     \`(async () => { const r = await session.Runtime.evaluate({ expression: "document.body.innerText", returnByValue: true }); return JSON.stringify(r.result.value); })()\`
   - List tabs:
     \`(async () => { return JSON.stringify(await listPageTargets()); })()\`
   - Click (x, y):
     \`(async () => { for (const type of ["mousePressed","mouseReleased"]) await session.Input.dispatchMouseEvent({ type, x, y, button: "left", clickCount: 1 }); return JSON.stringify("clicked"); })()\`
   - Screenshot (returns base64 PNG length):
     \`(async () => { const s = await session.Page.captureScreenshot(); return JSON.stringify(s.data.length); })()\`

3. **Close it.** Call the \`stop_cloud_browser\` tool when the task is done, to end
   the cloud browser's billing.

It's pure CDP: if Chrome can do it, you can call it as \`session.<Domain>.<method>\`.`;

/** The eve skill that teaches the agent to browse with the cloud browser. */
export function browserUseSkill() {
  return defineSkill({
    description:
      "Use when the task needs to browse the live web, scrape a page, read on-screen content, click or type in a real browser, or screenshot a site.",
    markdown: MARKDOWN,
  });
}

export default browserUseSkill();
