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
    mkdirSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const requireFromHere = createRequire(import.meta.url)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mobileDir = path.resolve(root, '../mobile')
const dist = path.join(root, 'dist')

const SURFACES = ['popup', 'expanded', 'approval', 'offscreen']
// Popup: 423.53x705.89 CSS layout at 0.85 zoom = a 360x600 physical popup
// (Chrome's height cap). zoom scales the declared box and Chrome sizes the
// popup window to rendered content, so declaring 360x600 directly would
// shrink the real popup to 306x510.
const POPUP_CSS =
    '<style>html,body{width:423.53px;height:705.89px;margin:0;overflow:hidden}html{zoom:0.85}#root{width:100%;height:100%}</style>'
// Web-only, all surfaces: react-native-web renders <Text> as selectable HTML
// (native RN text isn't selectable), so a click-drag over any label selects
// text instead of feeling like a native drag/scroll gesture. `user-select:
// none` restores the app-like feel; text inputs are re-enabled explicitly so
// typing/editing/selecting-to-copy in a field still works. Scrollable
// containers also need an explicit, always-visible scrollbar: RNW scroll
// containers rely on the OS scrollbar, which on macOS ("show scrollbars:
// when scrolling") is invisible at rest, so desktop users have no visual cue
// the popup's fixed-size body scrolls at all. The thumb uses a single
// mid-gray, not a `prefers-color-scheme: dark` media query, because
// light/dark here is decided by the app's own in-extension theme setting
// (`useSettings().theme` / `useIsDarkMode`), which a user can force
// independently of their OS theme -- a light-OS user who forces dark-in-app
// would otherwise get the light-mode near-black thumb, nearly invisible
// against a dark app background. Mid-gray at 0.5 alpha reads against both
// light and dark grounds, so one rule covers every OS/app theme combination.
//
// html/body background-color IS keyed off `prefers-color-scheme` (unlike the
// scrollbar thumb above) because this is only the pre-mount fallback: before
// React mounts (or if the themed root View below it ever fails to cover the
// viewport), these colors paint instead of the browser's default grey/white.
// They can only see the OS theme, not an in-app light/dark override -- that
// override is handled authoritatively once mounted by the themed root View
// in AppShell.web.tsx (theme.colors.background via ThemeProvider), which
// takes precedence visually because it paints on top. Hex values mirror
// apps/mobile/src/theme/colors.ts: light = palette.white (#FFFFFF), dark =
// palette.gray[900] (#18181B), matching theme.ts's light/dark `background`.
const GLOBAL_WEB_CSS = `<style>
html, body { background-color: #FFFFFF; }
@media (prefers-color-scheme: dark) { html, body { background-color: #18181B; } }
*, *::before, *::after { -webkit-user-select: none; user-select: none; }
input, textarea, [contenteditable], [contenteditable="true"] { -webkit-user-select: text; user-select: text; }
* { scrollbar-width: thin; scrollbar-color: rgba(128,128,128,0.5) transparent; }
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.5); border-radius: 4px; }
*::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.7); }
/* RN UIs never rely on browser scroll anchoring (native scroll views have none); left on, it fights collapsing/expanding content and can cause scroll-position feedback loops. */
* { overflow-anchor: none; }
</style>`

rmSync(dist, { recursive: true, force: true })

// 0. Bake backend credentials into packages/config before anything reads
// them. Metro (step 1 below) resolves @perawallet/wallet-core-* packages
// straight from `src/` (see apps/mobile/metro.config.js), so generated-env.ts
// just needs to exist on disk. The service-worker/content-script esbuild
// bundles (step 2+) have no such source alias — they resolve every
// @perawallet/wallet-core-*/@perawallet/wallet-extension-* package through
// node_modules -> package.json "main"/exports -> dist/, so each of those
// packages must be built here too, or esbuild ships whatever `dist` happens
// to already exist on disk (nothing, on a clean CI checkout — this job runs
// on its own runner with no access to the separate "Build" job's output).
const monorepoRoot = path.resolve(root, '../..')
execSync('bash tools/generate-config.sh', {
    cwd: monorepoRoot,
    stdio: 'inherit',
})
// packages/config specifically must be rebuilt right after generate-config.sh
// (not just picked up by the broader turbo build below) so the freshly
// generated generated-env.ts is what's baked into its dist, not a stale
// cache from a previous run with different secrets.
execSync('pnpm --filter ./packages/config build', {
    cwd: monorepoRoot,
    stdio: 'inherit',
})
// Build every other workspace package/extension apps/browser depends on
// (transitively), via turbo's own dependency graph — so esbuild's dist-based
// resolution above always has something real to resolve to.
execSync('pnpm exec turbo run build --filter=...browser', {
    cwd: monorepoRoot,
    stdio: 'inherit',
})
const generatedEnv = readFileSync(
    path.join(monorepoRoot, 'packages/config/src/generated-env.ts'),
    'utf8',
)
// generate-config.sh only emits a key's line when the source env var is
// non-empty (see its append_config helper), so a missing/blank
// BACKEND_API_KEY leaves this line out entirely rather than writing "".
if (!/backendAPIKey:\s*"[^"]+"/.test(generatedEnv)) {
    console.warn(
        '\n⚠ BACKEND_API_KEY is empty — Pera backend calls will 401. ' +
            'Add it to the repo-root .env (see apps/browser/README.md).\n',
    )
}

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
    const patched = readFileSync(filePath, 'utf8').replaceAll(
        '/_expo/',
        '/expo-static/',
    )
    writeFileSync(filePath, patched)
}

// 1b. Fonts: expo's web export bakes fontFamily names into the JS but emits
// no font files (the expo-font plugin is native-prebuild-only). Ship the six
// families the app registers (app.config.builder.js UIAppFonts/expo-font
// list) and map them with @font-face under the exact non-iOS family names
// the theme resolves on web (constants/fonts.ts — isIOS() is false).
const FONT_FAMILIES = [
    'DMSansRegular',
    'DMSansMedium',
    'DMSansSemiBold',
    'DMSansBold',
    'DMMonoRegular',
    'DMMonoMedium',
]
mkdirSync(path.join(dist, 'fonts'), { recursive: true })
const fontFaces = []
for (const family of FONT_FAMILIES) {
    const source = path.join(mobileDir, 'assets/fonts', `${family}.ttf`)
    cpSync(source, path.join(dist, 'fonts', `${family}.ttf`))
    fontFaces.push(
        `@font-face{font-family:'${family}';src:url('./fonts/${family}.ttf') format('truetype');font-display:swap}`,
    )
}
writeFileSync(path.join(dist, 'fonts.css'), fontFaces.join('\n') + '\n')

// 2. Bundle the extension service worker
await build({
    entryPoints: [path.join(root, 'src/background/index.ts')],
    outfile: path.join(dist, 'background.js'),
    bundle: true,
    format: 'esm',
    target: 'chrome120',
    alias: {
        '@perawallet/wallet-extension-keystore-chrome/vault/autolock':
            path.join(
                root,
                '../../extensions/keystore-chrome/src/vault/autolock.ts',
            ),
        '@perawallet/wallet-extension-platform-chrome': path.join(
            root,
            '../../extensions/platform-chrome/src/index.ts',
        ),
    },
})

// 2b. Bundle the sqlite worker and ship the wasm binary next to it.
// ESM bundle requires `new Worker(url, { type: 'module' })` for module semantics.
await build({
    entryPoints: [path.join(root, 'src/offscreen/db-worker.ts')],
    outfile: path.join(dist, 'db-worker.js'),
    bundle: true,
    format: 'esm',
    target: 'chrome120',
})
cpSync(
    requireFromHere.resolve('@sqlite.org/sqlite-wasm/sqlite3.wasm'),
    path.join(dist, 'sqlite3.wasm'),
)

// 2c. Content scripts. MAIN world (inject-main) and isolated world (relay) are
// separate bundles so Chrome can load each into its declared world.
for (const [entry, outfile] of [
    ['src/content/inject-main.ts', 'content-inject-main.js'],
    ['src/content/relay-isolated.ts', 'content-relay-isolated.js'],
    ['src/content/discover-main.ts', 'content-discover-main.js'],
    ['src/content/discover-relay.ts', 'content-discover-relay.js'],
    ['src/content/bidali-main.ts', 'content-bidali-main.js'],
    ['src/content/bidali-relay.ts', 'content-bidali-relay.js'],
    ['src/content/webauthn-main.ts', 'content-webauthn-main.js'],
    ['src/content/webauthn-relay.ts', 'content-webauthn-relay.js'],
]) {
    await build({
        entryPoints: [path.join(root, entry)],
        outfile: path.join(dist, outfile),
        bundle: true,
        format: 'iife', // content scripts are classic scripts, not ES modules
        target: 'chrome120',
        alias: {
            // Narrow alias: content scripts run on every http/https page, so
            // they get only the pure ARC-0027 wire (content-wire.ts), not the
            // full barrel (chrome DB host, storage proxy, hydratePlatform,
            // etc.) that the service-worker build below still aliases to.
            '@perawallet/wallet-extension-platform-chrome': path.join(
                root,
                '../../extensions/platform-chrome/src/dapp/content-wire.ts',
            ),
        },
    })
}

// 3. Surface HTMLs: one exported bundle, per-surface flag injected via an
//    EXTERNAL script — MV3 CSP (script-src 'self') forbids inline scripts.
const indexHtml = readFileSync(
    path.join(dist, 'index.html'),
    'utf8',
).replaceAll('_expo/', 'expo-static/')
if (!indexHtml.includes('<head>') || !indexHtml.includes('</head>')) {
    throw new Error(
        'exported index.html has no <head>/</head> tag — expo export output shape changed',
    )
}
for (const surface of SURFACES) {
    writeFileSync(
        path.join(dist, `surface-${surface}.js`),
        `window.__PERA_SURFACE__=${JSON.stringify(surface)}\n`,
    )
    let html = indexHtml.replace(
        '<head>',
        `<head><link rel="stylesheet" href="./fonts.css"><script src="./surface-${surface}.js"></script>${GLOBAL_WEB_CSS}`,
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

// 4b. Extension icons (toolbar/action + management page), referenced by the
// manifest's `icons` and `action.default_icon` maps.
cpSync(path.join(root, 'icons'), path.join(dist, 'icons'), { recursive: true })

// Regression guard: Chrome rejects reserved names
const reservedNames = readdirSync(dist).filter(
    name => name.startsWith('_') && name !== '_locales',
)
if (reservedNames.length > 0) {
    throw new Error(
        `dist contains names reserved by Chrome: ${reservedNames.join(', ')}`,
    )
}

// Regression guard: the baked config must actually reach every surface, not
// just the Metro UI bundle. Metro resolves @perawallet/wallet-core-* straight
// from src/ (so it always sees a fresh generated-env.ts), while the esbuild
// surfaces below resolve through node_modules -> dist/. When those two
// disagree, the popup talks to the right backend and the service worker
// silently talks to the committed staging default with no API key — which is
// indistinguishable from "the feature is just broken". Compare them instead of
// trusting the build order.
const uiBundleDir = path.join(dist, 'expo-static', 'static', 'js', 'web')
const readAll = dir =>
    readdirSync(dir)
        .filter(name => name.endsWith('.js'))
        .map(name => readFileSync(path.join(dir, name), 'utf8'))
        .join('\n')
const uiCode = readAll(uiBundleDir)
const workerCode = readFileSync(path.join(dist, 'background.js'), 'utf8')

const bakedBackend = generatedEnv.match(/mainnetBackendUrl:\s*"([^"]+)"/)?.[1]
if (bakedBackend && !workerCode.includes(bakedBackend)) {
    throw new Error(
        `background.js does not contain the configured backend (${bakedBackend}) — ` +
            'the esbuild surfaces were bundled against a stale packages/*/dist. ' +
            'Most likely a turbo cache hit restored dist/** over the freshly ' +
            'built config (see globalEnv in turbo.json).',
    )
}
if (bakedBackend && !uiCode.includes(bakedBackend)) {
    throw new Error(
        `the exported UI bundle does not contain the configured backend (${bakedBackend}).`,
    )
}
// Deliberately NOT asserting "no staging host appears anywhere": the committed
// staging defaults in packages/config/src/main.ts are schema defaults, so their
// string literals are compiled into every bundle even when an override wins at
// runtime. Presence proves nothing; the two checks above — that the *configured*
// backend reached both bundles — are the ones with signal.

console.info(`[extension] built ${dist}`)
