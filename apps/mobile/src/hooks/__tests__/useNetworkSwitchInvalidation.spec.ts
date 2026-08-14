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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { mockInvalidateQueries, mockGetSyncService, networkState } = vi.hoisted(
    () => ({
        mockInvalidateQueries: vi.fn(),
        mockGetSyncService: vi.fn(),
        networkState: { network: 'mainnet' },
    }),
)

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: mockGetSyncService,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: networkState.network }),
}))

import { useNetworkSwitchInvalidation } from '../useNetworkSwitchInvalidation'

describe('useNetworkSwitchInvalidation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        networkState.network = 'mainnet'
        mockGetSyncService.mockReturnValue({
            invalidateQueries: mockInvalidateQueries,
        })
    })

    it('does not invalidate on first mount (cold start)', () => {
        renderHook(() => useNetworkSwitchInvalidation())

        expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })

    it('invalidates exactly once when the network changes', () => {
        const { rerender } = renderHook(() => useNetworkSwitchInvalidation())

        networkState.network = 'testnet'
        rerender()

        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)

        // Unrelated re-renders on the new network don't re-fire.
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
    })

    it('swallows an uninitialized sync service', () => {
        mockGetSyncService.mockImplementation(() => {
            throw new Error('not initialized')
        })
        const { rerender } = renderHook(() => useNetworkSwitchInvalidation())

        networkState.network = 'testnet'

        expect(() => rerender()).not.toThrow()
    })
})
