import { defineSkill } from "eve/skills";

const MARKDOWN = `You browse the live web with a Browser Use **cloud browser**, driven by the
\`browser-harness-js\` CLI. This is raw, typed Chrome DevTools Protocol — every
Chrome capability is \`session.<Domain>.<method>(params)\`. There are no
\`goto()\`/\`click()\` helpers; you write the CDP call directly.

## Workflow

1. **Open the browser.** Call the \`open_cloud_browser\` tool once. It provisions a
   cloud browser, connects the driver, focuses a tab, and returns a \`liveUrl\`
   (share it so a human can watch).

2. **Drive it.** Run each CDP call as a single bash command (the env file puts the
   CLI on PATH; the \`session\` is already connected with the Page and Runtime
   domains enabled):

   \`\`\`bash
   source /workspace/.bu-env && browser-harness-js '<one JS expression>'
   \`\`\`

   ### Output rules — follow exactly, or you get empty output

   The CLI prints the value of **one single expression**. It silently prints
   **nothing** if your snippet contains a \`;\` or newline, uses \`const\`/\`let\`/\`return\`,
   or evaluates to \`undefined\`/\`""\`/\`[]\`/\`{}\`. So:

   - **One expression per call. No semicolons, no newlines, no \`const\`/\`let\`/\`return\`.**
   - **Sequence steps with \`.then(...)\`** (not \`;\`), or just run them as **separate
     calls** — the \`session\` persists between calls.
   - **Wrap the result in \`JSON.stringify(...)\`** so strings, arrays, numbers, and
     objects all print.
   - Put any page-side logic **inside the \`Runtime.evaluate\` \`expression\` string**
     (that runs in the browser, where normal multi-line JS is fine).
   - Never use \`console.log\` — it prints nothing.

   ### Examples (each is one bash command)

   - Navigate and wait:
     \`session.Page.navigate({ url: "https://news.ycombinator.com" }).then(() => session.waitFor("Page.loadEventFired")).then(() => JSON.stringify("ok"))\`
   - Read the title:
     \`JSON.stringify((await session.Runtime.evaluate({ expression: "document.title", returnByValue: true })).result.value)\`
   - Extract a list (page logic lives in the expression string):
     \`JSON.stringify((await session.Runtime.evaluate({ expression: "Array.from(document.querySelectorAll('.titleline a')).slice(0,3).map(a => a.textContent)", returnByValue: true })).result.value)\`
   - List tabs:
     \`listPageTargets().then(t => JSON.stringify(t))\`
   - Click (x, y):
     \`session.Input.dispatchMouseEvent({ type: "mousePressed", x, y, button: "left", clickCount: 1 }).then(() => session.Input.dispatchMouseEvent({ type: "mouseReleased", x, y, button: "left", clickCount: 1 })).then(() => JSON.stringify("clicked"))\`
   - Screenshot (returns base64 PNG length):
     \`session.Page.captureScreenshot().then(s => JSON.stringify(s.data.length))\`

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
