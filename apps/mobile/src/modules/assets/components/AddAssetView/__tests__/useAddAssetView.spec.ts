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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

const { mockUseGlobalSearch, defaultGlobalSearchResult } = vi.hoisted(() => {
    const defaultGlobalSearchResult = {
        value: '',
        setValue: vi.fn(),
        results: {
            remoteAssets: [
                { assetId: '999', name: 'Test Asset', unitName: 'TST' },
            ],
        },
        isLoading: false,
        isRemoteError: false,
        isRemotePaused: false,
        isRemoteUnavailableOnNetwork: false,
        hasNextRemotePage: false,
        isFetchingNextRemotePage: false,
        fetchNextRemotePage: vi.fn(),
    }
    return {
        defaultGlobalSearchResult,
        mockUseGlobalSearch: vi.fn(() => defaultGlobalSearchResult),
    }
})

const mockGlobalSearch = (
    overrides: Partial<typeof defaultGlobalSearchResult>,
): void => {
    mockUseGlobalSearch.mockReturnValueOnce({
        ...defaultGlobalSearchResult,
        ...overrides,
    })
}

vi.mock('@perawallet/wallet-core-search', () => ({
    useGlobalSearch: () => mockUseGlobalSearch(),
}))

let hasInternetMock = true
const setHasInternet = (hasInternet: boolean): void => {
    hasInternetMock = hasInternet
}

vi.mock('@modules/network', () => ({
    useNetworkStatus: () => ({ hasInternet: hasInternetMock }),
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
        setHasInternet(true)
    })

    afterEach(() => {
        setHasInternet(true)
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
        mockRequestByType.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useAddAssetView())

        await act(async () => {
            await result.current.handleRequestAdd('999')
        })

        expect(mockOptIn).not.toHaveBeenCalled()
    })

    it('surfaces the remote search error instead of hardcoding isError false', () => {
        mockGlobalSearch({ isRemoteError: true, isRemotePaused: false })

        const { result } = renderHook(() => useAddAssetView())

        expect(result.current.isError).toBe(true)
    })

    it('is offline when the search query is paused (true-offline regime)', () => {
        mockGlobalSearch({ isRemoteError: false, isRemotePaused: true })

        const { result } = renderHook(() => useAddAssetView())

        expect(result.current.isOffline).toBe(true)
    })

    it('is unavailable when the network has no Pera backend', () => {
        mockGlobalSearch({ isRemoteUnavailableOnNetwork: true })

        const { result } = renderHook(() => useAddAssetView())

        expect(result.current.isUnavailable).toBe(true)
    })

    it('does not report unavailable as an error or as offline', () => {
        mockGlobalSearch({ isRemoteUnavailableOnNetwork: true })

        const { result } = renderHook(() => useAddAssetView())

        expect(result.current.isError).toBe(false)
        expect(result.current.isOffline).toBe(false)
    })

    it('collapses search error to offline when device has no internet', () => {
        setHasInternet(false)
        mockGlobalSearch({ isRemoteError: true, isRemotePaused: false })

        const { result } = renderHook(() => useAddAssetView())

        expect(result.current.isOffline).toBe(true)
    })
})
