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

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import plugin from '../plugin.js'
import {
    overridesWith,
    readOxlintConfig,
    type OxlintConfig,
    type OxlintOverride,
} from './helpers.js'

describe('no-restricted-properties', () => {
    const restricted = (override: OxlintOverride): string[] =>
        (override.rules['no-restricted-properties'] as unknown[])
            .slice(1)
            .map(entry => {
                const { object, property } = entry as {
                    object: string
                    property: string
                }
                return `${object}.${property}`
            })

    it('keeps Math.random out of the key-handling packages', () => {
        const root = readOxlintConfig('.oxlintrc.json')
        expect(
            overridesWith(root, 'no-restricted-properties').map(o => [
                o.files,
                restricted(o),
            ]),
        ).toEqual([
            [
                [
                    'packages/kms/src/**',
                    'packages/signing/src/**',
                    'packages/chain-algorand/src/signing/local-key/**',
                    'packages/passkeys/src/**',
                    'packages/backup/src/**',
                    'extensions/keystore-chrome/src/**',
                    'extensions/provider/src/**',
                    'extensions/passkey-autofill/src/**',
                ],
                ['Math.random'],
            ],
        ])
    })

    it('bans StyleSheet.create in mobile source, and Alert.alert outside developer screens', () => {
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')
        expect(
            overridesWith(mobile, 'no-restricted-properties').map(o => [
                o.files,
                restricted(o),
            ]),
        ).toEqual([
            [['src/**'], ['StyleSheet.create', 'Alert.alert']],
            [
                ['src/modules/settings/screens/developer/**'],
                ['StyleSheet.create'],
            ],
        ])
    })
})

describe('import/no-default-export', () => {
    it('runs over production source in both configs, ambient declarations aside', () => {
        const root = readOxlintConfig('.oxlintrc.json')
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')

        expect(root.plugins).toContain('import')
        for (const config of [root, mobile]) {
            const overrides = overridesWith(config, 'import/no-default-export')
            expect(overrides).toHaveLength(1)
            expect(overrides[0].excludeFiles).toEqual(
                expect.arrayContaining([expect.stringMatching(/\*\.d\.ts$/)]),
            )
        }
    })
})

describe('pera/no-hardcoded-ui-strings', () => {
    it('blocks in all mobile source, developer screens aside', () => {
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')
        const overrides = overridesWith(mobile, 'pera/no-hardcoded-ui-strings')

        expect(overrides).toHaveLength(1)
        expect(overrides[0].files).toEqual(['src/**/*.{ts,tsx}'])
        expect(overrides[0].rules['pera/no-hardcoded-ui-strings']).toBe('error')
        expect(overrides[0].excludeFiles).toContain(
            'src/modules/settings/screens/developer/**',
        )
    })
})

describe('no-console', () => {
    it('blocks console calls in package, extension and browser-app source, tests aside', () => {
        const root = readOxlintConfig('.oxlintrc.json')
        const mobile = readOxlintConfig(
            'apps/mobile/.oxlintrc.json',
        ) as unknown as { rules: Record<string, string> }
        const overrides = overridesWith(root, 'no-console')

        expect(overrides).toHaveLength(1)
        expect(overrides[0].files).toEqual([
            'packages/*/src/**',
            'extensions/*/src/**',
            'apps/browser/src/**',
        ])
        expect(overrides[0].rules['no-console']).toBe('error')
        expect(overrides[0].excludeFiles).toEqual(
            expect.arrayContaining(['**/__tests__/**', '**/*.spec.{ts,tsx}']),
        )
        expect(mobile.rules['no-console']).toBe('warn')
    })
})

describe('every pera plugin rule', () => {
    type Config = {
        rules?: Record<string, string>
        overrides?: { rules?: Record<string, string> }[]
    }
    const rootConfig = readOxlintConfig('.oxlintrc.json') as unknown as Config
    const mobileConfig = readOxlintConfig(
        'apps/mobile/.oxlintrc.json',
    ) as unknown as Config

    const enables = (config: Config, ruleId: string): boolean =>
        config.rules?.[ruleId] === 'error' ||
        config.rules?.[ruleId] === 'warn' ||
        (config.overrides ?? []).some(
            o => o.rules?.[ruleId] === 'error' || o.rules?.[ruleId] === 'warn',
        )

    it.each(Object.keys(plugin.rules))(
        'pera/%s is enabled by an override',
        id => {
            const ruleId = `pera/${id}`
            expect(
                enables(rootConfig, ruleId) || enables(mobileConfig, ruleId),
            ).toBe(true)
        },
    )
})

describe('no-restricted-globals', () => {
    const RAW_FETCH_FILES: Record<string, string> = {
        'apps/mobile/src/utils/getImageBase64.web.ts':
            "Web twin of the native media download: reads a collectible's image from whichever host serves it, and queryClient only reaches Pera's backend.",
        'apps/mobile/src/utils/saveImageToDevice.web.ts':
            "Web twin of the native media save: downloads a collectible's media from whichever host serves it into a Blob, and queryClient only reaches Pera's backend.",
        'extensions/platform-chrome/src/services/analytics.ts':
            "Posts to GA4's Measurement Protocol, a third-party host; the extension has no analytics client of its own.",
        'extensions/platform-react-native/src/services/cloud-file-storage/google-auth.ts':
            "Exchanges the OAuth code at Google's token endpoint, a third-party host, from platform code with no HTTP client.",
        'packages/chain-algorand/src/blockchain/utils/TimeoutHttpClient.ts':
            "Is the algod and indexer HTTP client: algosdk's BaseHTTPClient with a per-method timeout.",
        'packages/chain-algorand/src/nfd/registry.ts':
            "Asks NFD's registry directly, never Pera's backend, so the backend cannot vouch for the address a name resolves to.",
        'packages/site-safety/src/refresh.ts':
            'Downloads the phishing lists from their publishers with conditional If-None-Match requests, its own timeout and a caller-injectable fetch.',
    }
    const ROOT_TEST_GLOBS = [
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/test-utils/**',
        '**/__integration__/**',
        '**/*.spec.{ts,tsx}',
        '**/*.test.{ts,tsx}',
    ]
    const MOBILE_TEST_GLOBS = [
        'src/**/__tests__/**',
        'src/**/__mocks__/**',
        'src/**/test-utils/**',
        'src/**/__integration__/**',
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.test.{ts,tsx}',
    ]
    const restrictedGlobals = (
        override: OxlintOverride,
    ): { name: string; message: string }[] =>
        (
            override.rules['no-restricted-globals'] as [
                string,
                ...{ name: string; message: string }[],
            ]
        ).slice(1)
    const severity = (override: OxlintOverride): string =>
        (override.rules['no-restricted-globals'] as unknown[])[0] as string

    it('bans the fetch global at error in app, package and extension source, outside tests and the allowlisted files', () => {
        const root = readOxlintConfig('.oxlintrc.json')
        const overrides = overridesWith(root, 'no-restricted-globals')

        expect(overrides).toHaveLength(1)
        expect(overrides[0].files).toEqual([
            'apps/*/src/**',
            'packages/*/src/**',
            'extensions/*/src/**',
        ])
        expect(severity(overrides[0])).toBe('error')
        expect(restrictedGlobals(overrides[0]).map(g => g.name)).toEqual([
            'fetch',
        ])
        expect(overrides[0].excludeFiles).toEqual([
            ...ROOT_TEST_GLOBS,
            ...Object.keys(RAW_FETCH_FILES),
        ])
    })

    it('bans fetch in mobile source through its own override after the chrome ban, so allowlisted files keep the chrome ban', () => {
        const root = readOxlintConfig('.oxlintrc.json')
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')
        const overrides = overridesWith(mobile, 'no-restricted-globals')

        expect(overrides).toHaveLength(2)
        const [chromeOnly, withFetch] = overrides
        expect(chromeOnly.files).toEqual(['src/**/*.{ts,tsx}'])
        expect(chromeOnly.excludeFiles).toBeUndefined()
        expect(restrictedGlobals(chromeOnly).map(g => g.name)).toEqual([
            'chrome',
        ])

        expect(withFetch.files).toEqual(['src/**/*.{ts,tsx}'])
        expect(severity(withFetch)).toBe('error')
        expect(restrictedGlobals(withFetch).map(g => g.name)).toEqual([
            'chrome',
            'fetch',
        ])
        expect(restrictedGlobals(withFetch)[0]).toEqual(
            restrictedGlobals(chromeOnly)[0],
        )
        expect(restrictedGlobals(withFetch)[1]).toEqual(
            restrictedGlobals(
                overridesWith(root, 'no-restricted-globals')[0],
            )[0],
        )
        expect(withFetch.excludeFiles).toEqual([
            ...MOBILE_TEST_GLOBS,
            ...Object.keys(RAW_FETCH_FILES)
                .filter(path => path.startsWith('apps/mobile/'))
                .map(path => path.slice('apps/mobile/'.length)),
        ])
    })

    it('allowlists only files that still call fetch', () => {
        const root = join(__dirname, '../../../..')
        for (const path of Object.keys(RAW_FETCH_FILES)) {
            expect(existsSync(join(root, path)), path).toBe(true)
            expect(readFileSync(join(root, path), 'utf8'), path).toMatch(
                /(^|[^.\w])fetch\(/m,
            )
        }
    })
})
