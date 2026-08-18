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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRemoteConfig } from '@perawallet/wallet-core-remote-config'
import { useIsGiftCardsEnabled } from '../useIsGiftCardsEnabled'

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: vi.fn(),
    RemoteConfigKeys: { enable_gift_cards: 'enable_gift_cards' },
}))

const { mockRouteCapabilities } = vi.hoisted(() => ({
    mockRouteCapabilities: { giftCards: true },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockRouteCapabilities,
}))

describe('useIsGiftCardsEnabled', () => {
    const mockGetBooleanValue = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteCapabilities.giftCards = true
        ;(useRemoteConfig as Mock).mockReturnValue({
            getBooleanValue: mockGetBooleanValue,
        })
    })

    it('queries the enable_gift_cards flag with a hidden fallback', () => {
        mockGetBooleanValue.mockReturnValue(true)

        renderHook(() => useIsGiftCardsEnabled())

        expect(mockGetBooleanValue).toHaveBeenCalledWith(
            'enable_gift_cards',
            false,
        )
    })

    it('returns the remote value when set', () => {
        mockGetBooleanValue.mockReturnValue(true)
        const { result } = renderHook(() => useIsGiftCardsEnabled())
        expect(result.current).toBe(true)

        mockGetBooleanValue.mockReturnValue(false)
        const { result: result2 } = renderHook(() => useIsGiftCardsEnabled())
        expect(result2.current).toBe(false)
    })

    it('stays disabled when routeCapabilities.giftCards is off, even if the remote flag is on', () => {
        mockGetBooleanValue.mockReturnValue(true)
        mockRouteCapabilities.giftCards = false

        const { result } = renderHook(() => useIsGiftCardsEnabled())

        expect(result.current).toBe(false)
    })
})
