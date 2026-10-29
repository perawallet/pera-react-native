/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    REPO_ROOT,
    createRunner,
    withScratch,
    type Violation,
} from './helpers.js'

const RULE = 'lanekeep/rules/native-exact-pins.ts'

type Finding = [file: string, line: number, message: string]

const manifest = (
    dependencies: Record<string, string>,
    devDependencies: Record<string, string> = {},
): string =>
    JSON.stringify({ name: 'mobile', dependencies, devDependencies }, null, 4)

const lineOf = (text: string, needle: string): number =>
    text.split('\n').findIndex(line => line.includes(needle)) + 1

const repo = (files: Record<string, string>): Record<string, string> => ({
    'apps/mobile/app.config.js': 'module.exports = {}\n',
    ...files,
})

const check = async (files: Record<string, string>): Promise<Finding[]> =>
    withScratch(repo(files), async dir => {
        const runner = await createRunner(RULE, `${dir}/**/*.js`)
        try {
            const found: Violation[] = await runner.run()
            return found
                .map((v): Finding => [
                    v.file.slice(dir.length + 1),
                    v.line,
                    v.message,
                ])
                .sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1])
        } finally {
            await runner.dispose()
        }
    })

const WORKSPACE = [
    'packages:',
    '  - apps/*',
    '',
    'catalog:',
    '  expo: 58.0.17',
    '  react-native-mmkv: ^4.2.0',
    '  # a comment between entries',
    '  react-native-quick-base64: ^3.0.0',
    '  typescript: ^7.0.2',
    '',
    'overrides:',
    '  react-native-nitro-modules: 0.36.5',
    '  react-native-quick-base64: ^3.0.0',
    '  react-native-quick-crypto: ^1.0.17',
    '',
].join('\n')

const MANIFEST = manifest(
    {
        '@perawallet/wallet-core-shared': 'workspace:*',
        '@tanstack/react-query': '^5.99.0',
        expo: 'catalog:',
        'expo-image': '~58.0.16',
        'react-native-gesture-handler': '~3.3.0',
        'react-native-mmkv': 'catalog:',
        'react-native-nitro-modules': '^0.36.0',
        'react-native-quick-base64': 'catalog:',
        'react-native-quick-crypto': '1.1.6',
        'react-native-screens': '4.30.0',
    },
    { '@expo/dom-webview': '>=58.0.0', typescript: 'catalog:' },
)

describe('pera/native-exact-pins', () => {
    it('reports every ranged native spec in the manifest, the catalog and the overrides, at its own line', async () => {
        const found = await check({
            'apps/mobile/package.json': MANIFEST,
            'pnpm-workspace.yaml': WORKSPACE,
        })

        expect(found).toEqual([
            [
                'apps/mobile/package.json',
                lineOf(MANIFEST, '"expo-image"'),
                '"expo-image" is "~58.0.16" in dependencies, not an exact version',
            ],
            [
                'apps/mobile/package.json',
                lineOf(MANIFEST, '"react-native-gesture-handler"'),
                '"react-native-gesture-handler" is "~3.3.0" in dependencies, not an exact version',
            ],
            [
                'apps/mobile/package.json',
                lineOf(MANIFEST, '"react-native-nitro-modules"'),
                '"react-native-nitro-modules" is "^0.36.0" in dependencies, not an exact version',
            ],
            [
                'apps/mobile/package.json',
                lineOf(MANIFEST, '"@expo/dom-webview"'),
                '"@expo/dom-webview" is ">=58.0.0" in devDependencies, not an exact version',
            ],
            [
                'pnpm-workspace.yaml',
                lineOf(WORKSPACE, '  react-native-mmkv: ^4.2.0'),
                '"react-native-mmkv" is "^4.2.0" in the catalog, not an exact version',
            ],
            [
                'pnpm-workspace.yaml',
                lineOf(WORKSPACE, '  react-native-quick-base64: ^3.0.0'),
                '"react-native-quick-base64" is "^3.0.0" in the catalog, not an exact version',
            ],
            [
                'pnpm-workspace.yaml',
                WORKSPACE.split('\n').lastIndexOf(
                    '  react-native-quick-base64: ^3.0.0',
                ) + 1,
                '"react-native-quick-base64" is overridden to "^3.0.0" by "react-native-quick-base64", not an exact version',
            ],
            [
                'pnpm-workspace.yaml',
                lineOf(WORKSPACE, '  react-native-quick-crypto: ^1.0.17'),
                '"react-native-quick-crypto" is overridden to "^1.0.17" by "react-native-quick-crypto", not an exact version',
            ],
        ] satisfies Finding[])
    })

    it('reports nothing when every native spec, catalog entry and override is exact', async () => {
        const found = await check({
            'apps/mobile/package.json': manifest({
                expo: 'catalog:',
                'expo-image': '58.0.16',
                'react-native-gesture-handler': '3.3.0',
                'react-native-mmkv': 'catalog:default',
                'react-native-nitro-modules': '0.36.5',
                'react-native-quick-crypto': '1.1.6',
                'react-native-svg': '15.16.0-rc.1+build.5',
            }),
            'pnpm-workspace.yaml': [
                'catalog:',
                '  expo: 58.0.17',
                '  react-native-mmkv: 4.3.2',
                'overrides:',
                '  react-native-nitro-modules: 0.36.5',
                "  'react-native-quick-crypto@<2': 1.1.6",
                "  '@ledgerhq/react-native-hw-transport-ble>react-native-svg': -",
                '',
            ].join('\n'),
        })

        expect(found).toEqual([])
    })

    it('reports a ranged selector or parent-scoped override of a native module, keyed on its target', async () => {
        const workspace = [
            'overrides:',
            "  'react-native-quick-crypto@<2': ^1.0.17",
            "  '@react-native-firebase/app@<28': ^27.0.0",
            "  '@ledgerhq/react-native-hw-transport-ble>react-native-ble-plx@3': ^3.4.0",
            "  'react-native-quick-crypto-shim@<2': ^1.0.0",
            '',
        ].join('\n')
        const found = await check({
            'apps/mobile/package.json': manifest({
                '@react-native-firebase/app': '27.0.0',
                'react-native-ble-plx': '3.5.1',
                'react-native-quick-crypto': '1.1.6',
            }),
            'pnpm-workspace.yaml': workspace,
        })

        expect(found).toEqual([
            [
                'pnpm-workspace.yaml',
                2,
                '"react-native-quick-crypto" is overridden to "^1.0.17" by "react-native-quick-crypto@<2", not an exact version',
            ],
            [
                'pnpm-workspace.yaml',
                3,
                '"@react-native-firebase/app" is overridden to "^27.0.0" by "@react-native-firebase/app@<28", not an exact version',
            ],
            [
                'pnpm-workspace.yaml',
                4,
                '"react-native-ble-plx" is overridden to "^3.4.0" by "@ledgerhq/react-native-hw-transport-ble>react-native-ble-plx@3", not an exact version',
            ],
        ] satisfies Finding[])
    })

    it('checks every workspace manifest, not only the app', async () => {
        const ranged = JSON.stringify(
            {
                name: '@perawallet/platform-react-native',
                dependencies: {
                    '@expensify/react-native-wallet': '^0.1.41',
                    'expo-sqlite': 'catalog:',
                    zod: '^4.6.7',
                },
            },
            null,
            4,
        )
        const found = await check({
            'apps/mobile/package.json': manifest({
                '@expensify/react-native-wallet': '0.1.41',
            }),
            'extensions/platform-react-native/package.json': ranged,
            'extensions/provider/package.json': JSON.stringify({
                name: '@perawallet/provider',
                dependencies: {
                    'react-native-mmkv': '4.3.2',
                    'react-native-quick-crypto': 'catalog:',
                },
            }),
            'pnpm-workspace.yaml': [
                'packages:',
                '  - apps/*',
                '  - extensions/*',
                '',
                'catalog:',
                '  expo-sqlite: ~58.0.13',
                '  react-native-quick-crypto: 1.1.6',
                '',
            ].join('\n'),
        })

        expect(found).toEqual([
            [
                'extensions/platform-react-native/package.json',
                lineOf(ranged, '"@expensify/react-native-wallet"'),
                '"@expensify/react-native-wallet" is "^0.1.41" in dependencies, not an exact version',
            ],
            [
                'pnpm-workspace.yaml',
                6,
                '"expo-sqlite" is "~58.0.13" in the catalog, not an exact version',
            ],
        ] satisfies Finding[])
    })

    it('reports a malformed workspace manifest on the anchor by its path', async () => {
        const found = await check({
            'apps/mobile/package.json': manifest({}),
            'extensions/provider/package.json': '{ nope',
            'pnpm-workspace.yaml': 'packages:\n  - extensions/*\n',
        })

        expect(found.map(f => [f[0], f[2]])).toEqual([
            [
                'apps/mobile/app.config.js',
                'extensions/provider/package.json is not valid JSON',
            ],
        ])
    })

    it('ignores packages that are not native, and native entries no workspace manifest depends on', async () => {
        const found = await check({
            'apps/mobile/package.json': manifest({ zod: '^4.6.7' }),
            'pnpm-workspace.yaml': [
                'catalog:',
                '  react-native-svg: ^15.16.0',
                'overrides:',
                '  react-native-share: ^12.2.6',
                '',
            ].join('\n'),
        })

        expect(found).toEqual([])
    })

    it('reports a named catalog it cannot read', async () => {
        const text = manifest({ 'react-native-mmkv': 'catalog:native' })
        const found = await check({
            'apps/mobile/package.json': text,
            'pnpm-workspace.yaml': 'catalog:\n  react-native-mmkv: ^4.2.0\n',
        })

        expect(found).toEqual([
            [
                'apps/mobile/package.json',
                lineOf(text, '"react-native-mmkv"'),
                '"react-native-mmkv" uses catalog:native, a named catalog this rule does not read',
            ],
        ])
    })

    it('reports a malformed manifest on the anchor instead of throwing', async () => {
        const found = await check({
            'apps/mobile/package.json': '{ nope',
            'pnpm-workspace.yaml': WORKSPACE,
        })

        expect(found.map(f => [f[0], f[2]])).toEqual([
            [
                'apps/mobile/app.config.js',
                'apps/mobile/package.json is not valid JSON',
            ],
        ])
    })

    it('reports a manifest that parses to null on the anchor instead of throwing', async () => {
        const found = await check({
            'apps/mobile/package.json': 'null',
            'pnpm-workspace.yaml': WORKSPACE,
        })

        expect(found.map(f => [f[0], f[2]])).toEqual([
            [
                'apps/mobile/app.config.js',
                'apps/mobile/package.json is not valid JSON',
            ],
        ])
    })

    it('reports a catalog entry once when two sections use it, and reads optionalDependencies', async () => {
        const text = [
            '{',
            '  "dependencies": { "react-native-mmkv": "catalog:" },',
            '  "devDependencies": { "react-native-mmkv": "catalog:default" },',
            '  "optionalDependencies": { "react-native-svg": "^15.16.0" }',
            '}',
            '',
        ].join('\n')
        const found = await check({
            'apps/mobile/package.json': text,
            'pnpm-workspace.yaml': 'catalog:\n  react-native-mmkv: ^4.2.0\n',
        })

        expect(found).toEqual([
            [
                'apps/mobile/package.json',
                lineOf(text, '"react-native-svg"'),
                '"react-native-svg" is "^15.16.0" in optionalDependencies, not an exact version',
            ],
            [
                'pnpm-workspace.yaml',
                2,
                '"react-native-mmkv" is "^4.2.0" in the catalog, not an exact version',
            ],
        ])
    })

    it('checks the manifest alone when pnpm-workspace.yaml is missing', async () => {
        const text = manifest({
            'react-native-mmkv': 'catalog:',
            'react-native-svg': '^15.16.0',
        })
        const found = await check({ 'apps/mobile/package.json': text })

        expect(found).toEqual([
            [
                'apps/mobile/package.json',
                lineOf(text, '"react-native-svg"'),
                '"react-native-svg" is "^15.16.0" in dependencies, not an exact version',
            ],
        ])
    })

    it('anchors on a file this repo has', () => {
        // The rule goes silent if the anchor is renamed, and lint would stay green.
        expect(existsSync(join(REPO_ROOT, 'apps/mobile/app.config.js'))).toBe(
            true,
        )
    })
})
