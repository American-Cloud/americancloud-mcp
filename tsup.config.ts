import { defineConfig } from "tsup";

// Single ESM bin. The shebang banner makes dist/index.js directly executable
// via the package.json `bin` field (`npx @americancloud/mcp`).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false, // it's a bin, not a library — no public type surface
  banner: { js: "#!/usr/bin/env node" },
});
