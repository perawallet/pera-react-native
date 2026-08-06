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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { vi } from 'vitest'
import { Platform } from 'react-native'
import { RNFirebaseService } from '../services/firebase'

// Mock react-native Platform
vi.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
        select: vi.fn(config => config.ios),
    },
}))

// Mock Firebase modules with simple implementations
const { mockGetValue, mockFetchAndActivate } = vi.hoisted(() => ({
    mockGetValue: vi.fn(),
    mockFetchAndActivate: vi.fn().mockResolvedValue(true),
}))

vi.mock('@react-native-firebase/crashlytics', () => ({
    getCrashlytics: vi.fn(() => ({})),
    setCrashlyticsCollectionEnabled: vi.fn().mockResolvedValue(null),
    recordError: vi.fn(),
}))

vi.mock('@react-native-firebase/remote-config', () => ({
    getRemoteConfig: vi.fn(() => ({})),
    fetchAndActivate: mockFetchAndActivate,
    getValue: mockGetValue,
}))

vi.mock('@react-native-firebase/analytics', () => ({
    getAnalytics: vi.fn(() => ({})),
    logEvent: vi.fn(),
}))

vi.mock('@react-native-firebase/messaging', () => ({
    getMessaging: vi.fn(() => ({})),
    registerDeviceForRemoteMessages: vi.fn().mockResolvedValue(undefined),
    getToken: vi.fn().mockResolvedValue('mock-fcm-token'),
    onMessage: vi.fn(() => vi.fn()),
    onNotificationOpenedApp: vi.fn(() => vi.fn()),
    getInitialNotification: vi.fn().mockResolvedValue(null),
}))

vi.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {
        requestPermission: vi.fn().mockResolvedValue({
            authorizationStatus: 1,
        }),
        createChannel: vi.fn().mockResolvedValue(undefined),
        displayNotification: vi.fn().mockResolvedValue(undefined),
        onForegroundEvent: vi.fn(() => vi.fn()),
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
import * as crashlytics from '@react-native-firebase/crashlytics'
import notifee from '@notifee/react-native'

const mockNotifee = notifee as any

describe('RNFirebaseService', () => {
    let service: RNFirebaseService

    beforeEach(() => {
        vi.clearAllMocks()
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
                vi.mocked(remoteConfig.fetchAndActivate).mockRejectedValueOnce(
                    new Error('Fetch failed'),
                )
                await expect(
                    service.initializeRemoteConfig(),
                ).resolves.not.toThrow()
            })
        })

        describe('getStringValue', () => {
            beforeEach(async () => {
                await service.initializeRemoteConfig()
            })

            it('should return string value from remote config', () => {
                vi.mocked(remoteConfig.getValue).mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                } as any)
                const result = service.getStringValue('active_locales')
                expect(result).toBe('mock-string-value')
            })

            it('should return value even when fallback provided', () => {
                vi.mocked(remoteConfig.getValue).mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                } as any)
                const result = service.getStringValue(
                    'active_locales',
                    'fallback',
                )
                expect(result).toBe('mock-string-value')
            })

            it('should return fallback string when provided and getValue nothing', async () => {
                vi.mocked(remoteConfig.getValue).mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getStringValue(
                    'active_locales',
                    'fallback',
                )
                expect(result).toBe('fallback')
            })

            it('should return empty string when no fallback and getValue nothing', async () => {
                vi.mocked(remoteConfig.getValue).mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getStringValue('active_locales')
                expect(result).toBe('')
            })
        })

        describe('getBooleanValue', () => {
            beforeEach(async () => {
                await service.initializeRemoteConfig()
            })

            it('should return boolean value from remote config', () => {
                vi.mocked(remoteConfig.getValue).mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                    getSource: () => 'remote',
                } as any)
                const result = service.getBooleanValue('enable_pera_card')
                expect(result).toEqual(true)
            })

            it('should return value even when fallback provided', () => {
                vi.mocked(remoteConfig.getValue).mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                    getSource: () => 'remote',
                } as any)
                const result = service.getBooleanValue(
                    'enable_pera_card',
                    false,
                )
                expect(result).toEqual(true)
            })

            it('should return fallback ', async () => {
                vi.mocked(remoteConfig.getValue).mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getBooleanValue('enable_pera_card', true)
                expect(result).toEqual(true)
            })

            it('should return default when no fallback provided ', async () => {
                vi.mocked(remoteConfig.getValue).mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getBooleanValue('enable_pera_card')
                expect(result).toEqual(false)
            })

            it('returns the fallback when the value is a baked-in setDefaults default rather than a remote fetch', () => {
                vi.mocked(remoteConfig.getValue).mockReturnValueOnce({
                    asString: () => 'false',
                    asBoolean: () => false,
                    asNumber: () => 0,
                    getSource: () => 'default',
                } as any)
                const result = service.getBooleanValue('enable_pera_card', true)
                expect(result).toEqual(true)
            })

            it('returns the fallback when the value is only a static default', () => {
                vi.mocked(remoteConfig.getValue).mockReturnValueOnce({
                    asString: () => 'false',
                    asBoolean: () => false,
                    asNumber: () => 0,
                    getSource: () => 'static',
                } as any)
                const result = service.getBooleanValue('enable_pera_card', true)
                expect(result).toEqual(true)
            })

            it('returns the remote value when the source is a real remote fetch, ignoring the fallback', () => {
                vi.mocked(remoteConfig.getValue).mockReturnValueOnce({
                    asString: () => 'false',
                    asBoolean: () => false,
                    asNumber: () => 0,
                    getSource: () => 'remote',
                } as any)
                const result = service.getBooleanValue('enable_pera_card', true)
                expect(result).toEqual(false)
            })
        })

        describe('getNumberValue', () => {
            beforeEach(async () => {
                await service.initializeRemoteConfig()
            })

            it('should return number value from remote config', () => {
                vi.mocked(remoteConfig.getValue).mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                } as any)
                const result = service.getNumberValue('fee_min_txn_fee')
                expect(result).toEqual(42)
            })

            it('should ignore fallback value when value received', () => {
                vi.mocked(remoteConfig.getValue).mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                } as any)
                const result = service.getNumberValue('fee_min_txn_fee', 100)
                expect(result).toEqual(42)
            })

            it('should return fallback value when no value received', () => {
                vi.mocked(remoteConfig.getValue).mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getNumberValue('fee_min_txn_fee', 100)
                expect(result).toEqual(100)
            })

            it('should return 0 value when no value or fallback', () => {
                vi.mocked(remoteConfig.getValue).mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getNumberValue('fee_min_txn_fee')
                expect(result).toEqual(0)
            })
        })

        describe('Remote Config Edge Cases', () => {
            it('should return fallback or default when remoteConfig is null', () => {
                const nullService = new RNFirebaseService()

                expect(
                    nullService.getStringValue('test_key' as any, 'fallback'),
                ).toBe('fallback')
                expect(nullService.getStringValue('test_key' as any)).toBe('')

                expect(
                    nullService.getBooleanValue('test_key' as any, true),
                ).toBe(true)
                expect(nullService.getBooleanValue('test_key' as any)).toBe(
                    false,
                )

                expect(nullService.getNumberValue('test_key' as any, 42)).toBe(
                    42,
                )
                expect(nullService.getNumberValue('test_key' as any)).toBe(0)
            })

            it('should return fallback or default when getValue throws', async () => {
                await service.initializeRemoteConfig()
                vi.mocked(remoteConfig.getValue).mockImplementation(() => {
                    throw new Error('test error')
                })

                expect(
                    service.getStringValue('test_key' as any, 'fallback'),
                ).toBe('fallback')
                expect(service.getStringValue('test_key' as any)).toBe('')

                expect(service.getBooleanValue('test_key' as any, true)).toBe(
                    true,
                )
                expect(service.getBooleanValue('test_key' as any)).toBe(false)

                expect(service.getNumberValue('test_key' as any, 42)).toBe(42)
                expect(service.getNumberValue('test_key' as any)).toBe(0)
            })
        })
    })

    describe('Notifications', () => {
        it('reports push notifications as supported', () => {
            expect(service.isSupported()).toBe(true)
        })

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
                vi.mocked(Platform).OS = 'android'
                vi.mocked(Platform.select).mockImplementation(
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
                vi.mocked(messaging.getToken).mockRejectedValueOnce(
                    new Error('Token failed'),
                )

                const result = await service.initializeNotifications()

                expect(result.token).toBeUndefined()
                expect(result).toHaveProperty('unsubscribe')
            })

            it('times out the FCM token fetch and resolves with token undefined within budget', async () => {
                vi.useFakeTimers()
                try {
                    mockNotifee.requestPermission.mockResolvedValue({
                        authorizationStatus: 1, //AUTHORIZED
                    })
                    // getToken never settles — the known indefinite-hang surface.
                    vi.mocked(messaging.getToken).mockReturnValue(
                        new Promise<string>(() => {}),
                    )

                    const resultPromise = service.initializeNotifications()
                    // Advance past the 5s FCM token fetch budget.
                    await vi.advanceTimersByTimeAsync(5000)
                    const result = await resultPromise

                    expect(result.token).toBeUndefined()
                    expect(typeof result.unsubscribe).toBe('function')
                } finally {
                    // Restore a settling implementation so the never-resolving
                    // stub cannot leak into later tests.
                    vi.mocked(messaging.getToken).mockResolvedValue(
                        'mock-fcm-token',
                    )
                    vi.useRealTimers()
                }
            })

            it('resolves without a token when notifee.requestPermission() rejects', async () => {
                mockNotifee.requestPermission.mockRejectedValueOnce(
                    new Error('permission request failed'),
                )

                const result = await service.initializeNotifications()

                expect(result.token).toBeUndefined()
                expect(typeof result.unsubscribe).toBe('function')
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
                    // Platform.select returns the android value due to mock
                    android: {
                        channelId: 'default',
                        smallIcon: 'ic_notification_small',
                    },
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
                    // Platform.select returns the android value due to mock
                    android: {
                        channelId: 'default',
                        smallIcon: 'ic_notification_small',
                    },
                })
            })

            it('routes a foreground PRESS tap to the notification-open listener', async () => {
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 1, //AUTHORIZED
                })
                const listener = vi.fn()
                service.addNotificationOpenListener(listener)
                await service.initializeNotifications()

                const onForegroundEventCallback = (
                    notifee.onForegroundEvent as any
                ).mock.calls[0][0] as (event: any) => Promise<void>
                expect(onForegroundEventCallback).toBeDefined()

                await onForegroundEventCallback({
                    type: 0, // EventType.PRESS
                    detail: {
                        notification: { data: { url: 'pera://deeplink' } },
                    },
                })

                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({ url: 'pera://deeplink' }),
                )
            })

            it('routes a foreground ACTION_PRESS tap to the notification-open listener', async () => {
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 1, //AUTHORIZED
                })
                const listener = vi.fn()
                service.addNotificationOpenListener(listener)
                await service.initializeNotifications()

                const onForegroundEventCallback = (
                    mockNotifee.onForegroundEvent as any
                ).mock.calls[0][0] as (event: any) => Promise<void>
                expect(onForegroundEventCallback).toBeDefined()

                await onForegroundEventCallback({
                    type: 1, // EventType.ACTION_PRESS
                    detail: {
                        notification: { data: { url: 'pera://action' } },
                    },
                })

                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({ url: 'pera://action' }),
                )
            })

            it('forwards type and account_address for a multisig push that carries no deeplink url', async () => {
                mockNotifee.requestPermission.mockResolvedValue({
                    authorizationStatus: 1, //AUTHORIZED
                })
                const listener = vi.fn()
                service.addNotificationOpenListener(listener)
                await service.initializeNotifications()

                const onForegroundEventCallback = (
                    notifee.onForegroundEvent as any
                ).mock.calls[0][0] as (event: any) => Promise<void>

                await onForegroundEventCallback({
                    type: 0, // EventType.PRESS
                    detail: {
                        notification: {
                            data: {
                                type: 'multisig-new-sign-request',
                                account_address: 'MSIG_ADDR',
                            },
                        },
                    },
                })

                // The sign-request push has no `url`; routing must still fire so
                // the app can resolve it by type.
                expect(listener).toHaveBeenCalledWith({
                    url: undefined,
                    type: 'multisig-new-sign-request',
                    accountAddress: 'MSIG_ADDR',
                })
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
            beforeEach(() => {
                service.initializeCrashReporting()
            })

            it('should record Error instances', () => {
                const error = new Error('Test error')
                service.recordNonFatalError(error)
                expect(crashlytics.recordError).toHaveBeenCalledWith(
                    expect.anything(),
                    error,
                )
            })

            it('should handle string errors', () => {
                service.recordNonFatalError('String error')
                expect(crashlytics.recordError).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.any(Error),
                )
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
