import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm"],
  dts: {
    sourcemap: false,
  },
  // optimize for node.js environment
  platform: "node",
  // automatically export
  exports: true,

  // optimize building speed
  treeshake: true,
  outDir: "dist",
});
