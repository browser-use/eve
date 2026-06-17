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
   source /workspace/.bu-env && browser-harness-js '<async JS using session.*>'
   \`\`\`

   **Output rule (important): the CLI prints the resolved value of a SINGLE
   expression.** \`console.log\` and multi-statement \`await a; await b; "x"\` print
   nothing. Wrap your steps in one async IIFE that \`return\`s the value you want:

   \`\`\`bash
   source /workspace/.bu-env && browser-harness-js '(async () => { <steps>; return <value>; })()'
   \`\`\`

   Examples:
   - Navigate + read title:
     \`(async () => { await session.Page.navigate({ url: "https://example.com" }); await session.waitFor("Page.loadEventFired"); return (await session.Runtime.evaluate({ expression: "document.title", returnByValue: true })).result.value; })()\`
   - Read body text:
     \`(async () => (await session.Runtime.evaluate({ expression: "document.body.innerText", returnByValue: true })).result.value)()\`
   - List tabs:
     \`listPageTargets()\`
   - Click (x, y):
     \`(async () => { for (const type of ["mousePressed","mouseReleased"]) await session.Input.dispatchMouseEvent({ type, x, y, button: "left", clickCount: 1 }); return "clicked"; })()\`
   - Screenshot (base64 PNG length):
     \`(async () => (await session.Page.captureScreenshot()).data.length)()\`

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
