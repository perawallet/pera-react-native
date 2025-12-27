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

import { RNDeviceInfoStorageService } from '../device'
import * as RN from 'react-native'

// Mock @perawallet/wallet-core-shared
jest.mock('@perawallet/wallet-core-shared', () => ({
    updateBackendHeaders: jest.fn(),
    updateManualBackendHeaders: jest.fn(),
}))

// Mock react-native-device-info
jest.mock('react-native-device-info', () => ({
    __esModule: true,
    default: {
        getApplicationName: jest.fn(() => 'Pera Wallet'),
        getBundleId: jest.fn(() => 'com.algorand.android'),
        getVersion: jest.fn(() => '1.0.0'),
        getSystemVersion: jest.fn(() => '15.0'),
        getDeviceId: jest.fn(() => 'iPhone13,2'),
        getUniqueId: jest.fn(() => Promise.resolve('unique-device-id')),
        getModel: jest.fn(() => 'iPhone 13'),
        getBuildNumber: jest.fn(() => '1'),
    },
}))

// Mock react-native Platform and NativeModules
jest.mock('react-native', () => ({
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
            getConstants: jest.fn(() => ({
                localeIdentifier: 'en_US',
            })),
        },
    },
}))

describe('RNDeviceInfoStorageService', () => {
    let service: RNDeviceInfoStorageService

    beforeEach(() => {
        jest.clearAllMocks()
        service = new RNDeviceInfoStorageService()
    })

    describe('initializeDeviceInfo', () => {
        it('sets up headers and calls updateBackendHeaders', async () => {
            const {
                updateBackendHeaders,
                // eslint-disable-next-line @typescript-eslint/no-require-imports
            } = require('@perawallet/wallet-core-shared')
            const mockUpdateBackendHeaders = jest.mocked(updateBackendHeaders)
            const mockNativeModules = jest.mocked(RN)
            mockNativeModules.NativeModules.SettingsManager.getConstants =
                jest.fn(() => ({
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
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const DeviceInfo = require('react-native-device-info').default
            const mockDeviceInfo = jest.mocked(DeviceInfo)
            const mockNativeModules = jest.mocked(RN)
            mockNativeModules.NativeModules.SettingsManager.getConstants =
                jest.fn(() => ({
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
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const DeviceInfo = require('react-native-device-info').default
            const mockDeviceInfo = jest.mocked(DeviceInfo)

            const deviceId = await service.getDeviceID()

            expect(deviceId).toBe('unique-device-id')
            expect(mockDeviceInfo.getUniqueId).toHaveBeenCalled()
        })
    })

    describe('getDeviceModel', () => {
        it('returns device model from DeviceInfo', async () => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const DeviceInfo = require('react-native-device-info').default
            const mockDeviceInfo = jest.mocked(DeviceInfo)

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
            const { Platform } = require('react-native')
            const mockPlatform = jest.mocked(Platform)
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
            const mockNativeModules = jest.mocked(RN)
            mockNativeModules.NativeModules.SettingsManager.getConstants =
                jest.fn(() => ({
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
            const { NativeModules } = require('react-native')
            const mockNativeModules = jest.mocked(NativeModules)
            mockNativeModules.SettingsManager.getConstants = jest.fn(() => ({
                settings: {
                    AppleLocale: undefined,
                    AppleLanguages: ['en_US', 'fr_FR'],
                },
            }))

            const locale = service.getDeviceLocale()

            expect(locale).toBe('en-US')
        })

        it('returns formatted locale for Android', () => {
            jest.mocked(RN).Platform.OS = 'android'
            jest.mocked(RN).NativeModules.SettingsManager.getConstants =
                jest.fn(() => ({
                    settings: {
                        AppleLocale: 'en_US',
                        AppleLanguages: ['en_US', 'fr_FR'],
                    },
                }))
            jest.mocked(RN).NativeModules.I18nManager.getConstants = jest.fn(
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
            jest.mocked(RN).Platform.OS = 'ios'
            jest.mocked(RN).NativeModules.SettingsManager.getConstants =
                jest.fn(() => ({
                    settings: {
                        AppleLocale: 'fr_CA',
                        AppleLanguages: ['en_US', 'fr_FR'],
                    },
                }))
            jest.mocked(RN).NativeModules.I18nManager.getConstants = jest.fn(
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
            jest.mocked(RN).Platform.OS = 'ios'
            jest.mocked(RN).NativeModules.SettingsManager.getConstants =
                jest.fn(() => ({
                    settings: {
                        AppleLocale: 'zh_Hans_CN',
                        AppleLanguages: ['en_US', 'fr_FR'],
                    },
                }))
            jest.mocked(RN).NativeModules.I18nManager.getConstants = jest.fn(
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
