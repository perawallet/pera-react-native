/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

import { jsonLocation, keyLines } from '../shared/locale.js'
import { resolveRelative } from '../shared/paths.js'
import { join, workspaceMembers, yamlMap } from '../shared/workspace.js'

const NITRO =
    'Nitro module: its C++ is generated against one react-native-nitro-modules ABI, which the overrides pin'
const SDK_BUNDLED =
    'native; the installed Expo SDK names its version in bundledNativeModules.json'
const EXPO_MODULE = "Expo module compiled against the SDK's expo-modules-core"
const FIREBASE =
    'native Firebase SDK; every module peers on the identical @react-native-firebase/app'
const NATIVE = 'links its own iOS or Android code into the app binary'

/**
 * Packages that link native code into the app, plus the RN and Nitro runtimes,
 * each with the reason it must not float. `expo` and `expo-*` are matched by
 * name. A new native dependency is checked only once it is listed here.
 */
const NATIVE_MODULES: ReadonlyMap<string, string> = new Map([
    ['@joe-p/react-native-falcon', NITRO],
    ['react-native-mmkv', NITRO],
    ['react-native-nitro-image', NITRO],
    ['react-native-quick-crypto', NITRO],
    ['react-native-vision-camera', NITRO],
    ['react-native-vision-camera-barcode-scanner', NITRO],
    ['@react-native-community/datetimepicker', SDK_BUNDLED],
    ['@react-native-community/netinfo', SDK_BUNDLED],
    ['@shopify/react-native-skia', SDK_BUNDLED],
    ['lottie-react-native', SDK_BUNDLED],
    ['react-native-gesture-handler', SDK_BUNDLED],
    ['react-native-keyboard-controller', SDK_BUNDLED],
    ['react-native-pager-view', SDK_BUNDLED],
    ['react-native-reanimated', SDK_BUNDLED],
    ['react-native-safe-area-context', SDK_BUNDLED],
    ['react-native-screens', SDK_BUNDLED],
    ['react-native-svg', SDK_BUNDLED],
    ['react-native-webview', SDK_BUNDLED],
    ['react-native-worklets', SDK_BUNDLED],
    ['@algorandfoundation/react-native-passkey-autofill', EXPO_MODULE],
    ['@expo/app-integrity', EXPO_MODULE],
    ['@expo/dom-webview', EXPO_MODULE],
    ['@react-native-firebase/analytics', FIREBASE],
    ['@react-native-firebase/app', FIREBASE],
    ['@react-native-firebase/crashlytics', FIREBASE],
    ['@react-native-firebase/messaging', FIREBASE],
    ['@react-native-firebase/remote-config', FIREBASE],
    ['@expensify/react-native-wallet', NATIVE],
    ['@ledgerhq/react-native-hid', NATIVE],
    ['@walletconnect/react-native-compat', NATIVE],
    ['react-native-advanced-input-mask', NATIVE],
    ['react-native-ble-plx', NATIVE],
    ['react-native-cloud-storage', NATIVE],
    ['react-native-get-random-values', NATIVE],
    ['react-native-keychain', NATIVE],
    ['react-native-quick-base64', NATIVE],
    ['react-native-rate-app', NATIVE],
    ['react-native-share', NATIVE],
    ['react-native-ssl-public-key-pinning', NATIVE],
    [
        'react-native',
        'the runtime every native module is compiled against; moves only with the Expo SDK',
    ],
    [
        'react-native-nitro-modules',
        "the Nitro runtime; every Nitro module's generated C++ binds to its exact ABI",
    ],
])

const SECTIONS: readonly string[] = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
]

const isNativeModule = (name: string): boolean =>
    name === 'expo' || name.startsWith('expo-') || NATIVE_MODULES.has(name)

// `>=`, `*` and `1.x` float the same way a `^` does, so only a plain version passes.
const isExactVersion = (spec: string): boolean =>
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(spec)

// A key with no scalar value opens a nested mapping, not a version.
const scalarEntries = (
    raw: string,
    key: string,
): { key: string; value: string; line: number }[] =>
    yamlMap(raw, key).filter(entry => entry.value !== '')

// Matches pnpm's own override parser: a `>` after a space, `|` or `@` belongs
// to a version selector (`esbuild@>=0.27.3 <0.28.1`), not a parent>child split.
const PARENT_SEPARATOR = /[^ |@]>/g

/**
 * The package an override key rewrites: the child of a `parent>child` key,
 * without its `@<selector>`. A scoped name's own `@` is its first character,
 * so the selector's `@` is searched for after it.
 */
const overrideTarget = (key: string): string => {
    const separator = [...key.matchAll(PARENT_SEPARATOR)].pop()
    const child =
        separator === undefined ? key : key.slice((separator.index ?? 0) + 2)
    const at = child.indexOf('@', 1)
    return at === -1 ? child : child.slice(0, at)
}

const parseManifest = (raw: string): Record<string, unknown> | undefined => {
    try {
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== 'object' || parsed === null) return undefined
        return parsed as Record<string, unknown>
    } catch {
        return undefined
    }
}

export default defineRule({
    id: 'pera/native-exact-pins',
    language: ['javascript'],
    severity: 'error',
    card: {
        message:
            'a native module is not pinned to an exact version in a workspace manifest, the catalog or an override',
        remediation:
            "Pin it to the exact version pnpm-lock.yaml resolves today, not a newer one, then run `pnpm install --lockfile-only` so only specifiers change. When the app and a workspace package both depend on it, give both `catalog:` so the pin lives once. A native module moves only with the Expo SDK or its lockstep set, with a device build. A newly added dependency that ships native code goes in this rule's NATIVE_MODULES with its reason.",
        examples: {
            bad: '"react-native-gesture-handler": "~3.3.0"',
            good: '"react-native-gesture-handler": "3.3.0"',
        },
    },
    // lanekeep discovers only source files, so the Expo native config anchors
    // the check and the manifests and workspace file are read relative to it.
    gates: { pathMatches: ['**/apps/mobile/app.config.js'] },
    query: '(program) @file',
    check(ctx, m) {
        const file = m.file
        if (file === undefined) return
        const base = resolveRelative(ctx.filePath, '../..')
        const workspacePath = join(base, 'pnpm-workspace.yaml')
        const workspaceRaw = ctx.readFile(workspacePath) ?? ''
        const catalog = new Map(
            scalarEntries(workspaceRaw, 'catalog').map(e => [e.key, e]),
        )
        const reported = new Set<string>()

        const emit = (path: string, line: number, message: string): void => {
            const key = `${path}:${line}`
            if (reported.has(key)) return
            reported.add(key)
            ctx.emitFact({ kind: 'range', json: path, jsonLine: line, message })
        }

        // Every importer resolves its own specs, and Metro takes a package's JS
        // from whichever copy its importer resolved, so a range in any of them
        // can move JS off the native code autolinked from apps/mobile.
        const dirs = [
            'apps/mobile',
            '',
            ...workspaceMembers(ctx, base).filter(d => d !== 'apps/mobile'),
        ]
        const names = new Set<string>()
        for (const dir of dirs) {
            const manifestPath = join(
                dir === '' ? base : join(base, dir),
                'package.json',
            )
            const manifestRaw = ctx.readFile(manifestPath)
            if (manifestRaw === undefined) continue
            const manifest = parseManifest(manifestRaw)
            if (manifest === undefined) {
                ctx.report(
                    file,
                    `${join(dir, 'package.json')} is not valid JSON`,
                )
                continue
            }
            const lines = keyLines(manifestRaw)
            for (const section of SECTIONS) {
                const deps = manifest[section]
                if (typeof deps !== 'object' || deps === null) continue
                for (const [name, spec] of Object.entries(deps)) {
                    if (!isNativeModule(name)) continue
                    names.add(name)
                    if (typeof spec !== 'string') continue
                    if (spec.startsWith('workspace:')) continue
                    const line = lines.get(`${section}.${name}`) ?? 1
                    if (spec === 'catalog:' || spec === 'catalog:default') {
                        const entry = catalog.get(name)
                        if (
                            entry !== undefined &&
                            !isExactVersion(entry.value)
                        ) {
                            emit(
                                workspacePath,
                                entry.line,
                                `"${name}" is "${entry.value}" in the catalog, not an exact version`,
                            )
                        }
                    } else if (spec.startsWith('catalog:')) {
                        emit(
                            manifestPath,
                            line,
                            `"${name}" uses ${spec}, a named catalog this rule does not read`,
                        )
                    } else if (!isExactVersion(spec)) {
                        emit(
                            manifestPath,
                            line,
                            `"${name}" is "${spec}" in ${section}, not an exact version`,
                        )
                    }
                }
            }
        }

        // pnpm swaps a resolved spec for any override that targets it, bare,
        // selector-scoped or parent-scoped, so a pin holds only while every
        // such override is exact too. `-` removes the dependency instead.
        for (const entry of scalarEntries(workspaceRaw, 'overrides')) {
            const name = overrideTarget(entry.key)
            if (!names.has(name)) continue
            if (entry.value === '-' || isExactVersion(entry.value)) continue
            emit(
                workspacePath,
                entry.line,
                `"${name}" is overridden to "${entry.value}" by "${entry.key}", not an exact version`,
            )
        }
    },
    reduce(ctx) {
        for (const fact of ctx.facts('range')) {
            ctx.report(jsonLocation(fact), String(fact.message))
        }
    },
})
