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
