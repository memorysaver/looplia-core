import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "claude-agent-sdk/index": "src/claude-agent-sdk/index.ts",
  },
  format: ["esm"],
  platform: "node",
  target: "esnext",
  clean: true,
  dts: true,
  splitting: true,
  shims: true,
});
