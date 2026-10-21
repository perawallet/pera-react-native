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

import { renderHook, act, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AnalyticsMetadataKey, OnboardingEvent } from '@analytics'
import { useWatchAccountScreen } from '../useWatchAccountScreen'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { useNfdSearchQuery } from '@perawallet/wallet-core-nfd'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    FIXTURE_CHAIN_ID,
    fixtureCodec,
} from '@packages/chain-contract/src/__tests__/testing'
import {
    registerAlgorandAccountsAdapter,
    registerAlgorandAddressCodec,
} from '@test-utils/algorandAccountsAdapter'
import {
    allCapabilities,
    ETHEREUM_CHAIN_ID,
    fixtureEthereumDescriptor,
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'

const VALID_ALGORAND_ADDRESS =
    'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A'
const OTHER_ALGORAND_ADDRESS =
    'T2A7FPKQ3YON2JT5A5CSN4JWNDMUGJY6WX4H6HEH2UPKWSPSPBG5O7X4UM'
// The fixture chain's codec reads addresses case-insensitively and normalizes
// them to lower case.
const FIXTURE_ADDRESS = `fx${'ab'.repeat(20)}`

// A pinned, checksum-valid Algorand address used to exercise the
// quantum-looking-address code path. Not derived from any real quantum
// keypair — `@perawallet/wallet-core-kms` is globally stubbed in
// vitest.setup.ts, so this is a plain literal rather than a live derivation.
const QUANTUM_TEST_ADDRESS =
    'XGOHUMHM7JDVEMHV4GP6JRFDVMLIF72P76O5756D2C427WJOM7PFB6ZXK4'

const ETHEREUM_ADDRESS = `0x${'ab'.repeat(20)}`

const mockNavigate = vi.fn()
const mockTrackEvent = vi.hoisted(() => vi.fn())

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))
const mockPush = vi.fn()
const mockGoBack = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        push: mockPush,
        goBack: mockGoBack,
    }),
}))

const watched = (chainId: string, address: string) => ({
    id: 'watched',
    custody: { kind: 'watch' },
    chains: { [chainId]: { address } },
})
const mockImportWatchAccount = vi.fn(async (chainId: string, address: string) =>
    watched(chainId, address),
)
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])
const mockShowError = vi.fn()

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
        useAccountsStore: (selector: (state: unknown) => unknown) => {
            const state = {
                importWatchAccount: mockImportWatchAccount,
            }
            return selector(state)
        },
    }
})

const watchAccountsOff = vi.hoisted(() => new Set<string>())

vi.mock('@hooks/useCapability', () => ({
    useCapabilityCheck:
        () =>
        ({ chain }: { chain?: { chainId: string } }) =>
            chain === undefined || !watchAccountsOff.has(chain.chainId),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        generateOrderedUniqueId: () => 'mock-uuid',
        useDebouncedValue: (value: string) => value,
    }
})

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdSearchQuery: vi.fn(() => ({ data: [], isLoading: false })),
}))

describe('useWatchAccountScreen', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        registerAlgorandAddressCodec()
        const { chains } = getProvider()
        if (!chains.has(FIXTURE_CHAIN_ID)) {
            chains.register(
                {
                    ...fixtureEthereumDescriptor,
                    id: FIXTURE_CHAIN_ID,
                    enabledByDefault: false,
                },
                allCapabilities(true),
            )
        }
        if (!addressCodecs.has(FIXTURE_CHAIN_ID)) {
            addressCodecs.register(fixtureCodec)
        }
        watchAccountsOff.clear()
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        vi.mocked(useNfdSearchQuery).mockReturnValue({
            data: [],
            isLoading: false,
        } as unknown as ReturnType<typeof useNfdSearchQuery>)
    })

    it('initializes with empty address and invalid state', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        expect(result.current.address).toBe('')
        expect(result.current.isValidAddress).toBe(false)
        expect(result.current.isDuplicateAddress).toBe(false)
    })

    it('handleAddressChange updates address', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('some-address')
        })

        expect(result.current.address).toBe('some-address')
    })

    it('isValidAddress reflects address validity', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('invalid')
        })
        expect(result.current.isValidAddress).toBe(false)

        act(() => {
            result.current.handleAddressChange(VALID_ALGORAND_ADDRESS)
        })
        expect(result.current.isValidAddress).toBe(true)
    })

    it('isDuplicateAddress is true when address already exists', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing',
                chains: { algorand: { address: VALID_ALGORAND_ADDRESS } },
                custody: { kind: 'watch' },
            } as WalletAccount,
        ])

        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange(VALID_ALGORAND_ADDRESS)
        })

        expect(result.current.isDuplicateAddress).toBe(true)
    })

    it('isDuplicateAddress is false for invalid address even if it exists', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing',
                chains: { algorand: { address: 'invalid' } },
                custody: { kind: 'watch' },
            } as WalletAccount,
        ])

        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('invalid')
        })

        expect(result.current.isDuplicateAddress).toBe(false)
    })

    it('handleWatchAccount does nothing for invalid address', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('invalid-address')
        })

        act(() => {
            result.current.handleWatchAccount()
        })

        expect(mockImportWatchAccount).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('handleWatchAccount does nothing for duplicate address', () => {
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing',
                chains: { algorand: { address: VALID_ALGORAND_ADDRESS } },
                custody: { kind: 'watch' },
            } as WalletAccount,
        ])

        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange(VALID_ALGORAND_ADDRESS)
        })

        act(() => {
            result.current.handleWatchAccount()
        })

        expect(mockImportWatchAccount).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('handleWatchAccount adds the watch account through the store and names the one it returns', async () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange(VALID_ALGORAND_ADDRESS)
        })

        act(() => {
            result.current.handleWatchAccount()
        })

        expect(mockImportWatchAccount).toHaveBeenCalledWith(
            'algorand',
            VALID_ALGORAND_ADDRESS,
        )
        await waitFor(() =>
            expect(mockPush).toHaveBeenCalledWith('NameAccount', {
                account: watched('algorand', VALID_ALGORAND_ADDRESS),
                chainId: 'algorand',
            }),
        )
        expect(mockTrackEvent).toHaveBeenCalledWith(
            OnboardingEvent.WatchAccountComplete,
            { [AnalyticsMetadataKey.ChainId]: 'algorand' },
        )
    })

    describe('with Ethereum registered', () => {
        beforeEach(() => {
            registerEthereumChain()
        })

        afterEach(() => {
            restoreAlgorandOnlyChains()
        })

        it('tracks watching a 0x address on ethereum', async () => {
            const { result } = renderHook(() => useWatchAccountScreen())

            act(() => {
                result.current.handleAddressChange(ETHEREUM_ADDRESS)
            })
            act(() => {
                result.current.handleWatchAccount()
            })

            await waitFor(() =>
                expect(mockTrackEvent).toHaveBeenCalledWith(
                    OnboardingEvent.WatchAccountComplete,
                    { [AnalyticsMetadataKey.ChainId]: ETHEREUM_CHAIN_ID },
                ),
            )
            expect(mockImportWatchAccount).toHaveBeenCalledWith(
                ETHEREUM_CHAIN_ID,
                ETHEREUM_ADDRESS,
            )
        })
    })

    it('shows why, and stays, when the store refuses the address', async () => {
        const failure = new Error('already watched')
        mockImportWatchAccount.mockRejectedValueOnce(failure)
        mockUseAllAccounts.mockReturnValue([
            {
                id: 'existing',
                chains: { algorand: { address: OTHER_ALGORAND_ADDRESS } },
                custody: { kind: 'watch' },
            } as WalletAccount,
        ])
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange(VALID_ALGORAND_ADDRESS)
        })
        act(() => {
            result.current.handleWatchAccount()
        })

        await waitFor(() =>
            expect(mockShowError).toHaveBeenCalledWith(
                failure,
                'errors.general.title',
            ),
        )
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('resolves NFD name to address when input contains a dot', () => {
        vi.mocked(useNfdSearchQuery).mockReturnValue({
            data: [
                {
                    name: 'alice.algo',
                    address: VALID_ALGORAND_ADDRESS,
                    service: { name: 'NFD', logo: '' },
                },
            ],
            isLoading: false,
        } as unknown as ReturnType<typeof useNfdSearchQuery>)

        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('alice.algo')
        })

        expect(result.current.isNfdResolved).toBe(true)
        expect(result.current.nfdName).toBe('alice.algo')
        expect(result.current.resolvedAddress).toBe(VALID_ALGORAND_ADDRESS)
        expect(result.current.isValidAddress).toBe(true)
    })

    it('does not resolve NFD when input has no dot', () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('alice')
        })

        expect(result.current.isNfdResolved).toBe(false)
        expect(result.current.nfdName).toBeUndefined()
    })

    it('accepts a quantum-derived address and creates a plain watch account (FR-6)', async () => {
        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange(QUANTUM_TEST_ADDRESS)
        })

        expect(result.current.isValidAddress).toBe(true)

        act(() => {
            result.current.handleWatchAccount()
        })

        expect(mockImportWatchAccount).toHaveBeenCalledWith(
            'algorand',
            QUANTUM_TEST_ADDRESS,
        )
        await waitFor(() =>
            expect(mockPush).toHaveBeenCalledWith('NameAccount', {
                account: watched('algorand', QUANTUM_TEST_ADDRESS),
                chainId: 'algorand',
            }),
        )
    })

    it('shows resolving state during NFD lookup', () => {
        vi.mocked(useNfdSearchQuery).mockReturnValue({
            data: [],
            isLoading: true,
        } as unknown as ReturnType<typeof useNfdSearchQuery>)

        const { result } = renderHook(() => useWatchAccountScreen())

        act(() => {
            result.current.handleAddressChange('alice.algo')
        })

        expect(result.current.isNfdResolving).toBe(true)
    })

    describe('on a second registered chain', () => {
        it("accepts an address that chain's codec validates and watches it there", async () => {
            const { result } = renderHook(() => useWatchAccountScreen())

            act(() => {
                result.current.handleAddressChange(
                    FIXTURE_ADDRESS.toUpperCase(),
                )
            })

            expect(result.current.isValidAddress).toBe(true)

            act(() => {
                result.current.handleWatchAccount()
            })

            expect(mockImportWatchAccount).toHaveBeenCalledWith(
                FIXTURE_CHAIN_ID,
                FIXTURE_ADDRESS.toUpperCase(),
            )
            await waitFor(() =>
                expect(mockPush).toHaveBeenCalledWith('NameAccount', {
                    account: watched(
                        FIXTURE_CHAIN_ID,
                        FIXTURE_ADDRESS.toUpperCase(),
                    ),
                    chainId: FIXTURE_CHAIN_ID,
                }),
            )
        })

        it('rejects an address no registered codec validates', () => {
            const { result } = renderHook(() => useWatchAccountScreen())

            act(() => {
                result.current.handleAddressChange('not-an-address')
            })
            act(() => {
                result.current.handleWatchAccount()
            })

            expect(result.current.isValidAddress).toBe(false)
            expect(mockImportWatchAccount).not.toHaveBeenCalled()
        })

        it('rejects its addresses while that chain cannot watch accounts', () => {
            watchAccountsOff.add(FIXTURE_CHAIN_ID)
            const { result } = renderHook(() => useWatchAccountScreen())

            act(() => {
                result.current.handleAddressChange(FIXTURE_ADDRESS)
            })
            act(() => {
                result.current.handleWatchAccount()
            })

            expect(result.current.isValidAddress).toBe(false)
            expect(mockImportWatchAccount).not.toHaveBeenCalled()
        })

        it('offers every registered chain that can watch accounts to the scanner', () => {
            const { result } = renderHook(() => useWatchAccountScreen())

            expect(result.current.watchableChainIds).toEqual(
                expect.arrayContaining(['algorand', FIXTURE_CHAIN_ID]),
            )
        })

        it('leaves a chain that cannot watch accounts out of the scanner chains', () => {
            watchAccountsOff.add(FIXTURE_CHAIN_ID)
            const { result } = renderHook(() => useWatchAccountScreen())

            expect(result.current.watchableChainIds).toContain('algorand')
            expect(result.current.watchableChainIds).not.toContain(
                FIXTURE_CHAIN_ID,
            )
        })

        it('ignores a codec whose chain is not registered', () => {
            const unregisteredChainId = 'fixtureorphan' as ChainId
            const orphanAddress = `orphan-${'1'.repeat(8)}`
            if (!addressCodecs.has(unregisteredChainId)) {
                addressCodecs.register({
                    ...fixtureCodec,
                    chainId: unregisteredChainId,
                    isValid: address => address === orphanAddress,
                })
            }
            const { result } = renderHook(() => useWatchAccountScreen())

            act(() => {
                result.current.handleAddressChange(orphanAddress)
            })

            expect(result.current.isValidAddress).toBe(false)
        })

        it('flags an address already held on that chain, compared through its codec', () => {
            mockUseAllAccounts.mockReturnValue([
                {
                    id: 'existing',
                    chains: {
                        [FIXTURE_CHAIN_ID]: { address: FIXTURE_ADDRESS },
                    },
                    custody: { kind: 'watch' },
                } as unknown as WalletAccount,
            ])
            const { result } = renderHook(() => useWatchAccountScreen())

            act(() => {
                result.current.handleAddressChange(
                    FIXTURE_ADDRESS.toUpperCase(),
                )
            })

            expect(result.current.isDuplicateAddress).toBe(true)
        })

        it('watches on the default chain when a non-default chain registered first accepts the address too', async () => {
            const defaultChainId = 'fixturedefault' as ChainId
            const { chains } = getProvider()
            if (!chains.has(defaultChainId)) {
                chains.register(
                    {
                        ...fixtureEthereumDescriptor,
                        id: defaultChainId,
                        enabledByDefault: true,
                    },
                    allCapabilities(true),
                )
            }
            if (!addressCodecs.has(defaultChainId)) {
                addressCodecs.register({
                    ...fixtureCodec,
                    chainId: defaultChainId,
                })
            }
            const { result } = renderHook(() => useWatchAccountScreen())

            act(() => {
                result.current.handleAddressChange(FIXTURE_ADDRESS)
            })
            act(() => {
                result.current.handleWatchAccount()
            })

            expect(mockImportWatchAccount).toHaveBeenCalledWith(
                defaultChainId,
                FIXTURE_ADDRESS,
            )
            await waitFor(() =>
                expect(mockPush).toHaveBeenCalledWith('NameAccount', {
                    account: watched(defaultChainId, FIXTURE_ADDRESS),
                    chainId: defaultChainId,
                }),
            )
        })
    })
})
