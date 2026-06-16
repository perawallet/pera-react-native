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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { mockHandleDeepLink, mockGetInitialURL, urlListeners } = vi.hoisted(
    () => ({
        mockHandleDeepLink: vi.fn(),
        mockGetInitialURL: vi.fn(),
        urlListeners: [] as Array<(event: { url: string }) => void>,
    }),
)

vi.mock('react-native', () => ({
    Linking: {
        getInitialURL: mockGetInitialURL,
        addEventListener: (
            _event: string,
            cb: (e: { url: string }) => void,
        ) => {
            urlListeners.push(cb)
            return { remove: vi.fn() }
        },
    },
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

vi.mock('../useDeepLink', () => ({
    useDeepLink: () => ({
        handleDeepLink: mockHandleDeepLink,
        isValidDeepLink: () => true,
    }),
}))

import {
    useDeeplinkListener,
    resetDeeplinkListenerStateForTesting,
} from '../useDeeplinkListener'

const OPT_IN_URL = 'perawallet://app/asset-opt-in/?assetId=31566704'

describe('useDeeplinkListener', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        urlListeners.length = 0
        resetDeeplinkListenerStateForTesting()
        mockGetInitialURL.mockResolvedValue(null)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('handles the cold-start launch URL once even when mounted by multiple layouts', async () => {
        vi.useFakeTimers()
        mockGetInitialURL.mockResolvedValue(OPT_IN_URL)

        // Three layouts each mount the listener.
        renderHook(() => useDeeplinkListener())
        renderHook(() => useDeeplinkListener())
        renderHook(() => useDeeplinkListener())

        // Flush the getInitialURL microtasks and the navigation-ready timeout.
        await vi.runAllTimersAsync()

        expect(mockHandleDeepLink).toHaveBeenCalledTimes(1)
        expect(mockHandleDeepLink).toHaveBeenCalledWith(
            OPT_IN_URL,
            false,
            'deeplink',
        )
    })

    it('handles a warm-start URL once even when several listeners receive the same event', () => {
        renderHook(() => useDeeplinkListener())
        renderHook(() => useDeeplinkListener())
        renderHook(() => useDeeplinkListener())

        // The OS delivers the same url event to every registered listener.
        for (const listener of urlListeners) {
            listener({ url: OPT_IN_URL })
        }

        expect(mockHandleDeepLink).toHaveBeenCalledTimes(1)
    })
})
