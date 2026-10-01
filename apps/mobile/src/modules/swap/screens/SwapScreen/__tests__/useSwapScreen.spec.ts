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
import { useSwapScreen } from '../useSwapScreen'

const { routeParams, mockSetFromAsset, mockSetToAsset } = vi.hoisted(() => ({
    routeParams: { current: undefined as Record<string, string> | undefined },
    mockSetFromAsset: vi.fn(),
    mockSetToAsset: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: routeParams.current }),
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwaps: () => ({
        setFromAsset: mockSetFromAsset,
        setToAsset: mockSetToAsset,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({ address: 'ADDR' }),
    useSigningAccounts: () => [{ address: 'ADDR' }],
    useSelectedAccountAddress: () => ({ setSelectedAccountAddress: vi.fn() }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../useSeedSwapRouteAssets', () => ({
    useSeedSwapRouteAssets: vi.fn(),
}))

describe('useSwapScreen', () => {
    beforeEach(() => {
        routeParams.current = undefined
        vi.clearAllMocks()
    })

    it('hands a resumed amount to the form, tied to the route pay asset', () => {
        routeParams.current = {
            assetInId: '123',
            assetOutId: '31566704',
            payAmount: '2.5',
        }

        const { result } = renderHook(() => useSwapScreen())

        expect(result.current.initialPayAmount).toEqual({
            assetId: '123',
            amount: '2.5',
        })
        expect(mockSetFromAsset).toHaveBeenCalledWith('123')
    })

    it('has no amount to restore for an ordinary visit', () => {
        routeParams.current = { assetInId: '123', assetOutId: '31566704' }

        const { result } = renderHook(() => useSwapScreen())

        expect(result.current.initialPayAmount).toBeUndefined()
    })
})
