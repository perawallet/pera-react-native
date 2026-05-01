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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useAccountAssetList } from '../useAccountAssetList'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockAccount = {
    address: 'test-address',
    name: 'Test Account',
} as WalletAccount

const mockT = (key: string) => key

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: vi.fn() }),
}))

vi.mock('@react-navigation/native-stack', () => ({}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountBalancesQuery: vi.fn(() => ({
            accountBalances: new Map([
                [
                    'test-address',
                    {
                        assetBalances: [
                            {
                                assetId: '123',
                                amount: new Decimal(0),
                                algoValue: new Decimal(0),
                            },
                        ],
                    },
                ],
            ]),
            isPending: false,
        })),
        useAccountLogicalType: vi.fn(() => 'Algo25'),
        isSigningLogicalType: vi.fn(() => true),
        useSortedAssetBalances: vi.fn(() => ({
            sortedBalances: [],
            assetSortMode: 'balanceDesc',
        })),
    }
})

const { mockOptOut } = vi.hoisted(() => ({
    mockOptOut: vi.fn().mockResolvedValue({ txIds: ['tx1'] }),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptOutMutation: () => ({
        optOut: mockOptOut,
        isLoading: false,
    }),
}))

const { mockShowToast, mockShowError } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockShowError: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useAssetsQuery: vi.fn(() => ({ data: new Map() })),
        useAssetPricesQuery: vi.fn(() => ({ data: new Map() })),
        useAssetPreferencesStore: vi.fn(
            (selector: (state: unknown) => unknown) =>
                selector({
                    hideZeroBalance: false,
                    displayNfts: true,
                    displayOptedInNfts: true,
                }),
        ),
        isCollectible: vi.fn(() => false),
    }
})

vi.mock('@perawallet/wallet-core-search', () => ({
    useGlobalSearch: vi.fn(() => ({
        value: '',
        setValue: vi.fn(),
        results: { assets: [] },
        isLoading: false,
    })),
}))

vi.mock('@constants/ui', () => ({
    SEARCH_DEBOUNCE_TIME_SHORT: 150,
}))

describe('useAccountAssetList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not show an error toast when user cancels the signing overlay', async () => {
        mockOptOut.mockRejectedValueOnce(new UserRejectedSigningError())

        const { result } = renderHook(() =>
            useAccountAssetList({ account: mockAccount, t: mockT }),
        )

        // Set up an asset for opt-out and confirm
        act(() => {
            result.current.handleOptOut({
                assetId: '123',
                amount: new Decimal(0),
                algoValue: new Decimal(0),
            })
        })

        await act(async () => {
            await result.current.handleConfirmOptOut()
        })

        expect(mockShowError).not.toHaveBeenCalled()
    })

    it('shows an error toast when opt-out fails with a non-cancel error', async () => {
        const optOutError = new Error('Network error')
        mockOptOut.mockRejectedValueOnce(optOutError)

        const { result } = renderHook(() =>
            useAccountAssetList({ account: mockAccount, t: mockT }),
        )

        act(() => {
            result.current.handleOptOut({
                assetId: '123',
                amount: new Decimal(0),
                algoValue: new Decimal(0),
            })
        })

        await act(async () => {
            await result.current.handleConfirmOptOut()
        })

        expect(mockShowError).toHaveBeenCalledWith(
            optOutError,
            'asset_opt_out.error',
        )
    })
})
