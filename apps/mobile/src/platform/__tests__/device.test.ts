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
import DeviceInfo from 'react-native-device-info'

// Mock @perawallet/wallet-core-shared
vi.mock('@perawallet/wallet-core-shared', () => ({
    updateBackendHeaders: vi.fn(),
    updateManualBackendHeaders: vi.fn(),
}))

// Mock react-native-device-info
vi.mock('react-native-device-info', () => ({
    __esModule: true,
    default: {
        getApplicationName: vi.fn(() => 'Pera Wallet'),
        getBundleId: vi.fn(() => 'com.algorand.android'),
        getVersion: vi.fn(() => '1.0.0'),
        getSystemVersion: vi.fn(() => '15.0'),
        getDeviceId: vi.fn(() => 'iPhone13,2'),
        getUniqueId: vi.fn(() => Promise.resolve('unique-device-id')),
        getModel: vi.fn(() => 'iPhone 13'),
        getBuildNumber: vi.fn(() => '1'),
    },
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
        service = new RNDeviceInfoStorageService()
    })

    describe('initializeDeviceInfo', () => {
        it('sets up headers and calls updateBackendHeaders', async () => {
            const { updateBackendHeaders } = await import('@perawallet/wallet-core-shared')
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

        it('calls DeviceInfo methods for header values', async () => {
            const mockDeviceInfo = vi.mocked(DeviceInfo)
            const mockNativeModules = vi.mocked(RN)
            mockNativeModules.NativeModules.SettingsManager.getConstants =
                vi.fn(() => ({
                    settings: {
                        AppleLocale: undefined,
                        AppleLanguages: ['en_US', 'fr_FR'],
                    },
                }))

            service.initializeDeviceInfo()

            expect(mockDeviceInfo.getApplicationName).toHaveBeenCalled()
            expect(mockDeviceInfo.getBundleId).toHaveBeenCalled()
            expect(mockDeviceInfo.getVersion).toHaveBeenCalled()
            expect(mockDeviceInfo.getSystemVersion).toHaveBeenCalled()
            expect(mockDeviceInfo.getDeviceId).toHaveBeenCalled()
        })
    })

    describe('getDeviceID', () => {
        it('returns unique device ID from DeviceInfo', async () => {
            const mockDeviceInfo = vi.mocked(DeviceInfo)

            const deviceId = await service.getDeviceID()

            expect(deviceId).toBe('unique-device-id')
            expect(mockDeviceInfo.getUniqueId).toHaveBeenCalled()
        })
    })

    describe('getDeviceModel', () => {
        it('returns device model from DeviceInfo', async () => {
            const mockDeviceInfo = vi.mocked(DeviceInfo)

            const model = service.getDeviceModel()

            expect(model).toBe('iPhone 13')
            expect(mockDeviceInfo.getModel).toHaveBeenCalled()
        })
    })

    describe('getDevicePlatform', () => {
        it('returns iOS platform', () => {
            const platform = service.getDevicePlatform()

            expect(platform).toBe('ios')
        })

        it('returns android platform when Platform.OS is android', async () => {
            // Import and mock Platform directly
            // eslint-disable-next-line @typescript-eslint/no-require-imports
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
        it('returns formatted locale for iOS', () => {
            const mockNativeModules = vi.mocked(RN)
            mockNativeModules.NativeModules.SettingsManager.getConstants =
                vi.fn(() => ({
                    settings: {
                        AppleLocale: 'en-US',
                        AppleLanguages: ['en_US', 'fr_FR'],
                    },
                }))
            const locale = service.getDeviceLocale()

            expect(locale).toBe('en-US')
        })

        it('handles iOS locale from AppleLanguages when AppleLocale is not available', async () => {
            // Mock iOS without AppleLocale
            // eslint-disable-next-line @typescript-eslint/no-require-imports
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

        it('returns formatted locale for Android', () => {
            vi.mocked(RN).Platform.OS = 'android'
            vi.mocked(RN).NativeModules.SettingsManager.getConstants =
                vi.fn(() => ({
                    settings: {
                        AppleLocale: 'en_US',
                        AppleLanguages: ['en_US', 'fr_FR'],
                    },
                }))
            vi.mocked(RN).NativeModules.I18nManager.getConstants = vi.fn(
                () => ({
                    isRTL: false,
                    doLeftAndRightSwapInRTL: false,
                    localeIdentifier: 'en_GB',
                }),
            )

            const androidService = new RNDeviceInfoStorageService()
            const locale = androidService.getDeviceLocale()

            expect(locale).toBe('en-GB')
        })

        it('converts underscores to hyphens in locale', async () => {
            // Spy on the NativeModules to override the AppleLocale value
            vi.mocked(RN).Platform.OS = 'ios'
            vi.mocked(RN).NativeModules.SettingsManager.getConstants =
                vi.fn(() => ({
                    settings: {
                        AppleLocale: 'fr_CA',
                        AppleLanguages: ['en_US', 'fr_FR'],
                    },
                }))
            vi.mocked(RN).NativeModules.I18nManager.getConstants = vi.fn(
                () => ({
                    isRTL: false,
                    doLeftAndRightSwapInRTL: false,
                    localeIdentifier: 'en_GB',
                }),
            )

            const locale = service.getDeviceLocale()

            expect(locale).toBe('fr-CA')
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
        it('returns app version from DeviceInfo', () => {
            const version = service.getAppVersion()

            expect(version).toBe('1.0.0')
        })
    })

    describe('locale formatting', () => {
        it('replaces all underscores with hyphens', async () => {
            // Spy on the NativeModules to override the AppleLocale value
            vi.mocked(RN).Platform.OS = 'ios'
            vi.mocked(RN).NativeModules.SettingsManager.getConstants =
                vi.fn(() => ({
                    settings: {
                        AppleLocale: 'zh_Hans_CN',
                        AppleLanguages: ['en_US', 'fr_FR'],
                    },
                }))
            vi.mocked(RN).NativeModules.I18nManager.getConstants = vi.fn(
                () => ({
                    isRTL: false,
                    doLeftAndRightSwapInRTL: false,
                    localeIdentifier: 'en_GB',
                }),
            )

            const locale = service.getDeviceLocale()

            expect(locale).toBe('zh-Hans-CN')
        })
    })
})
