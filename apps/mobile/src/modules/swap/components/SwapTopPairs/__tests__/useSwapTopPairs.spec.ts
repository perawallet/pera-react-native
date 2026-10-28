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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TopPairItem } from '@perawallet/wallet-core-swaps'
import { useSwapTopPairs } from '../useSwapTopPairs'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const { mockTopPairsQuery, mockIsRestricted } = vi.hoisted(() => ({
    mockTopPairsQuery: vi.fn(),
    mockIsRestricted: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    RemoteConfigKeys: {
        crypto_promotion_restricted_countries:
            'crypto_promotion_restricted_countries',
    },
    useIsDeviceCountryRestricted: mockIsRestricted,
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwaps: () => ({ setFromAsset: vi.fn(), setToAsset: vi.fn() }),
    useTopPairsQuery: mockTopPairsQuery,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => ({ analytics: { logEvent: vi.fn() } }),
}))

const PAIR = {
    assetA: { assetId: 0, unitName: 'ALGO' },
    assetB: { assetId: 31_566_704, unitName: 'USDC' },
} as unknown as TopPairItem

describe('useSwapTopPairs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsRestricted.mockReturnValue(false)
        mockTopPairsQuery.mockReturnValue({
            data: [PAIR],
            isLoading: false,
            isError: false,
        })
    })

    it('fetches and returns top pairs outside the promotion-restricted countries', () => {
        const { result } = renderHook(() => useSwapTopPairs(SCOPE))

        expect(mockIsRestricted).toHaveBeenCalledWith(
            'crypto_promotion_restricted_countries',
        )
        expect(mockTopPairsQuery).toHaveBeenCalledWith(SCOPE, 5, true)
        expect(result.current.pairs).toEqual([PAIR])
    })

    it('skips the fetch and hides cached pairs in a restricted country', () => {
        mockIsRestricted.mockReturnValue(true)

        const { result } = renderHook(() => useSwapTopPairs(SCOPE))

        expect(mockTopPairsQuery).toHaveBeenCalledWith(SCOPE, 5, false)
        expect(result.current.pairs).toEqual([])
    })
})
