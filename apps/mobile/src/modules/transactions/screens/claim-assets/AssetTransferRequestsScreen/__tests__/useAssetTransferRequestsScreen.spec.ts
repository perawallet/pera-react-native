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
import { useAssetInboxRequestsQuery } from '@perawallet/wallet-core-transactions'
import { IntegrityRequiredError } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import { ETHEREUM_CHAIN_ID } from '@test-utils/chain-fixtures'

const ALGORAND_SCOPE = { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' }
const { routeParams } = vi.hoisted(() => ({
    routeParams: {
        current: {} as Record<string, unknown>,
    },
}))

const mockPush = vi.fn()
const mockTokenInboxRequests = vi.fn((_scope: unknown, _address: unknown) => ({
    data: [] as unknown[],
    isPending: false,
}))
const mockSetAccountAddress = vi.fn()
const mockSetAssetRequests = vi.fn()

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetInboxRequestsQuery: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useClaimAssets: () => ({
        accountAddress: undefined,
        setAccountAddress: mockSetAccountAddress,
        setAssetRequests: mockSetAssetRequests,
    }),
    useTokenInboxRequests: (scope: unknown, address: unknown) =>
        mockTokenInboxRequests(scope, address),
}))

vi.mock(
    '@modules/transactions/components/claim-assets/AssetTransferRequestItem',
    () => ({
        AssetTransferRequestItem: () => null,
    }),
)

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ push: mockPush }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: routeParams.current }),
}))

const mockAssetRequests = (
    data: unknown[] | undefined,
    overrides: {
        isPending?: boolean
        isUnavailableOnNetwork?: boolean
        isError?: boolean
        error?: Error
    } = {},
) =>
    vi.mocked(useAssetInboxRequestsQuery).mockReturnValue({
        data,
        isPending: false,
        isError: false,
        error: null,
        isUnavailableOnNetwork: false,
        ...overrides,
    } as unknown as ReturnType<typeof useAssetInboxRequestsQuery>)

describe('useAssetTransferRequestsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        routeParams.current = {
            item: { address: 'ACCOUNT_ADDR' },
            scope: ALGORAND_SCOPE,
        }
        mockAssetRequests([])
    })

    it('returns an empty array when data is undefined', () => {
        mockAssetRequests(undefined)

        const { result } = renderHook(() => useAssetTransferRequestsScreen())

        expect(result.current.assetRequests).toEqual([])
    })

    it("reads the account's requests from the inbox backend on an opt-in chain", () => {
        const { result } = renderHook(() => useAssetTransferRequestsScreen())

        expect(useAssetInboxRequestsQuery).toHaveBeenCalledWith(
            ALGORAND_SCOPE,
            'ACCOUNT_ADDR',
        )
        expect(mockTokenInboxRequests).toHaveBeenCalledWith(
            ALGORAND_SCOPE,
            null,
        )
        expect(result.current.scope).toBe(ALGORAND_SCOPE)
    })

    describe('on a chain that receives tokens unasked', () => {
        const ETHEREUM_SCOPE = {
            chainId: ETHEREUM_CHAIN_ID,
            networkId: 'sepolia',
        }

        beforeEach(() => {
            routeParams.current = {
                item: { address: 'ACCOUNT_ADDR' },
                scope: ETHEREUM_SCOPE,
            }
        })

        it("lists the account's token inbox kept on the device", () => {
            const requests = [{ asset: { assetId: '0x1' } }]
            mockTokenInboxRequests.mockReturnValueOnce({
                data: requests,
                isPending: false,
            })
            mockAssetRequests([], { isUnavailableOnNetwork: true })

            const { result } = renderHook(() =>
                useAssetTransferRequestsScreen(),
            )

            expect(useAssetInboxRequestsQuery).toHaveBeenCalledWith(
                ETHEREUM_SCOPE,
                null,
            )
            expect(result.current.assetRequests).toEqual(requests)
            expect(result.current.isUnavailableOnNetwork).toBe(false)
            expect(result.current.infoBodyKey).toBe(
                'asset_inbox.requests.token_info_body',
            )
        })
    })

    it('forwards isUnavailableOnNetwork from the asset requests query', () => {
        mockAssetRequests([], { isUnavailableOnNetwork: true })

        const { result } = renderHook(() => useAssetTransferRequestsScreen())

        expect(result.current.isUnavailableOnNetwork).toBe(true)
    })

    it('flags a refusal for want of an integrity token', () => {
        mockAssetRequests(undefined, {
            isError: true,
            error: new IntegrityRequiredError({
                code: 'APP_INTEGRITY_TOKEN_REQUIRED',
                status: 403,
                hadToken: false,
            }),
        })

        const { result } = renderHook(() => useAssetTransferRequestsScreen())

        expect(result.current.isIntegrityBlocked).toBe(true)
    })

    it('does not flag any other failure as an integrity refusal', () => {
        mockAssetRequests(undefined, {
            isError: true,
            error: new Error('boom'),
        })

        const { result } = renderHook(() => useAssetTransferRequestsScreen())

        expect(result.current.isIntegrityBlocked).toBe(false)
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
            params: { assetIndex: 1, scope: ALGORAND_SCOPE },
        })
    })
})
