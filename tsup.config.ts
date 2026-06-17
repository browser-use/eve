import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/sandbox/index.ts",
    "src/skill/index.ts",
    "src/tools/open-cloud-browser.ts",
    "src/tools/stop-cloud-browser.ts",
    "src/cli/index.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node24",
  outDir: "dist",
  // eve + zod are peers, browser-use-sdk is a runtime dep — never bundle them.
  external: ["eve", "zod", "browser-use-sdk"],
});
