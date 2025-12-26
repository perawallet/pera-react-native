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

/* eslint-disable @typescript-eslint/no-explicit-any */


import { RNFirebaseService } from '../firebase'

// Mock react-native Platform
jest.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
        select: jest.fn(config => config.ios),
    },
}))

// Mock Firebase modules with simple implementations
jest.mock('@react-native-firebase/crashlytics', () => ({
    getCrashlytics: () => ({
        setCrashlyticsCollectionEnabled: jest.fn().mockResolvedValue(null),
        recordError: jest.fn(),
    }),
    setCrashlyticsCollectionEnabled: jest.fn(),
}))

jest.mock('@react-native-firebase/remote-config', () => ({
    __esModule: true,
    getRemoteConfig: jest.fn(() => ({
        setConfigSettings: jest.fn().mockResolvedValue(undefined),
        setDefaults: jest.fn().mockResolvedValue(undefined),
        fetchAndActivate: jest.fn().mockResolvedValue(true),
        getValue: jest.fn(),
    })),
    setConfigSettings: jest.fn().mockResolvedValue(undefined),
    setDefaults: jest.fn().mockResolvedValue(undefined),
    fetchAndActivate: jest.fn().mockResolvedValue(true),
}))

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({
        logEvent: jest.fn(),
    })),
    logEvent: jest.fn(),
}))

jest.mock('@react-native-firebase/messaging', () => ({
    __esModule: true,
    getMessaging: jest.fn(() => ({
        registerDeviceForRemoteMessages: jest.fn().mockResolvedValue(undefined),
        getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
        onMessage: jest.fn(() => jest.fn()),
    })),
    getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
    onMessage: jest.fn(() => jest.fn()),
    registerDeviceForRemoteMessages: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {
        requestPermission: jest.fn().mockResolvedValue({
            authorizationStatus: 1,
        }),
        createChannel: jest.fn().mockResolvedValue(undefined),
        displayNotification: jest.fn().mockResolvedValue(undefined),
        onForegroundEvent: jest.fn(() => jest.fn()),
    },
    AndroidImportance: {
        DEFAULT: 3,
    },
    EventType: {
        ACTION_PRESS: 1,
        PRESS: 0,
    },
    AuthorizationStatus: {
        NOT_DETERMINED: -1,
        DENIED: 0,
        AUTHORIZED: 1,
        PROVISIONAL: 2,
    },
}))

import * as remoteConfig from '@react-native-firebase/remote-config'
import * as analytics from '@react-native-firebase/analytics'
import * as messaging from '@react-native-firebase/messaging'
import notifee from '@notifee/react-native'

const mockRemoteConfig = (remoteConfig as any).getRemoteConfig()
const mockAnalytics = (analytics as any).getAnalytics()
const mockMessaging = (messaging as any).getMessaging()
const mockNotifee = notifee as any

describe('RNFirebaseService', () => {
    let service: RNFirebaseService

    beforeEach(() => {
        jest.clearAllMocks()
        service = new RNFirebaseService()
    })

    describe('Remote Config', () => {
        describe('initializeRemoteConfig', () => {
            it('should initialize remote config successfully', async () => {
                await expect(
                    service.initializeRemoteConfig(),
                ).resolves.not.toThrow()
            })

            it('should handle fetch errors gracefully', async () => {
                mockRemoteConfig.fetchAndActivate.mockRejectedValueOnce(
                    new Error('Fetch failed'),
                )
                await expect(
                    service.initializeRemoteConfig(),
                ).resolves.not.toThrow()
            })
        })

        describe('getStringValue', () => {
            beforeEach(() => {
                service.remoteConfig = mockRemoteConfig as any
            })

            it('should return string value from remote config', () => {
                mockRemoteConfig.getValue.mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                })
                const result = service.getStringValue('welcome_message')
                expect(result).toBe('mock-string-value')
            })

            it('should return value even when fallback provided', () => {
                mockRemoteConfig.getValue.mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                })
                const result = service.getStringValue(
                    'welcome_message',
                    'fallback',
                )
                expect(result).toBe('mock-string-value')
            })

            it('should return fallback string when provided and getValue nothing', async () => {
                mockRemoteConfig.getValue.mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getStringValue(
                    'welcome_message',
                    'fallback',
                )
                expect(result).toBe('fallback')
            })

            it('should return empty string when no fallback and getValue nothing', async () => {
                mockRemoteConfig.getValue.mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getStringValue('welcome_message')
                expect(result).toBe('')
            })
        })

        describe('getBooleanValue', () => {
            beforeEach(() => {
                service.remoteConfig = mockRemoteConfig as any
            })

            it('should return boolean value from remote config', () => {
                mockRemoteConfig.getValue.mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                })
                const result = service.getBooleanValue('welcome_message')
                expect(result).toEqual(true)
            })

            it('should return value even when fallback provided', () => {
                mockRemoteConfig.getValue.mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                })
                const result = service.getBooleanValue('welcome_message', false)
                expect(result).toEqual(true)
            })

            it('should return fallback ', async () => {
                mockRemoteConfig.getValue.mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getBooleanValue('welcome_message', true)
                expect(result).toEqual(true)
            })

            it('should return default when no fallback provided ', async () => {
                mockRemoteConfig.getValue.mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getBooleanValue('welcome_message')
                expect(result).toEqual(false)
            })
        })

        describe('getNumberValue', () => {
            beforeEach(() => {
                service.remoteConfig = mockRemoteConfig as any
            })

            it('should return number value from remote config', () => {
                mockRemoteConfig.getValue.mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                })
                const result = service.getNumberValue('welcome_message')
                expect(result).toEqual(42)
            })

            it('should ignore fallback value when value received', () => {
                mockRemoteConfig.getValue.mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                })
                const result = service.getNumberValue('welcome_message', 100)
                expect(result).toEqual(42)
            })

            it('should return fallback value when no value received', () => {
                mockRemoteConfig.getValue.mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getNumberValue('welcome_message', 100)
                expect(result).toEqual(100)
            })

            it('should return 0 value when no value or fallback', () => {
                mockRemoteConfig.getValue.mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getNumberValue('welcome_message')
                expect(result).toEqual(0)
            })
        })

        describe('Remote Config Edge Cases', () => {
            it('should return fallback or default when remoteConfig is null', () => {
                const nullService = new RNFirebaseService()

                expect(nullService.getStringValue('test_key' as any, 'fallback')).toBe(
                    'fallback',
                )
                expect(nullService.getStringValue('test_key' as any)).toBe('')

                expect(nullService.getBooleanValue('test_key' as any, true)).toBe(true)
                expect(nullService.getBooleanValue('test_key' as any)).toBe(false)

                expect(nullService.getNumberValue('test_key' as any, 42)).toBe(42)
                expect(nullService.getNumberValue('test_key' as any)).toBe(0)
            })

            it('should return fallback or default when getValue throws', async () => {
                await service.initializeRemoteConfig()
                const mockGetValue = jest.fn().mockImplementation(() => {
                    throw new Error('test error')
                })

                    ; (service.remoteConfig!.getValue as jest.Mock) = mockGetValue

                expect(service.getStringValue('test_key' as any, 'fallback')).toBe(
                    'fallback',
                )
                expect(service.getStringValue('test_key' as any)).toBe('')

                expect(service.getBooleanValue('test_key' as any, true)).toBe(true)
                expect(service.getBooleanValue('test_key' as any)).toBe(false)

                expect(service.getNumberValue('test_key' as any, 42)).toBe(42)
                expect(service.getNumberValue('test_key' as any)).toBe(0)
            })
        })

    })

    describe('Notifications', () => {
        describe('initializeNotifications', () => {
            it('should initialize notifications successfully', async () => {
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 1, //AUTHORIZED
                })
                const result = await service.initializeNotifications()

                expect(result).toHaveProperty('token')
                expect(result).toHaveProperty('unsubscribe')
                expect(typeof result.unsubscribe).toBe('function')
                expect(result.token).toEqual('mock-fcm-token')
            })

            it('should handle Android platform correctly', async () => {
                const { Platform } = require('react-native')
                jest.mocked(Platform).OS = 'android'
                jest.mocked(Platform.select).mockImplementation(
                    (config: any) => config.android,
                )
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 1,
                })

                const result = await service.initializeNotifications()

                expect(result.token).toEqual('mock-fcm-token')
                expect(typeof result.unsubscribe).toBe('function')
            })

            it('should call unsubscribe functions when unsubscribe is called', async () => {
                const result = await service.initializeNotifications()

                // Should not throw when calling unsubscribe
                expect(() => result.unsubscribe()).not.toThrow()
            })

            it('should handle permission request errors', async () => {
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 'DENIED',
                })

                const result = await service.initializeNotifications()

                expect(result).toHaveProperty('token')
                expect(result).toHaveProperty('unsubscribe')
            })

            it('should handle messaging registration errors', async () => {
                mockMessaging.registerDeviceForRemoteMessages.mockRejectedValueOnce(
                    new Error('Registration failed'),
                )
                mockMessaging.getToken.mockRejectedValueOnce(
                    new Error('Token failed'),
                )

                const result = await service.initializeNotifications()

                expect(result.token).toBeUndefined()
                expect(result).toHaveProperty('unsubscribe')
            })

            it('should register onMessage and onForegroundEvent handlers', async () => {
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 1, //AUTHORIZED
                })
                await service.initializeNotifications()

                expect(messaging.onMessage).toHaveBeenCalled()
                expect(notifee.onForegroundEvent).toHaveBeenCalled()
            })

            it('should handle onMessage callback with notification data', async () => {
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 1, //AUTHORIZED
                })
                await service.initializeNotifications()

                // Get the callback that was passed to onMessage
                const onMessageCallback = (messaging.onMessage as any).mock
                    .calls[0][1] as (message: any) => Promise<void>
                expect(onMessageCallback).toBeDefined()

                const mockRemoteMessage = {
                    notification: {
                        title: 'Test Title',
                        body: 'Test Body',
                    },
                    data: { key: 'value' },
                }

                await onMessageCallback(mockRemoteMessage)

                expect(notifee.displayNotification).toHaveBeenCalledWith({
                    title: 'Test Title',
                    body: 'Test Body',
                    data: { key: 'value' },
                    android: { channelId: 'default' }, // Platform.select returns android value due to mock
                })
            })

            it('should handle onMessage callback with missing notification data', async () => {
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 1, //AUTHORIZED
                })
                await service.initializeNotifications()

                // Get the callback that was passed to onMessage
                const onMessageCallback = (messaging.onMessage as any).mock
                    .calls[0][1] as (message: any) => Promise<void>
                expect(onMessageCallback).toBeDefined()

                const mockRemoteMessage = {
                    data: { key: 'value' },
                }

                await onMessageCallback(mockRemoteMessage)

                expect(notifee.displayNotification).toHaveBeenCalledWith({
                    title: 'Notification',
                    body: undefined,
                    data: { key: 'value' },
                    android: { channelId: 'default' }, // Platform.select returns android value due to mock
                })
            })

            it('should handle onForegroundEvent callback for PRESS event', async () => {
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 1, //AUTHORIZED
                })
                await service.initializeNotifications()

                // Get the callback that was passed to onForegroundEvent
                const onForegroundEventCallback = (
                    notifee.onForegroundEvent as any
                ).mock.calls[0][0] as (event: any) => Promise<void>
                expect(onForegroundEventCallback).toBeDefined()

                await onForegroundEventCallback({ type: 0 }) // EventType.PRESS

                // Should not throw, currently no-op
            })

            it('should handle onForegroundEvent callback for ACTION_PRESS event', async () => {
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 1, //AUTHORIZED
                })
                await service.initializeNotifications()

                // Get the callback that was passed to onForegroundEvent
                const onForegroundEventCallback = (
                    mockNotifee.onForegroundEvent as any
                ).mock.calls[0][0] as (event: any) => Promise<void>
                expect(onForegroundEventCallback).toBeDefined()

                await onForegroundEventCallback({ type: 1 }) // EventType.ACTION_PRESS

                // Should not throw, currently no-op
            })

            it('should handle onForegroundEvent callback for unknown event type', async () => {
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 1, //AUTHORIZED
                })
                await service.initializeNotifications()

                // Get the callback that was passed to onForegroundEvent
                const onForegroundEventCallback = (
                    mockNotifee.onForegroundEvent as any
                ).mock.calls[0][0] as (event: any) => Promise<void>
                expect(onForegroundEventCallback).toBeDefined()

                await onForegroundEventCallback({ type: 999 }) // Unknown event type

                // Should not throw, hits default case
            })
        })
    })

    describe('Crash Reporting', () => {
        describe('initializeCrashReporting', () => {
            it('should initialize crash reporting', () => {
                expect(() => service.initializeCrashReporting()).not.toThrow()
            })
        })

        describe('recordNonFatalError', () => {
            it('should record Error instances', () => {
                const error = new Error('Test error')
                expect(() => service.recordNonFatalError(error)).not.toThrow()
            })

            it('should handle string errors', () => {
                expect(() =>
                    service.recordNonFatalError('String error'),
                ).not.toThrow()
            })

            it('should handle null errors', () => {
                expect(() => service.recordNonFatalError(null)).not.toThrow()
            })

            it('should handle undefined errors', () => {
                expect(() =>
                    service.recordNonFatalError(undefined),
                ).not.toThrow()
            })

            it('should handle object errors', () => {
                const objectError = { message: 'Object error', code: 500 }
                expect(() =>
                    service.recordNonFatalError(objectError),
                ).not.toThrow()
            })
        })
    })

    describe('Analytics', () => {
        beforeEach(() => {
            service.initializeAnalytics()
        })

        it('logEvent forwards payload to Firebase analytics', () => {
            service.logEvent('test_event', { foo: 'bar' })
            expect(analytics.logEvent).toHaveBeenCalledWith(
                expect.anything(),
                'test_event',
                {
                    foo: 'bar',
                },
            )
        })
        it('logEvent forwards event without payload to Firebase analytics', () => {
            service.logEvent('test_event')
            expect(analytics.logEvent).toHaveBeenCalledWith(
                expect.anything(),
                'test_event',
                undefined,
            )
        })

        it('initializeAnalytics is callable without throwing', () => {
            expect(() => service.initializeAnalytics()).not.toThrow()
        })
    })

    describe('Service Implementation', () => {
        it('should implement CrashReportingService interface', () => {
            expect(service.initializeCrashReporting).toBeDefined()
            expect(service.recordNonFatalError).toBeDefined()
        })

        it('should implement RemoteConfigService interface', () => {
            expect(service.initializeRemoteConfig).toBeDefined()
            expect(service.getStringValue).toBeDefined()
            expect(service.getBooleanValue).toBeDefined()
            expect(service.getNumberValue).toBeDefined()
        })

        it('should have notifications initialization method', () => {
            expect(service.initializeNotifications).toBeDefined()
        })
    })
})
