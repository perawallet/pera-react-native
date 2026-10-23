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
import { IntegrityRequiredError } from '@perawallet/wallet-core-shared'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import {
    setCapabilityOverrides,
    setChainEnabled,
} from '@test-utils/capability-overrides'

const mockAccount = {
    id: 'test-account',
    name: 'Test Account',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'test-address' } },
}

const { mockGetSelectedAccount, mockEnableChain, mockEligibleChains } =
    vi.hoisted(() => ({
        mockGetSelectedAccount: vi.fn((): unknown => mockAccount),
        mockEnableChain: vi.fn(),
        mockEligibleChains: vi.fn((): string[] => ['algorand']),
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
        useEnableChain: () => mockEnableChain,
        eligibleChainsInFamily: mockEligibleChains,
        useAccountBalancesQuery: vi.fn(() => ({
            accountBalances: new Map([
                [
                    'test-address',
                    {
                        assetBalances: [
                            {
                                assetId: '123',
                                amount: new Decimal(1),
                                nativeValue: new Decimal(1),
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

vi.mock('@hooks/useLanguage')

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
        remoteError: null as unknown,
        isRemotePaused: false,
        isRemoteUnavailableOnNetwork: false,
        hasNextRemotePage: false,
        isFetchingNextRemotePage: false,
        fetchNextRemotePage: vi.fn(),
    }
    return {
        defaultGlobalSearchResult,
        mockUseGlobalSearch: vi.fn(
            (_scope?: unknown) => defaultGlobalSearchResult,
        ),
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
    useGlobalSearch: (scope: unknown) => mockUseGlobalSearch(scope),
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

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

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

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        await act(async () => {
            await result.current.handleRequestAdd('999')
        })

        expect(mockShowError).toHaveBeenCalledWith(
            optInError,
            'add_asset.opt_in.failed_title',
        )
    })

    describe('on an account not yet on the chain', () => {
        const ethereumOnly = {
            id: 'eth-account',
            custody: { kind: 'local', seed: null },
            chains: { ethereum: { address: '0xabc', keyPairId: 'k' } },
        }

        beforeEach(() => {
            mockGetSelectedAccount.mockReturnValue(ethereumOnly)
        })

        it('enables the chain, then opts in from the address it gets there', async () => {
            mockEligibleChains.mockReturnValue(['ethereum', 'algorand'])
            mockEnableChain.mockResolvedValue({
                ...ethereumOnly,
                chains: {
                    ...ethereumOnly.chains,
                    algorand: { address: 'NEW-ADDR', keyPairId: 'k' },
                },
            })
            mockRequestByType.mockResolvedValueOnce('confirm')
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            await act(async () => {
                await result.current.handleRequestAdd('999')
            })

            expect(mockEnableChain).toHaveBeenCalledWith(
                'eth-account',
                'algorand',
                'user',
            )
            expect(mockRequestByType).toHaveBeenCalledWith(
                'asset-opt-in',
                {
                    assetId: '999',
                    accountAddress: 'NEW-ADDR',
                    scope: expect.objectContaining({ chainId: 'algorand' }),
                },
                expect.anything(),
            )
            expect(mockOptIn).toHaveBeenCalledWith({
                sender: 'NEW-ADDR',
                assetId: 999n,
            })
        })

        it('adds nothing when the account cannot be on the chain', async () => {
            mockEligibleChains.mockReturnValue(['ethereum'])
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            await act(async () => {
                await result.current.handleRequestAdd('999')
            })

            expect(mockEnableChain).not.toHaveBeenCalled()
            expect(mockRequestByType).not.toHaveBeenCalled()
        })

        it('leaves a hardware account alone, since a new chain needs its device', async () => {
            mockEligibleChains.mockReturnValue(['ethereum', 'algorand'])
            mockGetSelectedAccount.mockReturnValue({
                ...ethereumOnly,
                custody: {
                    kind: 'hardware',
                    device: { deviceId: 'd' },
                    accountIndex: 0,
                },
            })
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            await act(async () => {
                await result.current.handleRequestAdd('999')
            })

            expect(mockEnableChain).not.toHaveBeenCalled()
            expect(mockShowError).not.toHaveBeenCalled()
        })

        it('shows why when the chain cannot be enabled', async () => {
            mockEligibleChains.mockReturnValue(['ethereum', 'algorand'])
            const failure = new Error('derivation failed')
            mockEnableChain.mockRejectedValue(failure)
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            await act(async () => {
                await result.current.handleRequestAdd('999')
            })

            expect(mockShowError).toHaveBeenCalledWith(
                failure,
                'add_asset.opt_in.failed_title',
            )
            expect(mockRequestByType).not.toHaveBeenCalled()
        })
    })

    it('does not call optIn when user dismisses the confirmation sheet', async () => {
        mockRequestByType.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        await act(async () => {
            await result.current.handleRequestAdd('999')
        })

        expect(mockOptIn).not.toHaveBeenCalled()
    })

    it('confirms the opt-in on the chain it was opened for', async () => {
        mockRequestByType.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        await act(async () => {
            await result.current.handleRequestAdd('999')
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

    it('surfaces the remote search error instead of hardcoding isError false', () => {
        mockGlobalSearch({ isRemoteError: true, isRemotePaused: false })

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        expect(result.current.isError).toBe(true)
    })

    it.each([
        ['an integrity refusal', true],
        ['any other failure', false],
    ])('flags the integrity arm for %s', (_case, isRefusal) => {
        mockGlobalSearch({
            isRemoteError: true,
            isRemotePaused: false,
            remoteError: isRefusal
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

    it('is offline when the search query is paused (true-offline regime)', () => {
        mockGlobalSearch({ isRemoteError: false, isRemotePaused: true })

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        expect(result.current.isOffline).toBe(true)
    })

    it('is unavailable when the network has no Pera backend', () => {
        mockGlobalSearch({ isRemoteUnavailableOnNetwork: true })

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        expect(result.current.isUnavailable).toBe(true)
    })

    it('does not report unavailable as an error or as offline', () => {
        mockGlobalSearch({ isRemoteUnavailableOnNetwork: true })

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        expect(result.current.isError).toBe(false)
        expect(result.current.isOffline).toBe(false)
    })

    describe('network chips', () => {
        afterEach(() => {
            act(() => useRemoteConfigStore.getState().resetState())
            restoreAlgorandOnlyChains()
        })

        // Ethereum ships without asset search; tests that need a second chip
        // switch it on, as the Feature Flags screen would.
        const registerSearchableEthereum = () => {
            registerEthereumChain()
            act(() => setCapabilityOverrides({ assetSearch: true }, 'ethereum'))
        }

        it('offers no chips while only one chain is registered', () => {
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            expect(result.current.chainOptions).toEqual([])
            expect(result.current.selectedChainId).toBe('algorand')
        })

        it('offers no chip for a chain that cannot search assets', () => {
            registerEthereumChain()

            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            expect(result.current.chainOptions).toEqual([])
            expect(result.current.selectedChainId).toBe('algorand')
        })

        it('offers one chip per chain that can search assets, in registry order', () => {
            registerSearchableEthereum()

            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            expect(result.current.chainOptions).toEqual([
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

        it('searches on the picked chain', () => {
            registerSearchableEthereum()
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )
            expect(mockUseGlobalSearch).toHaveBeenLastCalledWith(
                expect.objectContaining({ chainId: 'algorand' }),
            )

            act(() => result.current.handleSelectChain('ethereum'))

            expect(result.current.selectedChainId).toBe('ethereum')
            expect(mockUseGlobalSearch).toHaveBeenLastCalledWith(
                expect.objectContaining({ chainId: 'ethereum' }),
            )
        })

        it('leaves a switched-off chain out and opens on the first offered chain instead', () => {
            registerSearchableEthereum()
            act(() => setChainEnabled('algorand', false))

            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            expect(result.current.chainOptions).toEqual([])
            expect(result.current.selectedChainId).toBe('ethereum')
        })

        it('offers adding only on a chain that can manage assets', () => {
            registerSearchableEthereum()
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )
            expect(result.current.canManageAssets).toBe(true)

            act(() => result.current.handleSelectChain('ethereum'))

            expect(result.current.canManageAssets).toBe(false)
        })

        it('shows an asset as added only on the chain it was added on', async () => {
            registerSearchableEthereum()
            mockRequestByType.mockResolvedValueOnce('confirm')
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            await act(async () => {
                await result.current.handleRequestAdd('999')
            })
            expect(result.current.optedInAssetIds.has('999')).toBe(true)

            act(() => result.current.handleSelectChain('ethereum'))
            expect(result.current.optedInAssetIds.has('999')).toBe(false)

            act(() => result.current.handleSelectChain('algorand'))
            expect(result.current.optedInAssetIds.has('999')).toBe(true)
        })

        it('adds nothing on a chain that cannot manage assets', async () => {
            act(() => setCapabilityOverrides({ manageAssets: false }))
            const { result } = renderHook(() =>
                useAddAssetView({ chainId: 'algorand' }),
            )

            await act(async () => {
                await result.current.handleRequestAdd('999')
            })

            expect(mockEnableChain).not.toHaveBeenCalled()
            expect(mockRequestByType).not.toHaveBeenCalled()
        })
    })

    it('collapses search error to offline when device has no internet', () => {
        setHasInternet(false)
        mockGlobalSearch({ isRemoteError: true, isRemotePaused: false })

        const { result } = renderHook(() =>
            useAddAssetView({ chainId: 'algorand' }),
        )

        expect(result.current.isOffline).toBe(true)
    })
})
