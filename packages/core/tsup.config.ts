import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "esnext",
  clean: true,
  dts: true,
  splitting: true,
  shims: true,
});
