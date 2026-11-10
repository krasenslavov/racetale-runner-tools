import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
for (const [format, outfile] of [["esm", "dist/index.js"], ["cjs", "dist/index.cjs"]])
  await build({ entryPoints: ["src/index.ts"], bundle: true, format, outfile, target: "es2020" });
execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { stdio: "inherit" });
