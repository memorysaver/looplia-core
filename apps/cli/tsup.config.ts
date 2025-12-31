import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/index.ts" },
  format: ["esm"],
  platform: "node",
  target: "esnext",
  clean: true,
  dts: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  noExternal: ["@looplia-core/core", "@looplia-core/provider"],
  shims: true,
});
