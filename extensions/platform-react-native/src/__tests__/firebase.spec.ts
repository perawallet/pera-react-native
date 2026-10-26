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
import { onNotificationOpenedApp } from '@react-native-firebase/messaging'
import { RNFirebaseService } from '../services/firebase'

// Mock react-native Platform
vi.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
    },
}))

// Mock Firebase modules with simple implementations
const {
    mockGetValue,
    mockFetchAndActivate,
    mockSetConfigSettings,
    mockSetDefaults,
} = vi.hoisted(() => ({
    mockGetValue: vi.fn(),
    mockFetchAndActivate: vi.fn().mockResolvedValue(true),
    mockSetConfigSettings: vi.fn().mockResolvedValue(undefined),
    mockSetDefaults: vi.fn().mockResolvedValue(null),
}))

vi.mock('@react-native-firebase/crashlytics', () => ({
    getCrashlytics: vi.fn(() => ({})),
    setCrashlyticsCollectionEnabled: vi.fn().mockResolvedValue(null),
    recordError: vi.fn(),
}))

vi.mock('@react-native-firebase/remote-config', () => ({
    getRemoteConfig: vi.fn(() => ({
        setConfigSettings: mockSetConfigSettings,
        setDefaults: mockSetDefaults,
    })),
    fetchAndActivate: mockFetchAndActivate,
    getValue: mockGetValue,
}))

vi.mock('@react-native-firebase/analytics', () => ({
    getAnalytics: vi.fn(() => ({})),
    logEvent: vi.fn(),
    setAnalyticsCollectionEnabled: vi.fn(() => Promise.resolve()),
    setConsent: vi.fn(() => Promise.resolve()),
    resetAnalyticsData: vi.fn(() => Promise.resolve()),
}))

vi.mock('@react-native-firebase/messaging', () => ({
    getMessaging: vi.fn(() => ({})),
    registerDeviceForRemoteMessages: vi.fn().mockResolvedValue(undefined),
    getToken: vi.fn().mockResolvedValue('mock-fcm-token'),
    onMessage: vi.fn(() => vi.fn()),
    onNotificationOpenedApp: vi.fn(() => vi.fn()),
    getInitialNotification: vi.fn().mockResolvedValue(null),
}))

const { mockRemoveResponseSubscription } = vi.hoisted(() => ({
    mockRemoveResponseSubscription: vi.fn(),
}))

vi.mock('expo-notifications', () => ({
    AndroidImportance: { DEFAULT: 3 },
    getPermissionsAsync: vi.fn(),
    requestPermissionsAsync: vi.fn(),
    setNotificationChannelAsync: vi.fn().mockResolvedValue(null),
    setNotificationHandler: vi.fn(),
    scheduleNotificationAsync: vi.fn().mockResolvedValue('id'),
    addNotificationResponseReceivedListener: vi.fn(() => ({
        remove: mockRemoveResponseSubscription,
    })),
}))

import * as remoteConfig from '@react-native-firebase/remote-config'
import * as analytics from '@react-native-firebase/analytics'
import * as messaging from '@react-native-firebase/messaging'
import * as crashlytics from '@react-native-firebase/crashlytics'
import * as notifications from 'expo-notifications'
import { remoteConfigDefaultsRegistry } from '@perawallet/wallet-extension-platform'

describe('RNFirebaseService', () => {
    let service: RNFirebaseService

    beforeEach(() => {
        vi.clearAllMocks()
        service = new RNFirebaseService()
    })

    afterEach(() => {
        remoteConfigDefaultsRegistry.reset()
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

            // Both native writes must land before the fetch. Assigning the
            // `settings`/`defaultConfig` properties instead dispatched the fetch
            // first, and native setDefaults then reset the config database and
            // cancelled the in-flight request — so no fetch ever succeeded and
            // every key served its bundled default.
            it('completes both native config writes before fetching', async () => {
                const order: string[] = []
                mockSetConfigSettings.mockImplementationOnce(async () => {
                    order.push('setConfigSettings')
                })
                mockSetDefaults.mockImplementationOnce(async () => {
                    order.push('setDefaults')
                    return null
                })
                mockFetchAndActivate.mockImplementationOnce(async () => {
                    order.push('fetchAndActivate')
                    return true
                })

                await service.initializeRemoteConfig()

                expect(order).toEqual([
                    'setConfigSettings',
                    'setDefaults',
                    'fetchAndActivate',
                ])
            })

            // A second concurrent fetch makes Firebase cancel the in-flight one.
            it('shares one fetch between concurrent callers, then allows a later refetch', async () => {
                await Promise.all([
                    service.initializeRemoteConfig(),
                    service.initializeRemoteConfig(),
                ])
                expect(mockFetchAndActivate).toHaveBeenCalledTimes(1)

                await service.initializeRemoteConfig()
                expect(mockFetchAndActivate).toHaveBeenCalledTimes(2)
            })

            it('seeds the bundled defaults so unfetched keys still resolve', async () => {
                await service.initializeRemoteConfig()

                expect(mockSetDefaults).toHaveBeenCalledWith(
                    expect.objectContaining({
                        staking_projects_i18n: expect.any(String),
                    }),
                )
            })

            it('seeds defaults another package declared alongside the platform ones', async () => {
                remoteConfigDefaultsRegistry.declare({ fixture_fee: 1000 })

                await service.initializeRemoteConfig()

                expect(mockSetDefaults).toHaveBeenCalledWith(
                    expect.objectContaining({
                        staking_projects_i18n: expect.any(String),
                        fixture_fee: 1000,
                    }),
                )
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
                const result = service.getNumberValue('fixture_fee')
                expect(result).toEqual(42)
            })

            it('should ignore fallback value when value received', () => {
                vi.mocked(remoteConfig.getValue).mockReturnValueOnce({
                    asString: () => 'mock-string-value',
                    asBoolean: () => true,
                    asNumber: () => 42,
                } as any)
                const result = service.getNumberValue('fixture_fee', 100)
                expect(result).toEqual(42)
            })

            it('should return fallback value when no value received', () => {
                vi.mocked(remoteConfig.getValue).mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getNumberValue('fixture_fee', 100)
                expect(result).toEqual(100)
            })

            it('should return 0 value when no value or fallback', () => {
                vi.mocked(remoteConfig.getValue).mockImplementation(() => {
                    throw new Error('no value')
                })
                const result = service.getNumberValue('fixture_fee')
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
        const granted = { granted: true }
        const denied = { granted: false }

        const remotePush = (data: Record<string, unknown>) => ({
            request: { trigger: { type: 'push' }, content: { data } },
        })
        const localNotification = (data: Record<string, unknown>) => ({
            request: { trigger: null, content: { data } },
        })

        const responseCallback = () =>
            vi.mocked(notifications.addNotificationResponseReceivedListener)
                .mock.calls[0]![0] as (response: unknown) => void
        const notificationHandler = () =>
            vi.mocked(notifications.setNotificationHandler).mock.calls[0]![0]!
                .handleNotification as (notification: unknown) => Promise<{
                shouldShowBanner: boolean
                shouldShowList: boolean
                shouldPlaySound: boolean
            }>
        const onMessageCallback = () =>
            vi.mocked(messaging.onMessage).mock.calls[0]![1] as (
                message: unknown,
            ) => Promise<void>

        beforeEach(() => {
            vi.mocked(Platform).OS = 'ios'
            vi.mocked(notifications.requestPermissionsAsync).mockResolvedValue(
                granted as any,
            )
        })

        it('reports push notifications as supported', () => {
            expect(service.isSupported()).toBe(true)
        })

        // The FCM payload names these differently from /v1/notifications; reading
        // only the REST spelling left every multisig push unroutable.
        describe('push payload field mapping', () => {
            const openPayloadFor = async (
                data: Record<string, unknown>,
            ): Promise<unknown> => {
                await service.initializeNotifications()

                const onOpened = vi.mocked(onNotificationOpenedApp).mock
                    .calls[0]?.[1] as (message: { data: unknown }) => void

                const received: unknown[] = []
                service.addNotificationOpenListener(payload =>
                    received.push(payload),
                )
                onOpened({ data })

                return received[0]
            }

            it('reads the type from the push spelling `notification_type`', async () => {
                const payload = await openPayloadFor({
                    url: 'perawallet://asset-inbox/?address=SHARED_ADDR',
                    notification_type: 'multi-sig-import-account',
                })

                expect(payload).toMatchObject({
                    type: 'multi-sig-import-account',
                })
            })

            // The deeplink's `address` is the invitee's account, identical on
            // every invitation — sourcing it would guarantee a wrong match.
            it('leaves the address undefined rather than taking it from the deeplink', async () => {
                const payload = await openPayloadFor({
                    url: 'perawallet://asset-inbox/?address=INVITEE_ADDR',
                    notification_type: 'multisig-new-sign-request',
                })

                expect(payload).toMatchObject({
                    accountAddress: undefined,
                })
            })

            // A sign-request push names the shared account this way; without it
            // resolution falls back to "the only pending item of this kind".
            it('reads the address from `multisig_account_address`', async () => {
                const payload = await openPayloadFor({
                    url: 'perawallet://asset-inbox/?address=SHARED_ADDR',
                    multisig_account_address: 'SHARED_ADDR',
                    notification_type: 'multisig-new-sign-request',
                })

                expect(payload).toMatchObject({
                    type: 'multisig-new-sign-request',
                    accountAddress: 'SHARED_ADDR',
                })
            })

            it('still honours the REST spellings when the payload uses them', async () => {
                const payload = await openPayloadFor({
                    type: 'multisig-new-sign-request',
                    account_address: 'EXPLICIT_ADDR',
                })

                expect(payload).toMatchObject({
                    type: 'multisig-new-sign-request',
                    accountAddress: 'EXPLICIT_ADDR',
                })
            })
        })

        describe('getPushToken', () => {
            it('returns the FCM token when notifications are permitted', async () => {
                vi.mocked(notifications.getPermissionsAsync).mockResolvedValue(
                    granted as any,
                )

                await expect(service.getPushToken()).resolves.toBe(
                    'mock-fcm-token',
                )
            })

            it('returns no token without permission', async () => {
                vi.mocked(notifications.getPermissionsAsync).mockResolvedValue(
                    denied as any,
                )

                await expect(service.getPushToken()).resolves.toBeUndefined()
                expect(messaging.getToken).not.toHaveBeenCalled()
            })
        })

        describe('initializeNotifications', () => {
            it('resolves the FCM token once permission is granted', async () => {
                const result = await service.initializeNotifications()

                expect(result.token).toEqual('mock-fcm-token')
                expect(typeof result.unsubscribe).toBe('function')
            })

            it('creates the default channel on Android', async () => {
                vi.mocked(Platform).OS = 'android'

                await service.initializeNotifications()

                expect(
                    notifications.setNotificationChannelAsync,
                ).toHaveBeenCalledWith(
                    'default',
                    expect.objectContaining({ importance: 3 }),
                )
            })

            it('creates no channel on iOS', async () => {
                await service.initializeNotifications()

                expect(
                    notifications.setNotificationChannelAsync,
                ).not.toHaveBeenCalled()
            })

            it('removes the response subscription on unsubscribe', async () => {
                const result = await service.initializeNotifications()

                result.unsubscribe()

                expect(mockRemoveResponseSubscription).toHaveBeenCalled()
            })

            it('resolves without a token or listeners when permission is denied', async () => {
                vi.mocked(
                    notifications.requestPermissionsAsync,
                ).mockResolvedValue(denied as any)

                const result = await service.initializeNotifications()

                expect(result.token).toBeUndefined()
                expect(messaging.onMessage).not.toHaveBeenCalled()
            })

            it('resolves without a token when the permission request rejects', async () => {
                vi.mocked(
                    notifications.requestPermissionsAsync,
                ).mockRejectedValueOnce(new Error('permission request failed'))

                const result = await service.initializeNotifications()

                expect(result.token).toBeUndefined()
                expect(typeof result.unsubscribe).toBe('function')
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

            it('shows a foreground push as a local notification on the default channel', async () => {
                vi.mocked(Platform).OS = 'android'
                await service.initializeNotifications()

                await onMessageCallback()({
                    notification: { title: 'Test Title', body: 'Test Body' },
                    data: { key: 'value' },
                })

                expect(
                    notifications.scheduleNotificationAsync,
                ).toHaveBeenCalledWith({
                    content: {
                        title: 'Test Title',
                        body: 'Test Body',
                        data: { key: 'value' },
                    },
                    trigger: { channelId: 'default' },
                })
            })

            it('falls back to a generic title and shows it immediately on iOS', async () => {
                await service.initializeNotifications()

                await onMessageCallback()({ data: { key: 'value' } })

                expect(
                    notifications.scheduleNotificationAsync,
                ).toHaveBeenCalledWith({
                    content: {
                        title: 'Notification',
                        body: undefined,
                        data: { key: 'value' },
                    },
                    trigger: null,
                })
            })

            it('tells the received listener about a foreground push', async () => {
                const onReceived = vi.fn()
                service.addNotificationReceivedListener(onReceived)
                await service.initializeNotifications()

                await onMessageCallback()({ data: {} })

                expect(onReceived).toHaveBeenCalledTimes(1)
            })

            // iOS hands remote pushes to expo-notifications as well; showing one
            // would duplicate the local copy onMessage already scheduled.
            it('presents the local copy but not the remote push it came from', async () => {
                await service.initializeNotifications()

                await expect(
                    notificationHandler()(localNotification({})),
                ).resolves.toMatchObject({
                    shouldShowBanner: true,
                    shouldShowList: true,
                    shouldPlaySound: true,
                })
                await expect(
                    notificationHandler()(remotePush({})),
                ).resolves.toMatchObject({
                    shouldShowBanner: false,
                    shouldShowList: false,
                })
            })

            it('routes a tap on the local copy to the notification-open listener', async () => {
                const listener = vi.fn()
                service.addNotificationOpenListener(listener)
                await service.initializeNotifications()

                responseCallback()({
                    actionIdentifier:
                        'expo.modules.notifications.actions.DEFAULT',
                    notification: localNotification({
                        url: 'pera://deeplink',
                    }),
                })

                expect(listener).toHaveBeenCalledWith(
                    expect.objectContaining({ url: 'pera://deeplink' }),
                )
            })

            // RNFB's onNotificationOpenedApp already routes it.
            it('leaves a tap on a remote push to RNFB', async () => {
                const listener = vi.fn()
                service.addNotificationOpenListener(listener)
                await service.initializeNotifications()

                responseCallback()({
                    actionIdentifier:
                        'expo.modules.notifications.actions.DEFAULT',
                    notification: remotePush({ url: 'pera://deeplink' }),
                })

                expect(listener).not.toHaveBeenCalled()
            })

            it('forwards type and account_address for a multisig push that carries no deeplink url', async () => {
                const listener = vi.fn()
                service.addNotificationOpenListener(listener)
                await service.initializeNotifications()

                responseCallback()({
                    actionIdentifier:
                        'expo.modules.notifications.actions.DEFAULT',
                    notification: localNotification({
                        type: 'multisig-new-sign-request',
                        account_address: 'MSIG_ADDR',
                    }),
                })

                // The sign-request push has no `url`; routing must still fire so
                // the app can resolve it by type.
                expect(listener).toHaveBeenCalledWith({
                    url: undefined,
                    type: 'multisig-new-sign-request',
                    accountAddress: 'MSIG_ADDR',
                })
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
                // Third argument is jsErrorName, omitted so the error's own
                // stack does the Crashlytics grouping.
                expect(crashlytics.recordError).toHaveBeenCalledWith(
                    expect.anything(),
                    error,
                    undefined,
                )
            })

            // jsErrorName injects a synthetic top stack frame, which is what
            // Crashlytics fingerprints on — without it every logger.error call
            // site collapses into a single issue.
            it('should pass a grouping key through as jsErrorName', () => {
                const error = new Error('Test error')
                service.recordNonFatalError(error, 'Request error encountered')
                expect(crashlytics.recordError).toHaveBeenCalledWith(
                    expect.anything(),
                    error,
                    'Request error encountered',
                )
            })

            it('should handle string errors', () => {
                service.recordNonFatalError('String error')
                expect(crashlytics.recordError).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.any(Error),
                    undefined,
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
            service.setCollectionEnabled(true)
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

    describe('Analytics consent', () => {
        it('starts with collection off and analytics storage denied', () => {
            service.initializeAnalytics()

            expect(
                analytics.setAnalyticsCollectionEnabled,
            ).toHaveBeenLastCalledWith(expect.anything(), false)
            expect(analytics.setConsent).toHaveBeenLastCalledWith(
                expect.anything(),
                expect.objectContaining({ analytics_storage: false }),
            )
        })

        it('drops events until collection is enabled', () => {
            service.initializeAnalytics()

            service.logEvent('before')
            service.setCollectionEnabled(true)
            service.logEvent('after')

            expect(analytics.logEvent).toHaveBeenCalledExactlyOnceWith(
                expect.anything(),
                'after',
                undefined,
            )
        })

        it('grants analytics storage but never the ad consent types', () => {
            service.initializeAnalytics()

            service.setCollectionEnabled(true)

            expect(analytics.setConsent).toHaveBeenLastCalledWith(
                expect.anything(),
                {
                    analytics_storage: true,
                    ad_storage: false,
                    ad_user_data: false,
                    ad_personalization: false,
                },
            )
        })

        it('applies a choice made before analytics initializes', () => {
            service.setCollectionEnabled(true)

            service.initializeAnalytics()

            expect(
                analytics.setAnalyticsCollectionEnabled,
            ).toHaveBeenLastCalledWith(expect.anything(), true)
        })

        it('clears stored analytics data only when consent is withdrawn', () => {
            service.initializeAnalytics()

            service.setCollectionEnabled(false)
            expect(analytics.resetAnalyticsData).not.toHaveBeenCalled()

            service.setCollectionEnabled(true)
            service.setCollectionEnabled(false)
            expect(analytics.resetAnalyticsData).toHaveBeenCalledOnce()
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
