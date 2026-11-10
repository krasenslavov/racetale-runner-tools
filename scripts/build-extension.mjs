// Build the RaceTale Pace Tools browser extension into extension/dist/ (docs/BACKLINKS-PLAN.md 7.5).
//   node scripts/build-extension.mjs     needs icons (node scripts/listing-assets.mjs)
// Writes three zips: chrome (also for Edge), firefox, and firefox-source (AMO asks for the source).
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const SRC = "extension/src";
const DIST = "extension/dist";
const manifest = JSON.parse(readFileSync(`${SRC}/manifest.json`, "utf8"));
const version = manifest.version;
rmSync(DIST, { recursive: true, force: true });

for (const target of ["chrome", "firefox"]) {
  const dir = `${DIST}/${target}`;
  mkdirSync(`${dir}/icons`, { recursive: true });
  for (const size of [16, 32, 48, 128])
    copyFileSync(`icons/icon-${size}.png`, `${dir}/icons/icon-${size}.png`);
  for (const f of ["popup.html", "popup.css"]) copyFileSync(`${SRC}/${f}`, `${dir}/${f}`);
  // Not minified, so reviewers can read it.
  await build({
    entryPoints: [`${SRC}/popup.js`],
    bundle: true,
    format: "iife",
    target: "es2020",
    outfile: `${dir}/popup.js`,
  });
  const m = structuredClone(manifest);
  if (target === "firefox") {
    m.browser_specific_settings = {
      gecko: {
        id: "pace-tools@racetale.com",
        strict_min_version: "140.0",
        data_collection_permissions: { required: ["none"] },
      },
    };
  }
  writeFileSync(`${dir}/manifest.json`, JSON.stringify(m, null, 2) + "\n");
  execFileSync("zip", ["-qr", `../racetale-pace-tools-${target}-${version}.zip`, "."], {
    cwd: dir,
  });
}

// Source for Firefox review: everything needed to rebuild, plus build steps.
const srcDir = `${DIST}/source`;
mkdirSync(`${srcDir}/scripts`, { recursive: true });
mkdirSync(`${srcDir}/packages/pace/src`, { recursive: true });

cpSync(SRC, `${srcDir}/extension/src`, { recursive: true });
copyFileSync("packages/pace/src/index.ts", `${srcDir}/packages/pace/src/index.ts`);
copyFileSync("scripts/build-extension.mjs", `${srcDir}/scripts/build-extension.mjs`);
cpSync("icons", `${srcDir}/icons`, { recursive: true });
writeFileSync(
  `${srcDir}/package.json`,
  JSON.stringify(
    {
      name: "racetale-pace-tools-source",
      private: true,
      type: "module",
      devDependencies: { esbuild: "*" },
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  `${srcDir}/README.md`,
  `# Build steps (RaceTale Pace Tools ${version})\n\n1. Node 18 or newer.\n2. \`npm install\`\n3. \`node scripts/build-extension.mjs\`\n\nThe script bundles extension/src/popup.js with esbuild (no minification) together with src/lib/run-tools.ts, and writes the add-on to extension/dist/firefox. It needs \`zip\` on the PATH. The add-on makes no network calls.\n`,
);
execFileSync("zip", ["-qr", `../racetale-pace-tools-source-${version}.zip`, "."], { cwd: srcDir });
rmSync(srcDir, { recursive: true, force: true });
console.log(`Built ${DIST}: chrome, firefox and source zips (${version})`);
