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
import { useAddAssetView } from '../useAddAssetView'
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

const { mockShowError } = vi.hoisted(() => ({ mockShowError: vi.fn() }))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
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
    SHORT_PROMPT_DISPLAY_DELAY: 300,
    LONG_PROMPT_DISPLAY_DELAY: 600,
}))

const { mockRequestByType } = vi.hoisted(() => ({
    mockRequestByType: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        requestByType: mockRequestByType,
    }),
}))

describe('useAddAssetView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetSelectedAccount.mockReturnValue(mockAccount)
    })

    it('does not show an error toast when user cancels the signing overlay', async () => {
        mockOptIn.mockRejectedValueOnce(new UserRejectedSigningError())
        mockRequestByType.mockResolvedValueOnce('confirm')

        const { result } = renderHook(() => useAddAssetView())

        await act(async () => {
            await result.current.handleRequestAdd('999')
        })

        expect(mockShowError).not.toHaveBeenCalled()
        expect(mockShowToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('shows an error toast when opt-in fails with a non-cancel error', async () => {
        const optInError = new Error('Network error')
        mockOptIn.mockRejectedValueOnce(optInError)
        mockRequestByType.mockResolvedValueOnce('confirm')

        const { result } = renderHook(() => useAddAssetView())

        await act(async () => {
            await result.current.handleRequestAdd('999')
        })

        expect(mockShowError).toHaveBeenCalledWith(
            optInError,
            'add_asset.opt_in.failed_title',
        )
    })

    it('does not call optIn when user dismisses the confirmation sheet', async () => {
        mockRequestByType.mockResolvedValueOnce()

        const { result } = renderHook(() => useAddAssetView())

        await act(async () => {
            await result.current.handleRequestAdd('999')
        })

        expect(mockOptIn).not.toHaveBeenCalled()
    })
})
