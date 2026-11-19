// Leonida Legend — the hand-in program for the GTA 6 trophy guide entry.
// Node 22, standard library only. It takes this repository's app/ folder
// (the static guide: index.html, styles, scripts and trophy data) and its
// screenshots/ folder, copies both into the output directory, and writes
// /output/dossier.json there with the vendored make.fun library, so the
// judge can read the screenshots and a summary of the source. The vendor
// library itself stays untouched: the scorer rebuilds the dossier from its
// own copy and the two must match byte for byte.
//
// Run it locally like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader's container MAKEFUN_OUTPUT_DIR is unset and /output is used.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own limits, so a build that passes here is
// one the gate will accept: at most 4 screenshots of 256 KiB each, at most
// 993 files and directories totalling 48 MiB in app/, and a dossier text
// capped at 160 KiB.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);
