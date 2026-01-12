import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: { cli: "src/index.ts" },
  format: ["esm"],
  platform: "node",
  target: "esnext",
  clean: true,
  dts: true,
  banner: {
    js: "#!/usr/bin/env bun",
  },
  // Bundle all dependencies for standalone CLI (enables `bun link` to work)
  noExternal: [
    "@looplia-core/core",
    "@looplia-core/provider",
    "ink",
    "react",
    "react/jsx-runtime",
  ],
  // Exclude optional dev dependencies that ink tries to import
  external: ["react-devtools-core"],
  shims: true,
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
});
