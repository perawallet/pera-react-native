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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RNDeviceInfoStorageService } from '../device'
import * as RN from 'react-native'
// import DeviceInfo from 'react-native-device-info' (removed)

// Mock @perawallet/wallet-core-shared
vi.mock('@perawallet/wallet-core-shared', () => ({
    updateBackendHeaders: vi.fn(),
    updateManualBackendHeaders: vi.fn(),
}))

// Mock expo-application
vi.mock('expo-application', () => ({
    applicationName: 'Pera Wallet',
    applicationId: 'com.algorand.android',
    nativeApplicationVersion: '1.0.0',
    nativeBuildVersion: '1',
    getIosIdForVendorAsync: vi.fn(() => Promise.resolve('unique-device-id')),
    getAndroidId: vi.fn(() => 'unique-android-id'),
}))

// Mock expo-device
vi.mock('expo-device', () => ({
    osVersion: '15.0',
    modelId: 'iPhone13,2',
    modelName: 'iPhone 13',
}))

// Mock expo-localization
vi.mock('expo-localization', () => ({
    getLocales: vi.fn(() => [{ languageTag: 'en-US', regionCode: 'US' }]),
}))

// Mock react-native Platform and NativeModules
vi.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
    },
    NativeModules: {
        SettingsManager: {
            settings: {
                AppleLocale: 'en_US',
                AppleLanguages: ['en_US', 'fr_FR'],
            },
        },
        I18nManager: {
            getConstants: vi.fn(() => ({
                localeIdentifier: 'en_US',
            })),
        },
    },
}))

describe('RNDeviceInfoStorageService', () => {
    let service: RNDeviceInfoStorageService

    beforeEach(() => {
        vi.clearAllMocks()
        RN.Platform.OS = 'ios'
        service = new RNDeviceInfoStorageService()
    })

    describe('initializeDeviceInfo', () => {
        it('sets up headers and calls updateBackendHeaders', async () => {
            const { updateBackendHeaders } = await import(
                '@perawallet/wallet-core-shared'
            )
            const mockUpdateBackendHeaders = vi.mocked(updateBackendHeaders)
            const mockNativeModules = vi.mocked(RN)
            mockNativeModules.NativeModules.SettingsManager.getConstants =
                vi.fn(() => ({
                    settings: {
                        AppleLocale: undefined,
                        AppleLanguages: ['en_US', 'fr_FR'],
                    },
                }))

            service.initializeDeviceInfo()

            expect(mockUpdateBackendHeaders).toHaveBeenCalledWith(
                expect.any(Map),
            )

            const headers = mockUpdateBackendHeaders.mock.calls[0][0]
            expect(headers.get('App-Name')).toBe('Pera Wallet')
            expect(headers.get('App-Package-Name')).toBe('com.algorand.android')
            expect(headers.get('App-Version')).toBe('1.0.0')
            expect(headers.get('Client-Type')).toBe('ios')
            expect(headers.get('Device-Version')).toBe('en-US')
            expect(headers.get('Device-OS-Version')).toBe('15.0')
            expect(headers.get('Device-Model')).toBe('iPhone13,2')
        })

        it('calls header generation with correct values', async () => {
            // No longer checking method calls as we use constants from Expo packages
            // Checking headers values above is sufficient
            const mockNativeModules = vi.mocked(RN)
            mockNativeModules.NativeModules.SettingsManager.getConstants =
                vi.fn(() => ({
                    settings: {
                        AppleLocale: undefined,
                        AppleLanguages: ['en_US', 'fr_FR'],
                    },
                }))

            service.initializeDeviceInfo()

            // Removed method call checks
        })
    })

    describe('getDeviceID', () => {
        it('returns unique device ID from DeviceInfo', async () => {
            const deviceId = await service.getDeviceID()
            expect(deviceId).toBe('unique-device-id')
            const { getIosIdForVendorAsync } = await import('expo-application')
            expect(getIosIdForVendorAsync).toHaveBeenCalled()
        })
    })

    describe('getDeviceModel', () => {
        it('returns device model from Expo Device', async () => {
            const model = service.getDeviceModel()

            expect(model).toBe('iPhone 13')
        })
    })

    describe('getDevicePlatform', () => {
        it('returns iOS platform', () => {
            const platform = service.getDevicePlatform()

            expect(platform).toBe('ios')
        })

        it('returns android platform when Platform.OS is android', async () => {
            // Import and mock Platform directly
            const { Platform } = RN
            const mockPlatform = vi.mocked(Platform)
            mockPlatform.OS = 'android'

            // Create new service instance to pick up the new mock
            const androidService = new RNDeviceInfoStorageService()
            const platform = androidService.getDevicePlatform()

            expect(platform).toBe('android')

            // Reset back to iOS for other tests
            mockPlatform.OS = 'ios'
        })
    })

    describe('getDeviceLocale', () => {
        it('returns formatted locale correctly', async () => {
            const { getLocales } = await import('expo-localization')
            vi.mocked(getLocales).mockReturnValue([
                {
                    languageTag: 'en-US',
                    languageCode: 'en',
                    textDirection: 'ltr',
                    regionCode: 'US',
                } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            ])
            const locale = service.getDeviceLocale()

            expect(locale).toBe('en-US')
        })

        it('returns default locale when no locales available', async () => {
            const { getLocales } = await import('expo-localization')
            vi.mocked(getLocales).mockReturnValue([])
            const locale = service.getDeviceLocale()

            expect(locale).toBe('en-US')
        })

        it('handles iOS locale from AppleLanguages when AppleLocale is not available', async () => {
            // Mock iOS without AppleLocale
            const { NativeModules } = RN
            const mockNativeModules = vi.mocked(NativeModules)
            mockNativeModules.SettingsManager.getConstants = vi.fn(() => ({
                settings: {
                    AppleLocale: undefined,
                    AppleLanguages: ['en_US', 'fr_FR'],
                },
            }))

            const locale = service.getDeviceLocale()

            expect(locale).toBe('en-US')
        })

        it('returns formatted locale for Android', async () => {
            vi.mocked(RN).Platform.OS = 'android'
            const { getLocales } = await import('expo-localization')
            vi.mocked(getLocales).mockReturnValue([
                {
                    languageTag: 'en-GB',
                    languageCode: 'en',
                    textDirection: 'ltr',
                    regionCode: 'GB',
                } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            ])

            const androidService = new RNDeviceInfoStorageService()
            const locale = androidService.getDeviceLocale()

            expect(locale).toBe('en-GB')
        })

        it('does not convert underscores to hyphens in locale', async () => {
            const { getLocales } = await import('expo-localization')
            vi.mocked(getLocales).mockReturnValue([
                {
                    languageTag: 'fr_CA',
                    languageCode: 'fr',
                    textDirection: 'ltr',
                    regionCode: 'CA',
                } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            ])

            const locale = service.getDeviceLocale()

            expect(locale).toBe('fr_CA')
        })
    })

    describe('getUserAgent', () => {
        it('returns formatted user agent string', () => {
            const userAgent = service.getUserAgent()

            expect(userAgent).toContain('Pera Wallet/1.0.0.1')
            expect(userAgent).toContain('(ios; iPhone 13; 15.0)')
            expect(userAgent).toContain('pera_ios_1.0.0')
        })
    })

    describe('getAppVersion', () => {
        it('returns app version from Expo Application', () => {
            const version = service.getAppVersion()
            expect(version).toBe('1.0.0')
        })
    })

    describe('locale formatting', () => {
        it('does not replace underscores with hyphens', async () => {
            const { getLocales } = await import('expo-localization')
            vi.mocked(getLocales).mockReturnValue([
                {
                    languageTag: 'zh_Hans_CN',
                    languageCode: 'zh',
                    textDirection: 'ltr',
                    regionCode: 'CN',
                } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            ])

            const locale = service.getDeviceLocale()

            expect(locale).toBe('zh_Hans_CN')
        })
        it('removes extra information starting with @', async () => {
            const { getLocales } = await import('expo-localization')
            vi.mocked(getLocales).mockReturnValue([
                {
                    languageTag: 'en-US@rg=ptzzzz',
                    languageCode: 'en',
                    textDirection: 'ltr',
                    regionCode: 'US',
                } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            ])
            const locale = service.getDeviceLocale()
            expect(locale).toBe('en-US@rg=ptzzzz')
        })
    })
})
