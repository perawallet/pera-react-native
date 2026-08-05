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

import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockGetToken, mockGetMessaging } = vi.hoisted(() => ({
    mockGetToken: vi.fn(),
    mockGetMessaging: vi.fn(() => ({ app: {} })),
}))
vi.mock('firebase/messaging', () => ({
    getToken: mockGetToken,
    getMessaging: mockGetMessaging,
}))

const getFirebaseAppMock = vi.hoisted(() => vi.fn())
vi.mock('../firebase-app', () => ({ getFirebaseApp: getFirebaseAppMock }))

const detectBrowserMock = vi.hoisted(() => vi.fn(() => ({ name: 'Chrome' })))
vi.mock('../browser', () => ({ detectBrowser: detectBrowserMock }))

const configMock = vi.hoisted(() => ({
    config: { firebaseVapidKey: 'test-vapid-key' },
}))
vi.mock('@perawallet/wallet-core-config', () => configMock)

import { ChromePushNotificationService } from '../push-notifications'

const setServiceWorker = (registration: unknown): void => {
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            serviceWorker: { getRegistration: async () => registration },
        },
    })
}

describe('ChromePushNotificationService', () => {
    afterEach(() => {
        vi.clearAllMocks()
        configMock.config.firebaseVapidKey = 'test-vapid-key'
        detectBrowserMock.mockReturnValue({ name: 'Chrome' })
    })

    it('resolves the FCM token from the background service worker registration', async () => {
        const registration = { scope: 'chrome-extension://abc/' }
        setServiceWorker(registration)
        getFirebaseAppMock.mockReturnValue({ name: '[DEFAULT]' })
        mockGetToken.mockResolvedValue('fcm-token-123')

        const token = await new ChromePushNotificationService().getPushToken()

        expect(token).toBe('fcm-token-123')
        expect(mockGetToken).toHaveBeenCalledWith(expect.anything(), {
            vapidKey: 'test-vapid-key',
            serviceWorkerRegistration: registration,
        })
    })

    it('returns undefined when no Firebase app is configured', async () => {
        setServiceWorker({ scope: 'chrome-extension://abc/' })
        getFirebaseAppMock.mockReturnValue(null)

        const token = await new ChromePushNotificationService().getPushToken()

        expect(token).toBeUndefined()
        expect(mockGetToken).not.toHaveBeenCalled()
    })

    it('returns undefined when no VAPID key is baked in', async () => {
        setServiceWorker({ scope: 'chrome-extension://abc/' })
        getFirebaseAppMock.mockReturnValue({ name: '[DEFAULT]' })
        configMock.config.firebaseVapidKey = ''

        const token = await new ChromePushNotificationService().getPushToken()

        expect(token).toBeUndefined()
        expect(mockGetToken).not.toHaveBeenCalled()
    })

    it('returns undefined when the service worker registration is absent', async () => {
        setServiceWorker(undefined)
        getFirebaseAppMock.mockReturnValue({ name: '[DEFAULT]' })

        const token = await new ChromePushNotificationService().getPushToken()

        expect(token).toBeUndefined()
        expect(mockGetToken).not.toHaveBeenCalled()
    })

    // A rejected getToken (offline, revoked permission, FCM 5xx) must never
    // propagate — initializeNotifications runs inside cold-start bootstrap.
    it('swallows a getToken rejection', async () => {
        setServiceWorker({ scope: 'chrome-extension://abc/' })
        getFirebaseAppMock.mockReturnValue({ name: '[DEFAULT]' })
        mockGetToken.mockRejectedValue(new Error('permission-blocked'))

        const token = await new ChromePushNotificationService().getPushToken()

        expect(token).toBeUndefined()
    })

    it('initializeNotifications returns the token and a no-op unsubscribe', async () => {
        setServiceWorker({ scope: 'chrome-extension://abc/' })
        getFirebaseAppMock.mockReturnValue({ name: '[DEFAULT]' })
        mockGetToken.mockResolvedValue('fcm-token-123')

        const result =
            await new ChromePushNotificationService().initializeNotifications()

        expect(result.token).toBe('fcm-token-123')
        expect(() => result.unsubscribe()).not.toThrow()
    })

    it('reports unsupported on Firefox, which has no background service worker', () => {
        setServiceWorker({ scope: 'chrome-extension://abc/' })
        detectBrowserMock.mockReturnValue({ name: 'Firefox' })

        expect(new ChromePushNotificationService().isSupported()).toBe(false)
    })

    it('reports supported on Chrome', () => {
        setServiceWorker({ scope: 'chrome-extension://abc/' })

        expect(new ChromePushNotificationService().isSupported()).toBe(true)
    })
})

describe('ChromePushNotificationService notification open', () => {
    const setSearch = (search: string): void => {
        Object.defineProperty(globalThis, 'location', {
            configurable: true,
            value: { search },
        })
    }

    it('replays the deeplink from the surface query string', () => {
        setSearch('?deeplink=perawallet%3A%2F%2Fasset%2F0')
        const listener = vi.fn()

        new ChromePushNotificationService().addNotificationOpenListener(
            listener,
        )

        expect(listener).toHaveBeenCalledWith('perawallet://asset/0')
    })

    it('does not fire without a deeplink param', () => {
        setSearch('?requestId=abc')
        const listener = vi.fn()

        new ChromePushNotificationService().addNotificationOpenListener(
            listener,
        )

        expect(listener).not.toHaveBeenCalled()
    })
})
