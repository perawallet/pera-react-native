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

import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

const pq = (file: string) => resolve(__dirname, 'src/crypto/pq', file)

/**
 * The `.native.*` overrides Metro applies on device, which a library build has
 * to apply for itself. `getPQProvider` picks the Falcon backend; `falconModule`
 * decides how that backend reaches the native nitro module.
 */
const NATIVE_OVERRIDES = new Map([
    [pq('getPQProvider.ts'), pq('getPQProvider.native.ts')],
    [pq('falconModule.ts'), pq('falconModule.native.ts')],
])

/**
 * The native module reached through rolldown's `require` shim (`k("…")`)
 * rather than a static import. Scoped to this specifier on purpose: the
 * off-device WASM provider legitimately keeps a lazy `require('falcon-1024')`,
 * so the shim's mere presence in a chunk says nothing.
 */
const SHIMMED_NATIVE_REQUIRE = /\(\s*["']@joe-p\/react-native-falcon["']\s*\)/

/**
 * Applies the `.native.*` overrides for the on-device build and fails the
 * build if the result would not actually work on device.
 *
 * A library build flattens `src/` into one module, baking in whichever variant
 * rolldown saw and leaving Metro no files to choose between — so `dist` has to
 * carry a separate on-device artifact, selected by the `react-native` export
 * condition.
 *
 * Both failure modes this guards are silent. Skipping the swap leaves quantum
 * accounts signing with WASM Falcon on device: slower, but well-formed, so
 * nothing downstream notices. Reaching the native module through a `require`
 * leaves rolldown's shim in the bundle, which Metro's dependency collector
 * ignores (it only records callees literally named `require`) and which throws
 * on first use — so the assertions run here, inside the build CI already runs.
 */
const pqProviderTarget = (target: 'default' | 'native'): Plugin => {
    const swapped = new Set<string>()

    return {
        name: 'pera-pq-provider-target',
        enforce: 'pre',
        async resolveId(source, importer, options) {
            const resolved = await this.resolve(source, importer, {
                ...options,
                skipSelf: true,
            })
            if (!resolved || resolved.external) return resolved
            if (target !== 'native') return resolved

            const override = NATIVE_OVERRIDES.get(resolved.id)
            if (!override) return resolved

            swapped.add(resolved.id)
            return { ...resolved, id: override }
        },
        generateBundle(_options, bundle) {
            if (target === 'native') {
                const missed = [...NATIVE_OVERRIDES.keys()].filter(
                    id => !swapped.has(id),
                )
                if (missed.length > 0) {
                    throw new Error(
                        `kms native build did not apply the .native override for: ${missed.join(', ')}. dist/index.native.js would fall back to off-device behaviour.`,
                    )
                }
            }

            for (const chunk of Object.values(bundle)) {
                if (chunk.type !== 'chunk') continue

                if (
                    target === 'native' &&
                    !/from\s*["']@joe-p\/react-native-falcon["']/.test(
                        chunk.code,
                    )
                ) {
                    throw new Error(
                        'kms native build has no static import of @joe-p/react-native-falcon — Metro would not resolve the native module and signing would throw on first use.',
                    )
                }
                if (
                    target === 'native' &&
                    SHIMMED_NATIVE_REQUIRE.test(chunk.code)
                ) {
                    throw new Error(
                        "kms native build reaches @joe-p/react-native-falcon through rolldown's `require` shim — Metro cannot see that dependency. Import it statically from a `.native.ts` file.",
                    )
                }
                if (
                    target === 'default' &&
                    chunk.code.includes('@joe-p/react-native-falcon')
                ) {
                    throw new Error(
                        'kms default build references @joe-p/react-native-falcon — dist/index.js must stay off-device.',
                    )
                }
            }
        },
    }
}

export default defineConfig(({ mode }) => {
    const target = mode === 'native' ? 'native' : 'default'

    return {
        plugins: [
            pqProviderTarget(target),
            // Both targets satisfy the same PQSignatureProvider contract, so one
            // set of declarations covers them; emitting twice would race on the
            // same files.
            ...(target === 'native'
                ? []
                : [
                      dts({
                          include: ['src'],
                          exclude: [
                              '**/__tests__/**',
                              '**/*.test.ts',
                              '**/*.test.tsx',
                              '**/{handlers,*-handlers}.ts',
                          ],
                          afterDiagnostic: diagnostics => {
                              if (diagnostics.length > 0) {
                                  throw new Error(
                                      `TypeScript declaration generation failed with ${diagnostics.length} error(s)`,
                                  )
                              }
                          },
                      }),
                  ]),
        ],
        build: {
            // Never on either pass: the second would wipe the first, and the
            // `dev` watcher (default target only) would delete the native
            // bundle out from under anything resolving kms from dist. The
            // `build` script clears dist once, up front, instead.
            emptyOutDir: false,
            lib: {
                entry: resolve(__dirname, 'src/index.ts'),
                formats: ['es'],
                fileName: target === 'native' ? 'index.native' : 'index',
            },
            rollupOptions: {
                external: [
                    'react',
                    'react/jsx-runtime',
                    'zustand',
                    '@perawallet/wallet-extension-platform',
                    '@perawallet/wallet-core-shared',
                    '@algorandfoundation/keystore-core',
                    '@algorandfoundation/react-native-keystore',
                    '@algorandfoundation/xhd-wallet-api',
                    '@algorandfoundation/algokit-utils',
                    'algosdk',
                    '@scure/bip39',
                    '@scure/bip39/wordlists/english',
                    'tweetnacl',
                    'uuid',
                    '@perawallet/wallet-extension-provider',
                    // On-device Falcon-1024 nitro module (Seam A). Kept
                    // external so the app's Metro bundler resolves it; bundling it
                    // here would pull in react-native (Flow) and instantiate the
                    // native HybridObject at load. rnFalconProvider requires it
                    // lazily and only on-device.
                    '@joe-p/react-native-falcon',
                    'react-native-nitro-modules',
                    'react-native',
                ],
            },
        },
    }
})
