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

import { describe, expect, it } from 'vitest'
import { buildAppConfig } from '../app.config.builder'

const PASSKEY_PLUGIN = '@algorandfoundation/react-native-passkey-autofill'

type ResolvedConfig = {
    name: string
    slug: string
    scheme: string[]
    ios: {
        bundleIdentifier: string
        buildNumber: string
        appleTeamId?: string
        config: { usesNonExemptEncryption: boolean }
        infoPlist: Record<string, unknown>
        entitlements: Record<string, unknown>
    }
    android: { package: string }
    extra: { appVariant: string; appEnv: string }
    plugins: unknown[]
}

const build = (env: Record<string, string | undefined>): ResolvedConfig =>
    buildAppConfig(env)

const passkeyOptions = (config: ResolvedConfig): Record<string, unknown> => {
    const entry = config.plugins.find(
        plugin => Array.isArray(plugin) && plugin[0] === PASSKEY_PLUGIN,
    )
    if (!Array.isArray(entry)) {
        throw new Error('passkey-autofill plugin entry not found')
    }
    return entry[1] as Record<string, unknown>
}

describe('buildAppConfig — refactor invariants', () => {
    it('maps APP_ENV to the app variant', () => {
        expect(build({ APP_ENV: 'production' }).extra.appVariant).toBe(
            'production',
        )
        expect(build({ APP_ENV: 'staging' }).extra.appVariant).toBe('staging')
        expect(build({}).extra.appVariant).toBe('dev')
    })

    it('propagates IOS_TEAM_ID to the app and the passkey plugin from one source', () => {
        const config = build({ APP_ENV: 'production', IOS_TEAM_ID: '87QL82XC78' })

        expect(config.ios.appleTeamId).toBe('87QL82XC78')
        expect(passkeyOptions(config).appleTeamId).toBe('87QL82XC78')
    })

    it('derives the passkey App Group from the iOS bundle id', () => {
        const config = build({ APP_ENV: 'production' })

        expect(passkeyOptions(config).appGroup).toBe(
            `group.${config.ios.bundleIdentifier}`,
        )
    })

    it('declares non-exempt encryption as false and keeps the privacy usage strings', () => {
        const { ios } = build({ APP_ENV: 'production' })

        expect(ios.config.usesNonExemptEncryption).toBe(false)
        expect(ios.infoPlist.NSCameraUsageDescription).toBeTruthy()
        expect(ios.infoPlist.NSFaceIDUsageDescription).toBeTruthy()
        expect(ios.infoPlist.NSPhotoLibraryAddUsageDescription).toBeTruthy()
        expect(ios.infoPlist.NSBluetoothAlwaysUsageDescription).toBeTruthy()
    })

    it('app.config.js resolves through the builder with the live process env', async () => {
        const appConfig = (await import('../app.config')).default

        expect(appConfig).toEqual(buildAppConfig(process.env))
    })
})
