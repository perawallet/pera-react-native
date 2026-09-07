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
import { buildAppConfig } from '../app.config.builder'

const PASSKEY_PLUGIN = '@algorandfoundation/react-native-passkey-autofill'

type ResolvedConfig = {
    name: string
    slug: string
    version: string
    scheme: string[]
    ios: {
        bundleIdentifier: string
        buildNumber: string
        appleTeamId?: string
        config: { usesNonExemptEncryption: boolean }
        infoPlist: Record<string, unknown>
        entitlements: Record<string, unknown>
    }
    android: {
        package: string
        permissions: string[]
        blockedPermissions: string[]
        intentFilters: Array<{
            action: string
            autoVerify?: boolean
            data: Array<{ scheme?: string; host?: string; pathPrefix?: string }>
            category: string[]
        }>
    }
    extra: { appVariant: string; appEnv: string }
    plugins: unknown[]
}

const build = (env: Record<string, string | undefined>): ResolvedConfig =>
    buildAppConfig(env)

const pluginOptions = (
    config: ResolvedConfig,
    name: string,
): Record<string, unknown> => {
    const entry = config.plugins.find(
        plugin => Array.isArray(plugin) && plugin[0] === name,
    )
    if (!Array.isArray(entry)) {
        throw new Error(`${name} plugin entry not found`)
    }
    return entry[1] as Record<string, unknown>
}

const passkeyOptions = (config: ResolvedConfig): Record<string, unknown> =>
    pluginOptions(config, PASSKEY_PLUGIN)

describe('buildAppConfig — refactor invariants', () => {
    it('maps APP_ENV to the app variant', () => {
        expect(build({ APP_ENV: 'production' }).extra.appVariant).toBe(
            'production',
        )
        expect(build({ APP_ENV: 'staging' }).extra.appVariant).toBe('staging')
        expect(build({}).extra.appVariant).toBe('dev')
    })

    it('propagates IOS_TEAM_ID to the app and the passkey plugin from one source', () => {
        const config = build({
            APP_ENV: 'production',
            IOS_TEAM_ID: '87QL82XC78',
        })

        expect(config.ios.appleTeamId).toBe('87QL82XC78')
        expect(passkeyOptions(config).appleTeamId).toBe('87QL82XC78')
    })

    it('derives the passkey App Group from the iOS bundle id', () => {
        const config = build({ APP_ENV: 'production' })

        expect(passkeyOptions(config).appGroup).toBe(
            `group.${config.ios.bundleIdentifier}`,
        )
    })

    it('declares non-exempt encryption as false', () => {
        const { ios } = build({ APP_ENV: 'production' })

        expect(ios.config.usesNonExemptEncryption).toBe(false)
    })

    // App Review rejected 7.0.0 under guideline 5.1.1(ii) for a camera string
    // that named the permission instead of the feature, so assert the shape
    // Apple asks for rather than mere presence.
    it('states what each protected capability is used for', () => {
        const { ios } = build({ APP_ENV: 'production' })
        const purposeStrings = Object.entries(ios.infoPlist).filter(([key]) =>
            key.endsWith('UsageDescription'),
        ) as Array<[string, string]>

        expect(purposeStrings.map(([key]) => key)).toEqual(
            expect.arrayContaining([
                'NSCameraUsageDescription',
                'NSFaceIDUsageDescription',
                'NSBluetoothAlwaysUsageDescription',
                'NSPhotoLibraryAddUsageDescription',
                'NSMotionUsageDescription',
            ]),
        )

        for (const [key, value] of purposeStrings) {
            expect(value, `${key} must be a complete sentence`).toMatch(/\.$/)
            expect(value, `${key} must name the feature`).toMatch(/\b(to|so)\b/)
            expect(value, `${key} restates the permission`).not.toMatch(
                /needs access to/i,
            )
        }
    })

    it('leaves iOS permission copy to infoPlist rather than a plugin option', () => {
        const options = pluginOptions(
            build({ APP_ENV: 'production' }),
            'expo-image-picker',
        )

        expect(options.cameraPermission).toBeUndefined()
        expect(options.photosPermission).toBeUndefined()
        expect(options.microphonePermission).toBe(false)
    })

    it('app.config.js resolves through the builder with the live process env', async () => {
        const appConfig = (await import('../app.config')).default

        expect(appConfig).toEqual(buildAppConfig(process.env))
    })
})

describe('buildAppConfig — iOS identity (production only)', () => {
    it('uses the native production bundle id for production', () => {
        expect(build({ APP_ENV: 'production' }).ios.bundleIdentifier).toBe(
            'com.algorandllc.algorand',
        )
    })

    it('derives the production App Group as group.com.algorandllc.algorand', () => {
        expect(passkeyOptions(build({ APP_ENV: 'production' })).appGroup).toBe(
            'group.com.algorandllc.algorand',
        )
    })

    it('leaves staging and dev iOS identity untouched (production-only scope)', () => {
        expect(build({ APP_ENV: 'staging' }).ios.bundleIdentifier).toBe(
            'com.algorandllc.perarn.staging',
        )
        expect(build({}).ios.bundleIdentifier).toBe(
            'com.algorandllc.perarn.staging',
        )
    })

    it('leaves the staging App Group untouched', () => {
        expect(passkeyOptions(build({ APP_ENV: 'staging' })).appGroup).toBe(
            'group.com.algorandllc.perarn.staging',
        )
    })

    it('keeps staging distinct from production', () => {
        expect(build({ APP_ENV: 'production' }).ios.bundleIdentifier).not.toBe(
            build({ APP_ENV: 'staging' }).ios.bundleIdentifier,
        )
    })
})

describe('buildAppConfig — entitlements parity (production only)', () => {
    const DOMAINS = 'com.apple.developer.associated-domains'

    it('adds the legacy applinks:perawallet host for production only', () => {
        expect(
            build({ APP_ENV: 'production' }).ios.entitlements[DOMAINS],
        ).toEqual([
            'applinks:perawallet.app',
            'applinks:perawallet',
            'webcredentials:perawallet.app',
        ])
    })

    it('leaves staging and dev associated-domains untouched', () => {
        const expected = [
            'applinks:perawallet.app',
            'webcredentials:perawallet.app',
        ]

        expect(build({ APP_ENV: 'staging' }).ios.entitlements[DOMAINS]).toEqual(
            expected,
        )
        expect(build({}).ios.entitlements[DOMAINS]).toEqual(expected)
    })

    it('enables aps-environment=production only for production builds', () => {
        expect(
            build({ APP_ENV: 'production' }).ios.entitlements[
                'aps-environment'
            ],
        ).toBe('production')
        expect(
            build({ APP_ENV: 'staging' }).ios.entitlements['aps-environment'],
        ).toBe('development')
        expect(build({}).ios.entitlements['aps-environment']).toBe(
            'development',
        )
    })

    it('attests against the production App Attest environment for distributed builds', () => {
        const key = 'com.apple.developer.devicecheck.appattest-environment'

        expect(build({ APP_ENV: 'production' }).ios.entitlements[key]).toBe(
            'production',
        )
        expect(build({ APP_ENV: 'staging' }).ios.entitlements[key]).toBe(
            'production',
        )
        expect(build({}).ios.entitlements[key]).toBe('development')
    })

    it('enables the autofill credential provider entitlement', () => {
        expect(
            build({ APP_ENV: 'production' }).ios.entitlements[
                'com.apple.developer.authentication-services.autofill-credential-provider'
            ],
        ).toBe(true)
    })
})

describe('buildAppConfig — associated-domains restore plugin', () => {
    const findRestorePlugin = (config: ResolvedConfig) =>
        config.plugins.find(
            plugin =>
                Array.isArray(plugin) &&
                plugin[0] === './plugins/withProductionAssociatedDomains',
        )

    it('registers the restore plugin gated to production', () => {
        const prod = findRestorePlugin(build({ APP_ENV: 'production' }))
        const staging = findRestorePlugin(build({ APP_ENV: 'staging' }))
        const dev = findRestorePlugin(build({}))

        expect(Array.isArray(prod) ? prod[1] : undefined).toEqual({
            isProduction: true,
        })
        expect(Array.isArray(staging) ? staging[1] : undefined).toEqual({
            isProduction: false,
        })
        expect(Array.isArray(dev) ? dev[1] : undefined).toEqual({
            isProduction: false,
        })
    })

    it('registers the restore plugin after the passkey-autofill plugin', () => {
        const { plugins } = build({ APP_ENV: 'production' })
        const indexOf = (id: string) =>
            plugins.findIndex(
                plugin => Array.isArray(plugin) && plugin[0] === id,
            )
        const autofillIndex = indexOf(
            '@algorandfoundation/react-native-passkey-autofill',
        )
        const restoreIndex = indexOf(
            './plugins/withProductionAssociatedDomains',
        )

        expect(autofillIndex).toBeGreaterThanOrEqual(0)
        expect(restoreIndex).toBeGreaterThan(autofillIndex)
    })
})

describe('buildAppConfig — Android identity (production only)', () => {
    it('uses the native production package for production', () => {
        expect(build({ APP_ENV: 'production' }).android.package).toBe(
            'com.algorand.android',
        )
    })

    it('leaves staging and dev Android identity untouched', () => {
        expect(build({ APP_ENV: 'staging' }).android.package).toBe(
            'com.algorand.perarn.staging',
        )
        expect(build({}).android.package).toBe('com.algorand.perarn.staging')
    })

    it('leaves the iOS bundle identifier untouched (out of scope)', () => {
        expect(build({ APP_ENV: 'production' }).ios.bundleIdentifier).toBe(
            'com.algorandllc.algorand',
        )
    })
})

describe('buildAppConfig — production app images (icon + name)', () => {
    type WithImages = ResolvedConfig & {
        icon: string
        android: ResolvedConfig['android'] & {
            adaptiveIcon: { foregroundImage: string; backgroundColor: string }
        }
        ios: ResolvedConfig['ios'] & {
            infoPlist: { CFBundleDisplayName: string }
        }
    }
    const img = (env: Record<string, string | undefined>) =>
        build(env) as unknown as WithImages

    it('uses the native production app icon + foreground for production', () => {
        const config = img({ APP_ENV: 'production' })
        expect(config.icon).toBe('./assets/production/icon-ios.png')
        expect(config.android.adaptiveIcon.foregroundImage).toBe(
            './assets/production/icon-android-foreground.png',
        )
    })

    it('keeps the existing dev/staging icons untouched', () => {
        for (const env of [{ APP_ENV: 'staging' }, {}]) {
            const config = img(env)
            expect(config.icon).toBe('./assets/icon-ios.png')
            expect(config.android.adaptiveIcon.foregroundImage).toBe(
                './assets/icon-android.png',
            )
        }
    })

    it('keeps the adaptive background #ffee55 on every variant', () => {
        for (const env of [
            { APP_ENV: 'production' },
            { APP_ENV: 'staging' },
            {},
        ]) {
            expect(img(env).android.adaptiveIcon.backgroundColor).toBe(
                '#ffee55',
            )
        }
    })

    it('uses the native display name "Pera Algo Wallet" for production', () => {
        const config = img({ APP_ENV: 'production' })
        expect(config.name).toBe('Pera Algo Wallet')
        expect(config.ios.infoPlist.CFBundleDisplayName).toBe(
            'Pera Algo Wallet',
        )
    })

    it('leaves dev/staging display names untouched', () => {
        expect(build({ APP_ENV: 'staging' }).name).toBe('Pera 7 Staging')
        expect(build({}).name).toBe('Pera 7 Dev')
    })
})

import pkg from '../package.json'

describe('buildAppConfig — store versioning floor', () => {
    const base = (pkg as { versionCodeBase: number }).versionCodeBase

    it('exposes a numeric versionCodeBase from package.json', () => {
        expect(typeof base).toBe('number')
        expect(base).toBeGreaterThan(0)
    })

    it('floors the Android versionCode to the base when BUILD_NUMBER is unset', () => {
        const { android } = build({
            APP_ENV: 'production',
        }) as ResolvedConfig & {
            android: { versionCode: number }
        }
        expect(android.versionCode).toBe(base)
    })

    it('adds BUILD_NUMBER to the base for the Android versionCode', () => {
        const { android } = build({
            APP_ENV: 'production',
            BUILD_NUMBER: '42',
        }) as ResolvedConfig & { android: { versionCode: number } }
        expect(android.versionCode).toBe(base + 42)
    })

    it('floors the iOS build number to the base (as a string) when BUILD_NUMBER is unset', () => {
        expect(build({ APP_ENV: 'production' }).ios.buildNumber).toBe(
            String(base),
        )
    })

    it('adds BUILD_NUMBER to the base for the iOS build number', () => {
        expect(
            build({ APP_ENV: 'production', BUILD_NUMBER: '42' }).ios
                .buildNumber,
        ).toBe(String(base + 42))
    })
})

describe('buildAppConfig — marketing version', () => {
    // Regression guard: this was pinned to a literal '7.0.0'. iOS survived it
    // because fastlane rewrites the project after prebuild; Android has no such
    // step, so every Play release shipped as 7.0.0 regardless of the tag.
    it('takes the marketing version from APP_VERSION', () => {
        expect(
            build({ APP_ENV: 'production', APP_VERSION: '8.1.4' }).version,
        ).toBe('8.1.4')
    })

    it("falls back to package.json's base version when APP_VERSION is unset", () => {
        const declared = (pkg as { version: string }).version
        expect(build({ APP_ENV: 'production' }).version).toBe(
            declared.split('-')[0],
        )
        expect(declared).toContain('-')
    })
})

describe('buildAppConfig — Android notification icon (all lanes)', () => {
    const hasNotificationPlugin = (config: ResolvedConfig) =>
        config.plugins.some(
            plugin =>
                plugin === './plugins/withAndroidNotificationIcon' ||
                (Array.isArray(plugin) &&
                    plugin[0] === './plugins/withAndroidNotificationIcon'),
        )

    it('registers the notification-icon plugin on production, staging and dev', () => {
        expect(hasNotificationPlugin(build({ APP_ENV: 'production' }))).toBe(
            true,
        )
        expect(hasNotificationPlugin(build({ APP_ENV: 'staging' }))).toBe(true)
        expect(hasNotificationPlugin(build({}))).toBe(true)
    })
})

describe('buildAppConfig — Android manifest parity', () => {
    const buildPropsAndroid = (config: ResolvedConfig) => {
        const entry = config.plugins.find(
            plugin =>
                Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
        )
        if (!Array.isArray(entry)) {
            throw new Error('expo-build-properties plugin not found')
        }
        return (entry[1] as { android: Record<string, unknown> }).android
    }

    it('pins the Android SDK and build-tools levels', () => {
        const android = buildPropsAndroid(build({ APP_ENV: 'production' }))

        expect(android.minSdkVersion).toBe(29)
        expect(android.targetSdkVersion).toBe(36)
        expect(android.compileSdkVersion).toBe(36)
        expect(android.buildToolsVersion).toBe('36.0.0')
    })

    it('requests POST_NOTIFICATIONS and never FOREGROUND_SERVICE', () => {
        const { permissions } = build({ APP_ENV: 'production' }).android

        expect(permissions).toContain('android.permission.POST_NOTIFICATIONS')
        expect(
            permissions.some(p =>
                p.startsWith('android.permission.FOREGROUND_SERVICE'),
            ),
        ).toBe(false)
    })

    it('blocks the unused auto-added permissions, including the Play-gated media perms', () => {
        const { blockedPermissions, permissions } = build({
            APP_ENV: 'production',
        }).android

        for (const blocked of [
            'android.permission.RECORD_AUDIO',
            'android.permission.SYSTEM_ALERT_WINDOW',
            'android.permission.READ_MEDIA_AUDIO',
            'android.permission.READ_MEDIA_VIDEO',
            // Stripped so Play doesn't classify the app as a health app.
            'android.permission.ACTIVITY_RECOGNITION',
            // Stripped — pick uses the system photo picker, save is write-only;
            // Play gates this under the Photo & Video Permissions policy.
            'android.permission.READ_MEDIA_IMAGES',
        ]) {
            expect(blockedPermissions).toContain(blocked)
        }
        expect(permissions).not.toContain('android.permission.RECORD_AUDIO')
    })
})

describe('buildAppConfig — deep-link scheme parity', () => {
    const SCHEMES = [
        'perawallet',
        'algorand',
        'wc',
        'perawallet-wc',
        'algorand-wc',
        'liquid',
    ]

    it('registers all six iOS URL schemes across every variant', () => {
        for (const env of [
            { APP_ENV: 'production' },
            { APP_ENV: 'staging' },
            {},
        ]) {
            expect(build(env).scheme).toEqual(SCHEMES)
        }
    })

    it('registers all six custom schemes in the Android intent filter', () => {
        const filter = build({
            APP_ENV: 'production',
        }).android.intentFilters.find(f => !f.autoVerify)

        expect(filter?.data.map(d => d.scheme)).toEqual(SCHEMES)
    })

    it('preserves the autoVerify App Links for the /qr/ paths', () => {
        const filter = build({
            APP_ENV: 'production',
        }).android.intentFilters.find(f => f.autoVerify)

        expect(filter?.data).toEqual([
            {
                scheme: 'https',
                host: 'perawallet.app',
                pathPrefix: '/qr/perawallet/',
            },
            {
                scheme: 'https',
                host: 'perawallet.app',
                pathPrefix: '/qr/perawallet-wc/',
            },
        ])
    })
})
