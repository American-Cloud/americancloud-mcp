import { defineConfig } from "tsup";

// Two ESM entry points. dist/index.js is the stdio bin: the shebang banner
// makes it directly executable via the package.json `bin` field
// (`npx @americancloud/mcp`). dist/http.js is the hosted server
// (`node dist/http.js`). The banner has no effect on it.
export default defineConfig({
  entry: ["src/index.ts", "src/http.ts"],
  format: ["esm"],
  // Each entry is one self-contained file, as the stdio bin was before.
  splitting: false,
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false, // it's a bin, not a library — no public type surface
  banner: { js: "#!/usr/bin/env node" },
});
