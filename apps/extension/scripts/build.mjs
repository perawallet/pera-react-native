/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { execSync } from 'node:child_process'
import {
    cpSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mobileDir = path.resolve(root, '../mobile')
const dist = path.join(root, 'dist')

const SURFACES = ['popup', 'expanded', 'approval']
const POPUP_CSS =
    '<style>html,body{width:360px;height:600px;margin:0;overflow:hidden}#root{width:100%;height:100%}</style>'

rmSync(dist, { recursive: true, force: true })

// 1. Export the react-native-web UI bundle straight into dist/
execSync(`pnpm exec expo export --platform web --output-dir "${dist}"`, {
    cwd: mobileDir,
    stdio: 'inherit',
})

// Chrome rejects unpacked extensions containing top-level names that start
// with "_" (reserved, except _locales) — expo export emits _expo/.
renameSync(path.join(dist, '_expo'), path.join(dist, 'expo-static'))

// Patch JS bundles: Metro bakes the chunk URL with the pre-rename "_expo/"
// prefix; replace it so dynamic imports resolve to the renamed path.
const jsBundleDir = path.join(dist, 'expo-static', 'static', 'js', 'web')
let chunkFiles
try {
    chunkFiles = readdirSync(jsBundleDir).filter(f => f.endsWith('.js'))
} catch (error) {
    throw new Error(
        `JS bundle dir not found at ${jsBundleDir} — Metro output structure ` +
            'may have changed; update the /_expo/ patch loop in build.mjs',
        { cause: error },
    )
}
for (const file of chunkFiles) {
    const filePath = path.join(jsBundleDir, file)
    const patched = readFileSync(filePath, 'utf8').replaceAll('/_expo/', '/expo-static/')
    writeFileSync(filePath, patched)
}

// 2. Bundle the extension service worker
await build({
    entryPoints: [path.join(root, 'src/background/index.ts')],
    outfile: path.join(dist, 'background.js'),
    bundle: true,
    format: 'esm',
    target: 'chrome120',
    alias: {
        '@perawallet/wallet-extension-keystore-chrome/vault/autolock': path.join(
            root,
            '../../extensions/keystore-chrome/src/vault/autolock.ts',
        ),
        '@perawallet/wallet-extension-platform-chrome': path.join(
            root,
            '../../extensions/platform-chrome/src/index.ts',
        ),
    },
})

// 3. Surface HTMLs: one exported bundle, per-surface flag injected via an
//    EXTERNAL script — MV3 CSP (script-src 'self') forbids inline scripts.
const indexHtml = readFileSync(path.join(dist, 'index.html'), 'utf8').replaceAll(
    '_expo/',
    'expo-static/',
)
if (!indexHtml.includes('<head>') || !indexHtml.includes('</head>')) {
    throw new Error('exported index.html has no <head>/</head> tag — expo export output shape changed')
}
for (const surface of SURFACES) {
    writeFileSync(
        path.join(dist, `surface-${surface}.js`),
        `window.__PERA_SURFACE__=${JSON.stringify(surface)}\n`,
    )
    let html = indexHtml.replace(
        '<head>',
        `<head><script src="./surface-${surface}.js"></script>`,
    )
    if (surface === 'popup') {
        // Inject at the END of <head> (not the start) so these rules come
        // after expo's own "#expo-reset" reset stylesheet in source order.
        // Both use equal-specificity html/body/#root selectors, so without
        // this ordering expo-reset's `height:100%` (which resolves against
        // Chrome's auto-sizing popup window, not a fixed viewport) wins the
        // cascade and collapses the popup to ~30px tall.
        html = html.replace('</head>', `${POPUP_CSS}</head>`)
    }
    writeFileSync(path.join(dist, `${surface}.html`), html)
}
rmSync(path.join(dist, 'index.html'))

// 4. Manifest
cpSync(path.join(root, 'manifest.json'), path.join(dist, 'manifest.json'))

// Regression guard: Chrome rejects reserved names
const reservedNames = readdirSync(dist).filter(
    name => name.startsWith('_') && name !== '_locales',
)
if (reservedNames.length > 0) {
    throw new Error(
        `dist contains names reserved by Chrome: ${reservedNames.join(', ')}`,
    )
}

console.info(`[extension] built ${dist}`)
