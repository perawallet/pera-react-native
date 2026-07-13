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

// 2. Bundle the extension service worker
await build({
    entryPoints: [path.join(root, 'src/background/index.ts')],
    outfile: path.join(dist, 'background.js'),
    bundle: true,
    format: 'esm',
    target: 'chrome120',
})

// 3. Surface HTMLs: one exported bundle, per-surface flag injected via an
//    EXTERNAL script — MV3 CSP (script-src 'self') forbids inline scripts.
const indexHtml = readFileSync(path.join(dist, 'index.html'), 'utf8').replaceAll(
    '_expo/',
    'expo-static/',
)
if (!indexHtml.includes('<head>')) {
    throw new Error('exported index.html has no <head> tag — expo export output shape changed')
}
for (const surface of SURFACES) {
    writeFileSync(
        path.join(dist, `surface-${surface}.js`),
        `window.__PERA_SURFACE__=${JSON.stringify(surface)}\n`,
    )
    const extraHead =
        `<script src="./surface-${surface}.js"></script>` +
        (surface === 'popup' ? POPUP_CSS : '')
    writeFileSync(
        path.join(dist, `${surface}.html`),
        indexHtml.replace('<head>', `<head>${extraHead}`),
    )
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
