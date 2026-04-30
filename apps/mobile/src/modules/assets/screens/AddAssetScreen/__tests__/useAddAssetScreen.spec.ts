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
import { useAddAssetScreen } from '../useAddAssetScreen'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'

const mockAccount = { address: 'test-address', name: 'Test Account' }

const { mockGetSelectedAccount } = vi.hoisted(() => ({
    mockGetSelectedAccount: vi.fn(() => mockAccount),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountsStore: vi.fn((selector: (state: unknown) => unknown) =>
            selector({ getSelectedAccount: mockGetSelectedAccount }),
        ),
        useAccountBalancesQuery: vi.fn(() => ({
            accountBalances: new Map([
                [
                    'test-address',
                    {
                        assetBalances: [
                            {
                                assetId: '123',
                                amount: new Decimal(1),
                                algoValue: new Decimal(1),
                            },
                        ],
                    },
                ],
            ]),
        })),
    }
})

const { mockOptIn } = vi.hoisted(() => ({
    mockOptIn: vi.fn().mockResolvedValue({ txIds: ['tx1'] }),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptInMutation: () => ({
        optIn: mockOptIn,
        isLoading: false,
    }),
}))

const { mockShowToast } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useAlgodErrorMessage', () => ({
    useAlgodErrorMessage: () => ({
        getMessage: (_err: unknown) => ({ title: 'Error', body: 'error body' }),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@perawallet/wallet-core-search', () => ({
    useGlobalSearch: vi.fn(() => ({
        value: '',
        setValue: vi.fn(),
        results: {
            remoteAssets: [
                { assetId: '999', name: 'Test Asset', unitName: 'TST' },
            ],
        },
        isLoading: false,
        hasNextRemotePage: false,
        isFetchingNextRemotePage: false,
        fetchNextRemotePage: vi.fn(),
    })),
}))

vi.mock('@constants/ui', () => ({
    SEARCH_DEBOUNCE_TIME: 300,
}))

describe('useAddAssetScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetSelectedAccount.mockReturnValue(mockAccount)
    })

    it('does not show an error toast when user cancels the signing overlay', async () => {
        mockOptIn.mockRejectedValueOnce(new UserRejectedSigningError())

        const { result } = renderHook(() => useAddAssetScreen())

        // Request and confirm opt-in for an asset
        act(() => {
            result.current.handleRequestAdd('999')
        })

        await act(async () => {
            await result.current.handleConfirmAdd()
        })

        expect(mockShowToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('shows an error toast when opt-in fails with a non-cancel error', async () => {
        mockOptIn.mockRejectedValueOnce(new Error('Network error'))

        const { result } = renderHook(() => useAddAssetScreen())

        act(() => {
            result.current.handleRequestAdd('999')
        })

        await act(async () => {
            await result.current.handleConfirmAdd()
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })
})
