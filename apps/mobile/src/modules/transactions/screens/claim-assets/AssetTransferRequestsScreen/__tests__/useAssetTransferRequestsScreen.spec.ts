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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAssetTransferRequestsScreen } from '../useAssetTransferRequestsScreen'
import { useArc59AssetRequestsQuery } from '@perawallet/wallet-core-asa-inbox'

const mockPush = vi.fn()
const mockSetAccountAddress = vi.fn()
const mockSetAssetRequests = vi.fn()

vi.mock('@perawallet/wallet-core-asa-inbox', () => ({
    useArc59AssetRequestsQuery: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useClaimAssets: () => ({
        accountAddress: 'ACCOUNT_ADDR',
        setAccountAddress: mockSetAccountAddress,
        setAssetRequests: mockSetAssetRequests,
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ push: mockPush }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: { item: { address: 'ACCOUNT_ADDR' } },
    }),
}))

const mockAssetRequests = (
    data: unknown[] | undefined,
    overrides: { isPending?: boolean; isUnavailableOnNetwork?: boolean } = {},
) =>
    vi.mocked(useArc59AssetRequestsQuery).mockReturnValue({
        data,
        isPending: false,
        isError: false,
        error: null,
        isUnavailableOnNetwork: false,
        ...overrides,
    } as unknown as ReturnType<typeof useArc59AssetRequestsQuery>)

describe('useAssetTransferRequestsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAssetRequests([])
    })

    it('returns an empty array when data is undefined', () => {
        mockAssetRequests(undefined)

        const { result } = renderHook(() => useAssetTransferRequestsScreen())

        expect(result.current.assetRequests).toEqual([])
    })

    it('forwards isUnavailableOnNetwork from the asset requests query', () => {
        mockAssetRequests([], { isUnavailableOnNetwork: true })

        const { result } = renderHook(() => useAssetTransferRequestsScreen())

        expect(result.current.isUnavailableOnNetwork).toBe(true)
    })

    it('pushes to AssetClaimDetail with the pressed index on item press', () => {
        const requests = [{ id: '1' }, { id: '2' }]
        mockAssetRequests(requests)

        const { result } = renderHook(() => useAssetTransferRequestsScreen())

        act(() => {
            result.current.handleItemPress(1)
        })

        expect(mockSetAssetRequests).toHaveBeenCalledWith(requests)
        expect(mockPush).toHaveBeenCalledWith('Messages', {
            screen: 'AssetClaimDetail',
            params: { assetIndex: 1 },
        })
    })
})
