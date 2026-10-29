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

import { describe, expect, it } from 'vitest'
import plugin from '../plugin.js'
import {
    overridesWith,
    readOxlintConfig,
    type OxlintConfig,
    type OxlintOverride,
} from './helpers.js'

const FETCH_PROPERTIES = ['globalThis.fetch', 'window.fetch', 'self.fetch']

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

describe('no-restricted-properties', () => {
    it('restricts the fetch properties everywhere, and Math.random too in the key-handling packages, whose override comes later and so restates the fetch ones', () => {
        const root = readOxlintConfig('.oxlintrc.json')
        expect(
            overridesWith(root, 'no-restricted-properties').map(o => [
                o.files,
                restricted(o),
            ]),
        ).toEqual([
            [
                ['apps/*/src/**', 'packages/*/src/**', 'extensions/*/src/**'],
                FETCH_PROPERTIES,
            ],
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
                ['Math.random', ...FETCH_PROPERTIES],
            ],
        ])
    })

    it('bans StyleSheet.create and the fetch properties in mobile source, and Alert.alert outside developer screens', () => {
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')
        expect(
            overridesWith(mobile, 'no-restricted-properties').map(o => [
                o.files,
                restricted(o),
            ]),
        ).toEqual([
            [
                ['src/**'],
                ['StyleSheet.create', 'Alert.alert', ...FETCH_PROPERTIES],
            ],
            [
                ['src/modules/settings/screens/developer/**'],
                ['StyleSheet.create', ...FETCH_PROPERTIES],
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

describe('react/no-multi-comp', () => {
    it('is an error in mobile production source, with stateless components counted', () => {
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')

        const overrides = overridesWith(mobile, 'react/no-multi-comp')

        expect(overrides).toHaveLength(1)
        expect(overrides[0].rules['react/no-multi-comp']).toEqual([
            'error',
            { ignoreStateless: false },
        ])
        expect(overrides[0].excludeFiles).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/__tests__/),
                expect.stringMatching(/__integration__/),
            ]),
        )
    })
})

describe('no-restricted-imports', () => {
    type RestrictedImports = [string, { paths: unknown[] }]
    const paths = (override: OxlintOverride): unknown[] =>
        (override.rules['no-restricted-imports'] as RestrictedImports)[1].paths

    // A later override replaces the rule's options rather than merging them, so
    // a narrower block that drops one of the src/** bans silently lifts it there.
    it('repeats every src/** ban in each narrower mobile override', () => {
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')
        const [general, ...narrower] = overridesWith(
            mobile,
            'no-restricted-imports',
        )

        expect(general.files).toEqual(['src/**'])
        expect(narrower.length).toBeGreaterThan(0)
        for (const override of narrower) {
            expect(paths(override)).toEqual(
                expect.arrayContaining(paths(general)),
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

describe('fetch', () => {
    type Restriction = { message: string }
    const entries = (override: OxlintOverride, rule: string): unknown[] =>
        (override.rules[rule] as unknown[]).slice(1)
    const names = (override: OxlintOverride): string[] =>
        entries(override, 'no-restricted-globals').map(
            entry => (entry as { name: string }).name,
        )
    const fetchMessage = (config: OxlintConfig): string =>
        (
            entries(
                overridesWith(config, 'no-restricted-globals')[0],
                'no-restricted-globals',
            ).find(
                entry => (entry as { name: string }).name === 'fetch',
            ) as Restriction
        ).message

    it('bans the fetch global at error in app, package and extension source, tests aside, with no file-level exemptions', () => {
        const root = readOxlintConfig('.oxlintrc.json')
        const overrides = overridesWith(root, 'no-restricted-globals')

        expect(overrides).toHaveLength(1)
        expect(overrides[0].files).toEqual([
            'apps/*/src/**',
            'packages/*/src/**',
            'extensions/*/src/**',
        ])
        expect(
            (overrides[0].rules['no-restricted-globals'] as unknown[])[0],
        ).toBe('error')
        expect(names(overrides[0])).toEqual(['fetch'])
        expect(overrides[0].excludeFiles).toEqual([
            '**/__tests__/**',
            '**/__mocks__/**',
            '**/test-utils/**',
            '**/__integration__/**',
            '**/*.spec.{ts,tsx}',
            '**/*.test.{ts,tsx}',
        ])
    })

    it('bans fetch in mobile source beside chrome, in the one no-restricted-globals override', () => {
        const root = readOxlintConfig('.oxlintrc.json')
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')
        const overrides = overridesWith(mobile, 'no-restricted-globals')

        expect(overrides).toHaveLength(1)
        expect(overrides[0].files).toEqual(['src/**/*.{ts,tsx}'])
        expect(overrides[0].excludeFiles).toBeUndefined()
        expect(
            (overrides[0].rules['no-restricted-globals'] as unknown[])[0],
        ).toBe('error')
        expect(names(overrides[0])).toEqual(['chrome', 'fetch'])
        expect(fetchMessage(mobile)).toBe(fetchMessage(root))
    })

    it('restricts globalThis, window and self.fetch at error with the same message in every no-restricted-properties override', () => {
        for (const path of ['.oxlintrc.json', 'apps/mobile/.oxlintrc.json']) {
            const config = readOxlintConfig(path)
            const message = fetchMessage(readOxlintConfig('.oxlintrc.json'))
            for (const override of overridesWith(
                config,
                'no-restricted-properties',
            )) {
                expect(
                    (
                        override.rules['no-restricted-properties'] as unknown[]
                    )[0],
                ).toBe('error')
                const fetchEntries = entries(
                    override,
                    'no-restricted-properties',
                ).filter(
                    entry =>
                        (entry as { property: string }).property === 'fetch',
                )
                expect(
                    fetchEntries.map(entry => (entry as Restriction).message),
                ).toEqual([message, message, message])
                expect(restricted(override)).toEqual(
                    expect.arrayContaining(FETCH_PROPERTIES),
                )
            }
        }
    })
})
