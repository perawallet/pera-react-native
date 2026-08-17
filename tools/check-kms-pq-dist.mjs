/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * Asserts that `@perawallet/wallet-core-kms` ships two library builds and that
 * React Native resolves the on-device one.
 *
 * Why this exists: quantum accounts pick their Falcon-1024 backend at BUILD
 * time, not at runtime. `getPQProvider.native.ts` is Metro's `.native.*`
 * override of `getPQProvider.ts`, but that resolution happens over files, and
 * a library build flattens `src/` into a single module — so `dist` must carry
 * a separate on-device artifact, reached through the `react-native` export
 * condition.
 *
 * The failure mode is silent. If the condition is dropped, or the second build
 * pass is removed from the `build` script, mobile falls back to the off-device
 * bundle and signs with WASM Falcon. Signatures stay well-formed and every
 * test stays green; the app just stops using the native module. For most of
 * this package's life the only thing preventing that was an unrelated
 * convenience alias in apps/mobile/metro.config.js that rewrites
 * `@perawallet/wallet-core-*` to source — deleting that line was enough to
 * flip the provider, with nothing to catch it.
 *
 * **Why the `react-native` condition is the right mechanism.** Metro consults
 * `exports` in preference to `resolverMainFields`, so a top-level
 * `"react-native"` field would be ignored while an `exports` map exists. The
 * condition does match on device even though apps/mobile/metro.config.js sets
 * `unstable_conditionNames` to ['require', 'import']: metro-resolver builds the
 * asserted set as {default} + import/require + `unstable_conditionNames` +
 * `unstable_conditionsByPlatform[platform]`, and Expo's default supplies
 * `react-native` for ios/android (metro-resolver 0.84.4,
 * src/utils/matchSubpathFromExportsLike.js). On web that platform entry is
 * `browser` instead, so the map correctly falls through to `default` — which
 * is why the condition is used rather than dropping `exports` in favour of
 * `resolverMainFields`. That array is not platform-scoped, so it would hand
 * the native bundle to the `expo export --platform web` extension build too.
 *
 * Bundle contents are checked by marker rather than by parsing. Note the
 * native check requires a STATIC import: rolldown rewrites a `require` of an
 * external into its own runtime shim, which Metro's dependency collector never
 * records (it only recognises callees literally named `require`) and which
 * throws on first use. A substring test for the package name alone would pass
 * on exactly that broken bundle.
 */

import { readFileSync, existsSync, statSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const kmsRoot = resolve(repoRoot, 'packages/kms')

const DEFAULT_ENTRY = 'dist/index.js'
const NATIVE_ENTRY = 'dist/index.native.js'

const NATIVE_MODULE = '@joe-p/react-native-falcon'
// A real ESM import Metro can resolve, as opposed to rolldown's require shim.
const NATIVE_STATIC_IMPORT = /from\s*["']@joe-p\/react-native-falcon["']/
// The native module reached through rolldown's `require` shim (`k("…")`).
// Scoped to this specifier: the off-device WASM provider legitimately keeps a
// lazy `require('falcon-1024')`, so the shim's mere presence proves nothing.
const SHIMMED_NATIVE_REQUIRE = /\(\s*["']@joe-p\/react-native-falcon["']\s*\)/
// Emscripten glue symbol from falcon-1024, bundled into the off-device build.
const WASM_MARKER = 'falcon_det1024'

const failures = []

const fail = message => failures.push(message)

const checkPackaging = () => {
    const pkg = JSON.parse(readFileSync(resolve(kmsRoot, 'package.json'), 'utf8'))

    const root = pkg.exports?.['.']
    if (root?.['react-native'] !== `./${NATIVE_ENTRY}`) {
        fail(
            `packages/kms/package.json: exports["."]["react-native"] must be "./${NATIVE_ENTRY}", got ${JSON.stringify(root?.['react-native'])}. Without it Metro resolves the off-device bundle and quantum accounts sign with WASM Falcon.`,
        )
    }

    if (root?.default !== `./${DEFAULT_ENTRY}`) {
        fail(
            `packages/kms/package.json: exports["."]["default"] must be "./${DEFAULT_ENTRY}", got ${JSON.stringify(root?.default)}.`,
        )
    }

    const order = Object.keys(root ?? {})
    if (order.indexOf('react-native') > order.indexOf('default')) {
        fail(
            'packages/kms/package.json: the "react-native" export condition must be declared before "default" — conditions match in declaration order, so "default" would win on device.',
        )
    }

    // resolverMainFields is not platform-scoped, so this field would also win
    // on the web build and hand the extension a react-native bundle.
    if (pkg['react-native'] !== undefined) {
        fail(
            'packages/kms/package.json declares a top-level "react-native" field. Metro ignores it while "exports" exists, and if "exports" were ever removed it would take effect on the web build too. Use the export condition only.',
        )
    }

    if (!pkg.scripts?.build?.includes('--mode native')) {
        fail(
            'packages/kms/package.json: the build script must run the native pass (`vite build --mode native`) as well as the default one.',
        )
    }
}

const checkBundles = () => {
    const defaultPath = resolve(kmsRoot, DEFAULT_ENTRY)
    const nativePath = resolve(kmsRoot, NATIVE_ENTRY)

    // Unbuilt is not a failure: `test` only depends on `^build`, so this runs
    // against a cold dist often enough that failing there would be noise. The
    // build itself asserts the same invariants (packages/kms/vite.config.ts).
    if (!existsSync(defaultPath)) {
        console.log('SKIP: packages/kms/dist not built — bundle contents not checked.')
        return
    }

    if (!existsSync(nativePath)) {
        fail(
            `packages/kms/${NATIVE_ENTRY} is missing while ${DEFAULT_ENTRY} exists — the native build pass did not run.`,
        )
        return
    }

    // Neither pass empties dist (the second would wipe the first, and the `dev`
    // watcher rebuilds only the default target), so a native bundle left over
    // from an older source tree would otherwise satisfy every marker below. The
    // build writes default-then-native, so an older native bundle means the two
    // came from different runs.
    if (statSync(nativePath).mtimeMs < statSync(defaultPath).mtimeMs) {
        fail(
            `packages/kms/${NATIVE_ENTRY} is older than ${DEFAULT_ENTRY} — the two bundles are from different builds and the on-device one is stale. Run \`pnpm --filter @perawallet/wallet-core-kms build\`.`,
        )
    }

    const defaultBundle = readFileSync(defaultPath, 'utf8')
    const nativeBundle = readFileSync(nativePath, 'utf8')

    if (!NATIVE_STATIC_IMPORT.test(nativeBundle)) {
        fail(
            `packages/kms/${NATIVE_ENTRY} has no static import of ${NATIVE_MODULE}. Metro only records dependencies whose callee is literally \`require\`, so the native module would never enter the bundle graph and signing would throw on first use.`,
        )
    }
    if (SHIMMED_NATIVE_REQUIRE.test(nativeBundle)) {
        fail(
            `packages/kms/${NATIVE_ENTRY} reaches ${NATIVE_MODULE} through rolldown's \`require\` shim instead of a static import, which Metro cannot see.`,
        )
    }
    if (nativeBundle.includes(WASM_MARKER)) {
        fail(
            `packages/kms/${NATIVE_ENTRY} bundles the falcon-1024 WASM glue — the on-device bundle should reach the native module only.`,
        )
    }
    if (!defaultBundle.includes(WASM_MARKER)) {
        fail(
            `packages/kms/${DEFAULT_ENTRY} does not bundle the falcon-1024 WASM glue — the off-device bundle has no working PQ provider under node, vitest or the web build.`,
        )
    }
    if (defaultBundle.includes(NATIVE_MODULE)) {
        fail(
            `packages/kms/${DEFAULT_ENTRY} references ${NATIVE_MODULE} — the off-device bundle must not reach the native module.`,
        )
    }
}

checkPackaging()
checkBundles()

if (failures.length > 0) {
    console.error('kms PQ provider packaging check failed:\n')
    for (const failure of failures) {
        console.error(`  - ${failure}`)
    }
    console.error(
        '\nSee packages/kms/src/crypto/pq/falconModule.native.ts and this file\'s header.',
    )
    process.exit(1)
}

console.log('OK: kms ships an on-device PQ bundle and React Native resolves it.')
