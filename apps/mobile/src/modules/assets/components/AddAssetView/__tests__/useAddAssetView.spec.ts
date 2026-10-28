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
import type { ScopedAssetSearchResult } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useAddAssetView } from '../useAddAssetView'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import {
    IntegrityRequiredError,
    PeraNetworkError,
    PeraServiceUnavailableError,
} from '@perawallet/wallet-core-shared'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import {
    setCapabilityOverrides,
    setChainEnabled,
} from '@test-utils/capability-overrides'

const ALGORAND_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETHEREUM_SCOPE = {
    chainId: 'ethereum' as ChainId,
    networkId: 'mainnet',
} as const

const onAlgorand = (assetId: string): ScopedAssetSearchResult => ({
    scope: ALGORAND_SCOPE,
    asset: { assetId, name: 'Test Asset', unitName: 'TST' },
})
const onEthereum = (assetId: string): ScopedAssetSearchResult => ({
    scope: ETHEREUM_SCOPE,
    asset: { assetId, name: 'Test Token', unitName: 'TTK' },
})
const TEST_ASSET = onAlgorand('999')

const mockAccount = {
    id: 'test-account',
    name: 'Test Account',
    custody: { kind: 'watch' },
    chains: {
        algorand: { address: 'test-address' },
        ethereum: { address: '0xtest' },
    },
}

const { mockGetSelectedAccount } = vi.hoisted(() => ({
    mockGetSelectedAccount: vi.fn((): unknown => mockAccount),
}))

const { mockUseAccountHeldAssetsQuery } = vi.hoisted(() => ({
    mockUseAccountHeldAssetsQuery: vi.fn((_sources: unknown) => ({
        heldAssets: [
            {
                scope: { chainId: 'algorand', networkId: 'mainnet' },
                assetId: '123',
            },
        ],
    })),
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
        // Unlike the real hook, keeps chains that aren't registered: the
        // offered chips must leave those out themselves.
        useAccountHoldingSources: (account: unknown) =>
            account
                ? Object.entries(
                      (
                          account as {
                              chains: Record<string, { address: string }>
                          }
                      ).chains,
                  ).map(([chainId, { address }]) => ({
                      address,
                      scope: { chainId, networkId: 'mainnet' },
                  }))
                : [],
        useAccountHeldAssetsQuery: (sources: unknown) =>
            mockUseAccountHeldAssetsQuery(sources),
    }
})

const { mockUseAssetSearch, defaultSearchResult } = vi.hoisted(() => {
    const defaultSearchResult = {
        results: [] as unknown[],
        isLoading: false,
        isError: false,
        error: null as unknown,
        isPaused: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
        isIncomplete: false,
    }
    return {
        defaultSearchResult,
        mockUseAssetSearch: vi.fn(
            (_query: string, _scopes: unknown, _options?: unknown) =>
                defaultSearchResult,
        ),
    }
})

const mockSearch = (overrides: Partial<typeof defaultSearchResult>): void => {
    mockUseAssetSearch.mockReturnValue({
        ...defaultSearchResult,
        ...overrides,
    })
}

const lastSearchedScopes = (): unknown => mockUseAssetSearch.mock.lastCall?.[1]

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<object>()),
    useAssetSearchAcrossScopesQuery: (
        query: string,
        scopes: unknown,
        options?: unknown,
    ) => mockUseAssetSearch(query, scopes, options),
}))

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

// One `t` across renders, as react-i18next's is, so memoised callbacks that
// depend on it keep their identity.
vi.mock('@hooks/useLanguage', () => {
    const t = (key: string) => key
    return {
        useLanguage: () => ({
            t,
            currentLanguage: 'en',
            changeLanguage: () => undefined,
        }),
    }
})

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

// Settles at once unless a test holds back the value the search last saw.
const { debounced } = vi.hoisted(() => ({
    debounced: { heldValue: undefined as unknown },
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    useDebouncedValue: <T>(value: T): T =>
        debounced.heldValue === undefined ? value : (debounced.heldValue as T),
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
        mockUseAssetSearch.mockReturnValue(defaultSearchResult)
        mockGetSelectedAccount.mockReturnValue(mockAccount)
        setHasInternet(true)
    })

    afterEach(() => {
        setHasInternet(true)
        act(() => useRemoteConfigStore.getState().resetState())
        restoreAlgorandOnlyChains()
    })

    it('does not show an error toast when user cancels the signing overlay', async () => {
        mockOptIn.mockRejectedValueOnce(new UserRejectedSigningError())
        mockRequestByType.mockResolvedValueOnce('confirm')

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        await act(async () => {
            await result.current.handleRequestAdd(TEST_ASSET)
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

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        await act(async () => {
            await result.current.handleRequestAdd(TEST_ASSET)
        })

        expect(mockShowError).toHaveBeenCalledWith(
            optInError,
            'add_asset.opt_in.failed_title',
        )
    })

    it('keeps handleRequestAdd across renders, so the list rows aren’t rebuilt', () => {
        const { result, rerender } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )
        const first = result.current.handleRequestAdd

        rerender()

        expect(result.current.handleRequestAdd).toBe(first)
    })

    it('does not call optIn when user dismisses the confirmation sheet', async () => {
        mockRequestByType.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        await act(async () => {
            await result.current.handleRequestAdd(TEST_ASSET)
        })

        expect(mockOptIn).not.toHaveBeenCalled()
    })

    it('confirms the opt-in on the chain it was opened for', async () => {
        mockRequestByType.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        await act(async () => {
            await result.current.handleRequestAdd(TEST_ASSET)
        })

        expect(mockRequestByType).toHaveBeenCalledWith(
            'asset-opt-in',
            {
                assetId: '999',
                accountAddress: 'test-address',
                scope: expect.objectContaining({ chainId: 'algorand' }),
            },
            expect.anything(),
        )
    })

    it('shows a held asset as added on its own chain only', () => {
        registerEthereumChain()

        const { result } = renderHook(() => useAddAssetView({ chainId: null }))

        expect(result.current.isOptedIn(onAlgorand('123'))).toBe(true)
        expect(result.current.isOptedIn(onEthereum('123'))).toBe(false)
        expect(result.current.isOptedIn(onAlgorand('999'))).toBe(false)
    })

    it('reads held assets on every chain the account is on, whichever chip is picked', () => {
        registerEthereumChain()
        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        act(() => result.current.handleSelectChain('ethereum'))

        expect(mockUseAccountHeldAssetsQuery).toHaveBeenLastCalledWith([
            { address: 'test-address', scope: ALGORAND_SCOPE },
            { address: '0xtest', scope: ETHEREUM_SCOPE },
        ])
    })

    describe('while the query debounces', () => {
        afterEach(() => {
            debounced.heldValue = undefined
        })

        it('is loading until a typed query is searched', () => {
            debounced.heldValue = ''
            const { result, rerender } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            act(() => result.current.handleSearchChange('usd'))
            expect(result.current.isLoading).toBe(true)

            debounced.heldValue = undefined
            rerender()
            expect(result.current.isLoading).toBe(false)
        })

        it('is not loading while a cleared query debounces', () => {
            debounced.heldValue = 'usd'
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            act(() => result.current.handleSearchChange(''))

            expect(result.current.isLoading).toBe(false)
        })
    })

    it("says when a chain's results are missing because its search failed", () => {
        mockSearch({ isIncomplete: true, results: [onAlgorand('1')] })

        const { result } = renderHook(() => useAddAssetView({ chainId: null }))

        expect(result.current.isIncomplete).toBe(true)
        expect(result.current.isError).toBe(false)
    })

    it('surfaces the search error', () => {
        mockSearch({ isError: true })

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        expect(result.current.isError).toBe(true)
    })

    it.each([
        ['an integrity refusal', true],
        ['any other failure', false],
    ])('flags the integrity arm for %s', (_case, isRefusal) => {
        mockSearch({
            isError: true,
            error: isRefusal
                ? new IntegrityRequiredError({
                      code: 'APP_INTEGRITY_TOKEN_REQUIRED',
                      status: 403,
                      hadToken: false,
                  })
                : new Error('boom'),
        })

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        expect(result.current.isIntegrityBlocked).toBe(isRefusal)
    })

    it.each([
        [
            'a chain the backend has not switched on',
            new PeraNetworkError('client', {
                status: 422,
                backendCode: 'chain_not_enabled',
            }),
            true,
        ],
        [
            'a network with no Pera services',
            new PeraServiceUnavailableError(ETHEREUM_SCOPE, 'assets'),
            true,
        ],
        ['any other failure', new Error('boom'), false],
    ])('shows the unavailable state for %s', (_case, error, isRefusal) => {
        mockSearch({ isError: true, error })

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        expect(result.current.isUnavailable).toBe(isRefusal)
        expect(result.current.unavailableBody).toBe(
            isRefusal ? 'common.network_unavailable.generic_body' : undefined,
        )
    })

    it('is offline when the search query is paused (true-offline regime)', () => {
        mockSearch({ isPaused: true })

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        expect(result.current.isOffline).toBe(true)
    })

    it('collapses search error to offline when device has no internet', () => {
        setHasInternet(false)
        mockSearch({ isError: true })

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        expect(result.current.isOffline).toBe(true)
    })

    it('is unavailable, not failed or offline, when no chain can search assets', () => {
        act(() => setCapabilityOverrides({ assetSearch: false }))

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        expect(result.current.isUnavailable).toBe(true)
        expect(result.current.unavailableBody).toBeUndefined()
        expect(result.current.isError).toBe(false)
        expect(result.current.isOffline).toBe(false)
        expect(lastSearchedScopes()).toEqual([])
    })

    describe('network chips', () => {
        it('offers no chips while only one chain is registered', () => {
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: null }),
            )

            expect(result.current.chainOptions).toEqual([])
            expect(result.current.selectedChainId).toBe('algorand')
            expect(result.current.showsNetwork).toBe(false)
        })

        it("offers only the account's chains, so an Algorand-only account gets no chips", () => {
            registerEthereumChain()
            mockGetSelectedAccount.mockReturnValue({
                ...mockAccount,
                chains: { algorand: { address: 'test-address' } },
            })

            const { result } = renderHook(() =>
                useAddAssetView({ chainId: null }),
            )

            expect(result.current.chainOptions).toEqual([])
            expect(result.current.selectedChainId).toBe('algorand')
            expect(lastSearchedScopes()).toEqual([ALGORAND_SCOPE])
        })

        it('offers All, then one chip per account chain that can search assets, in registry order', () => {
            registerEthereumChain()

            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            expect(
                result.current.chainOptions.map(({ value, label, testID }) => ({
                    value,
                    label,
                    testID,
                })),
            ).toEqual([
                {
                    value: null,
                    label: 'account_details.assets.network_filter_all',
                    testID: 'add_asset_network_filter_all',
                },
                {
                    value: 'algorand',
                    label: 'Algorand',
                    testID: 'add_asset_network_filter_algorand',
                },
                {
                    value: 'ethereum',
                    label: 'Ethereum',
                    testID: 'add_asset_network_filter_ethereum',
                },
            ])
        })

        it('offers no chip for a chain that cannot search assets', () => {
            registerEthereumChain()
            act(() =>
                setCapabilityOverrides({ assetSearch: false }, 'ethereum'),
            )

            const { result } = renderHook(() =>
                useAddAssetView({ chainId: null }),
            )

            expect(result.current.chainOptions).toEqual([])
            expect(result.current.selectedChainId).toBe('algorand')
        })

        it.each([
            ['All', null, [ALGORAND_SCOPE, ETHEREUM_SCOPE]],
            ['Ethereum', 'ethereum', [ETHEREUM_SCOPE]],
        ] as const)(
            'opens on the %s chip it was given and searches there',
            (_chip, chainId, scopes) => {
                registerEthereumChain()

                const { result } = renderHook(() =>
                    useAddAssetView({ chainId }),
                )

                expect(result.current.selectedChainId).toBe(chainId)
                expect(lastSearchedScopes()).toEqual(scopes)
            },
        )

        it('searches on the picked chip, and on every chain under All', () => {
            registerEthereumChain()
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )
            expect(lastSearchedScopes()).toEqual([ALGORAND_SCOPE])

            act(() => result.current.handleSelectChain('ethereum'))
            expect(result.current.selectedChainId).toBe('ethereum')
            expect(lastSearchedScopes()).toEqual([ETHEREUM_SCOPE])

            act(() => result.current.handleSelectChain(null))
            expect(result.current.selectedChainId).toBeNull()
            expect(lastSearchedScopes()).toEqual([
                ALGORAND_SCOPE,
                ETHEREUM_SCOPE,
            ])
        })

        it('names each row’s network only while the results span chains', () => {
            registerEthereumChain()
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: null }),
            )
            expect(result.current.showsNetwork).toBe(true)

            act(() => result.current.handleSelectChain('algorand'))

            expect(result.current.showsNetwork).toBe(false)
        })

        it('leaves a switched-off chain out and opens on the first offered chain instead', () => {
            registerEthereumChain()
            act(() => setChainEnabled('algorand', false))

            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            expect(result.current.chainOptions).toEqual([])
            expect(result.current.selectedChainId).toBe('ethereum')
        })

        it('offers adding only on a chain that can manage assets, under All too', () => {
            registerEthereumChain()
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: null }),
            )
            expect(result.current.canAdd(onAlgorand('999'))).toBe(true)
            expect(result.current.canAdd(onEthereum('0xToken'))).toBe(false)

            act(() => result.current.handleSelectChain('ethereum'))

            expect(result.current.canAdd(onEthereum('0xToken'))).toBe(false)
        })

        it('shows an asset as added only on the chain it was added on', async () => {
            registerEthereumChain()
            mockRequestByType.mockResolvedValueOnce('confirm')
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: null }),
            )

            await act(async () => {
                await result.current.handleRequestAdd(onAlgorand('999'))
            })

            expect(result.current.isOptedIn(onAlgorand('999'))).toBe(true)
            expect(result.current.isOptedIn(onEthereum('999'))).toBe(false)
        })

        it('adds nothing on a chain that cannot manage assets', async () => {
            act(() => setCapabilityOverrides({ manageAssets: false }))
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            await act(async () => {
                await result.current.handleRequestAdd(TEST_ASSET)
            })

            expect(mockRequestByType).not.toHaveBeenCalled()
        })

        it('keeps the NFT sheet to chains that can add, with no All, and searches for NFTs', () => {
            registerEthereumChain()

            const { result } = renderHook(() =>
                useAddAssetView({ variant: 'collectible', chainId: null }),
            )

            expect(result.current.chainOptions).toEqual([])
            expect(result.current.selectedChainId).toBe('algorand')
            expect(mockUseAssetSearch).toHaveBeenLastCalledWith(
                '',
                [ALGORAND_SCOPE],
                { hasCollectible: true },
            )
        })
    })
})
