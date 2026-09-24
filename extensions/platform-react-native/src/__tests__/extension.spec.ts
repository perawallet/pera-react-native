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

import { vi } from 'vitest'
import type { PushNotificationInitResult } from '@perawallet/wallet-extension-platform'

const { mockInitializeNotifications } = vi.hoisted(() => ({
    mockInitializeNotifications:
        vi.fn<() => Promise<PushNotificationInitResult>>(),
}))

// Stub the platform-service singletons so initialize() exercises only the
// push-notification resilience wrapper. The resilient allSettled trio just
// needs to settle.
vi.mock('../resources', () => ({
    platformServices: {
        crashReporting: {
            initializeCrashReporting: vi.fn(),
        },
        remoteConfig: {
            initializeRemoteConfig: vi.fn().mockResolvedValue(undefined),
        },
        analytics: {
            initializeAnalytics: vi.fn(),
        },
        pushNotification: {
            initializeNotifications: mockInitializeNotifications,
        },
    },
}))

// Stub SSL pinning: the stubbed platform services above lack the methods it
// reads (getBooleanValue etc.), and this suite only exercises the
// push-notification resilience wrapper.
vi.mock('../services/ssl-pinning/ssl-pinning.service', () => ({
    initializeSslPinningService: vi.fn().mockResolvedValue(undefined),
}))

// Keep the real withTimeout (initialize depends on it) but silence the
// expected degradation warn.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        logger: {
            ...actual.logger,
            warn: vi.fn(),
        },
    }
})

import { WithReactNativePlatformExtension } from '../extension'

describe('WithReactNativePlatformExtension', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('initialize', () => {
        it('resolves with token undefined within budget when initializeNotifications never resolves', async () => {
            vi.useFakeTimers()
            try {
                mockInitializeNotifications.mockReturnValue(
                    new Promise<PushNotificationInitResult>(() => {}),
                )

                const extension = WithReactNativePlatformExtension({})
                // initialize no longer waits on push registration, so it
                // resolves before the budget elapses; the budget now bounds the
                // notifications promise it handed back.
                const { notifications } = await extension.initialize()
                await vi.advanceTimersByTimeAsync(8000)
                const result = await notifications

                expect(result.token).toBeUndefined()
                expect(typeof result.unsubscribe).toBe('function')
            } finally {
                mockInitializeNotifications.mockReset()
                vi.useRealTimers()
            }
        })

        it('resolves with token undefined when initializeNotifications rejects', async () => {
            mockInitializeNotifications.mockRejectedValueOnce(
                new Error('notifications init failed'),
            )

            const extension = WithReactNativePlatformExtension({})
            const { notifications } = await extension.initialize()
            const result = await notifications

            expect(result.token).toBeUndefined()
            expect(typeof result.unsubscribe).toBe('function')
        })

        it('returns the token from a successful initializeNotifications (no regression)', async () => {
            const unsubscribe = vi.fn()
            mockInitializeNotifications.mockResolvedValueOnce({
                token: 'abc',
                unsubscribe,
            })

            const extension = WithReactNativePlatformExtension({})
            const { notifications } = await extension.initialize()
            const result = await notifications

            expect(result.token).toBe('abc')
            expect(result.unsubscribe).toBe(unsubscribe)
        })
    })
})
