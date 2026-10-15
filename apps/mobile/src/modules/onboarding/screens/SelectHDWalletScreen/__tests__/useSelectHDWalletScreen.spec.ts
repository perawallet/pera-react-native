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

import type { HdSeedGroup } from '@perawallet/wallet-core-accounts'
import { renderHook, act, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSelectHDWalletScreen } from '../useSelectHDWalletScreen'

// Mutable so individual tests can switch between one and many wallet groups.
const groupsState = vi.hoisted(() => ({ groups: [] as HdSeedGroup[] }))

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockGoBack = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        push: mockPush,
        replace: mockReplace,
        goBack: mockGoBack,
    }),
}))

let mockRouteParams: { returnTo?: unknown; chainId?: string } | undefined
vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({ params: mockRouteParams }),
    }
})

const mockShowToast = vi.fn()
const mockShowError = vi.fn()
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({
        showError: mockShowError,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

const mockBuildHdWalletAccount = vi.fn()

const mockHdSeedGroups: HdSeedGroup[] = [
    {
        seedKeyId: 'wallet-1',
        accounts: [
            {
                id: 'hd-1',
                chains: {
                    algorand: {
                        address: 'HD_ADDRESS_1',
                        keyPairId: 'wallet-1-acc0-idx0-dt9',
                    },
                },
                name: 'My Main Wallet',
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            },
        ],
        firstAccount: {
            id: 'hd-1',
            chains: {
                algorand: {
                    address: 'HD_ADDRESS_1',
                    keyPairId: 'wallet-1-acc0-idx0-dt9',
                },
            },
            name: 'My Main Wallet',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        },
        accountCount: 1,
    },
    {
        seedKeyId: 'wallet-2',
        accounts: [
            {
                id: 'hd-2',
                chains: {
                    algorand: {
                        address: 'HD_ADDRESS_2',
                        keyPairId: 'wallet-2-acc0-idx0-dt9',
                    },
                },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            },
        ],
        firstAccount: {
            id: 'hd-2',
            chains: {
                algorand: {
                    address: 'HD_ADDRESS_2',
                    keyPairId: 'wallet-2-acc0-idx0-dt9',
                },
            },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        },
        accountCount: 1,
    },
]

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useHdSeedGroups: () => ({
            hdSeedGroups: groupsState.groups,
            hasMultipleHdSeeds: groupsState.groups.length > 1,
        }),
        useAllAccounts: () => [],
        useCreateAccount: () => ({
            buildHdWalletAccount: mockBuildHdWalletAccount,
        }),
        useAccountBalancesQuery: () => ({
            accountBalances: new Map(),
            portfolioNativeValue: 0,
            isPending: false,
            isFetched: true,
            isRefetching: false,
            isError: false,
        }),
    }
})

const derivableState = vi.hoisted(() => ({ groups: [] as HdSeedGroup[] }))
const mockDeriveChainAccount = vi.fn()
vi.mock('@modules/onboarding/hooks/useDeriveChainAccount', () => ({
    useDeriveChainAccount: () => ({
        derivableWallets: derivableState.groups,
        deriveChainAccount: mockDeriveChainAccount,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        deferToNextCycle: (callback: () => Promise<void>) => callback(),
    }
})

describe('useSelectHDWalletScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteParams = undefined
        // Default to the two-wallet picker; auto-skip tests override this.
        groupsState.groups = mockHdSeedGroups
        derivableState.groups = []
    })

    it('returns HD wallet groups', () => {
        const { result } = renderHook(() => useSelectHDWalletScreen())
        expect(result.current.hdSeedGroups).toHaveLength(2)
        expect(result.current.hdSeedGroups[0].seedKeyId).toBe('wallet-1')
        expect(result.current.hdSeedGroups[1].seedKeyId).toBe('wallet-2')
    })

    it('returns account balances', () => {
        const { result } = renderHook(() => useSelectHDWalletScreen())
        expect(result.current.accountBalances).toBeInstanceOf(Map)
    })

    it('starts with isCreatingWallet as false', () => {
        const { result } = renderHook(() => useSelectHDWalletScreen())
        expect(result.current.isCreatingWallet).toBe(false)
    })

    it('navigates to SearchAccounts when selecting a wallet', async () => {
        const mockNewAccount = {
            id: 'hd-new',
            chains: { algorand: { address: 'HD_NEW' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        mockBuildHdWalletAccount.mockResolvedValue(mockNewAccount)

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleSelectWallet(mockHdSeedGroups[0])
        })

        expect(mockReplace).toHaveBeenCalledWith(
            'NameAccount',
            expect.objectContaining({ account: mockNewAccount }),
        )
    })

    it('forwards the returnTo target to NameAccount when selecting an existing wallet', async () => {
        const returnTo = {
            name: 'PeraCard',
            params: {
                screen: 'CardOnboarding',
                params: { screen: 'CardOnboardingStatus' },
            },
        }
        mockRouteParams = { returnTo }
        const newAccount = {
            id: 'hd-new',
            chains: { algorand: { address: 'HD_NEW' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        mockBuildHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleSelectWallet(mockHdSeedGroups[0])
        })

        expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
            returnTo,
        })
    })

    it('navigates back when handleGoBack is called', () => {
        const { result } = renderHook(() => useSelectHDWalletScreen())

        act(() => {
            result.current.handleGoBack()
        })

        expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it('sets isCreatingWallet to true while creating a new wallet', async () => {
        let resolveCreate!: (value: unknown) => void
        mockBuildHdWalletAccount.mockReturnValue(
            new Promise(resolve => {
                resolveCreate = resolve
            }),
        )

        const { result } = renderHook(() => useSelectHDWalletScreen())

        act(() => {
            result.current.handleCreateNewWallet()
        })

        expect(result.current.isCreatingWallet).toBe(true)

        await act(async () => {
            resolveCreate({
                id: 'new',
                chains: { algorand: { address: 'NEW' } },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            })
        })

        expect(result.current.isCreatingWallet).toBe(false)
    })

    it('creates a new wallet with account 0 and keyIndex 0', async () => {
        const newAccount = {
            id: 'new-id',
            chains: { algorand: { address: 'NEW_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        mockBuildHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleCreateNewWallet()
        })

        expect(mockBuildHdWalletAccount).toHaveBeenCalledWith({
            account: 0,
            keyIndex: 0,
        })
    })

    it('navigates to NameAccount after successful wallet creation', async () => {
        const newAccount = {
            id: 'new-id',
            chains: { algorand: { address: 'NEW_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        mockBuildHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleCreateNewWallet()
        })

        expect(mockPush).toHaveBeenCalledWith(
            'NameAccount',
            expect.objectContaining({ account: newAccount }),
        )
    })

    it('forwards the returnTo target to NameAccount', async () => {
        const returnTo = {
            name: 'PeraCard',
            params: {
                screen: 'CardOnboarding',
                params: { screen: 'CardOnboardingStatus' },
            },
        }
        mockRouteParams = { returnTo }
        const newAccount = {
            id: 'new-id',
            chains: { algorand: { address: 'NEW_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        mockBuildHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleCreateNewWallet()
        })

        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
            returnTo,
        })
    })

    it('shows error toast when wallet creation fails', async () => {
        mockBuildHdWalletAccount.mockRejectedValue(new Error('Creation failed'))

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleCreateNewWallet()
        })

        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(Error),
            'onboarding.create_account.error_title',
        )
    })

    it('resets isCreatingWallet after wallet creation fails', async () => {
        mockBuildHdWalletAccount.mockRejectedValue(new Error('Creation failed'))

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleCreateNewWallet()
        })

        expect(result.current.isCreatingWallet).toBe(false)
    })

    it('does not navigate when wallet creation fails', async () => {
        mockBuildHdWalletAccount.mockRejectedValue(new Error('Creation failed'))

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleCreateNewWallet()
        })

        expect(mockPush).not.toHaveBeenCalled()
    })

    describe('single-wallet auto-select', () => {
        it('auto-selects the only wallet and skips the picker', async () => {
            groupsState.groups = [mockHdSeedGroups[0]]
            const newAccount = {
                id: 'x',
                chains: { algorand: { address: 'X' } },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            }
            mockBuildHdWalletAccount.mockResolvedValue(newAccount)

            const { result } = renderHook(() => useSelectHDWalletScreen())

            expect(result.current.isAutoSelecting).toBe(true)

            await waitFor(() =>
                expect(mockBuildHdWalletAccount).toHaveBeenCalledWith({
                    walletId: 'wallet-1',
                    account: 0,
                    keyIndex: 1,
                }),
            )
            expect(mockReplace).toHaveBeenCalledWith(
                'NameAccount',
                expect.objectContaining({ account: newAccount }),
            )
        })

        it('forwards the returnTo target through the auto-select path', async () => {
            groupsState.groups = [mockHdSeedGroups[0]]
            const returnTo = {
                name: 'PeraCard',
                params: {
                    screen: 'CardOnboarding',
                    params: { screen: 'CardOnboardingStatus' },
                },
            }
            mockRouteParams = { returnTo }
            const newAccount = {
                id: 'x',
                chains: { algorand: { address: 'X' } },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            }
            mockBuildHdWalletAccount.mockResolvedValue(newAccount)

            renderHook(() => useSelectHDWalletScreen())

            await waitFor(() =>
                expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
                    account: newAccount,
                    returnTo,
                }),
            )
        })

        it('does not auto-select when multiple wallets exist', async () => {
            groupsState.groups = mockHdSeedGroups

            const { result } = renderHook(() => useSelectHDWalletScreen())

            expect(result.current.isAutoSelecting).toBe(false)
            await act(async () => {})
            expect(mockBuildHdWalletAccount).not.toHaveBeenCalled()
        })

        it('reveals the picker (and toasts) when auto-select fails', async () => {
            groupsState.groups = [mockHdSeedGroups[0]]
            mockBuildHdWalletAccount.mockRejectedValue(new Error('boom'))

            const { result } = renderHook(() => useSelectHDWalletScreen())

            await waitFor(() =>
                expect(mockShowError).toHaveBeenCalledWith(
                    expect.any(Error),
                    'onboarding.create_account.error_title',
                ),
            )
            expect(result.current.isAutoSelecting).toBe(false)
            expect(mockReplace).not.toHaveBeenCalled()
        })
    })

    describe('adding a chain entry', () => {
        const CHAIN_ID = 'second-chain'
        const chainAccount = {
            ...mockHdSeedGroups[1]!.firstAccount,
            chains: {
                ...mockHdSeedGroups[1]!.firstAccount.chains,
                [CHAIN_ID]: { address: 'CHAIN_ADDRESS', keyPairId: 'k' },
            },
        }

        beforeEach(() => {
            mockRouteParams = { chainId: CHAIN_ID, returnTo: undefined }
            derivableState.groups = mockHdSeedGroups
        })

        it('lists only the wallets that can derive on the chain', () => {
            derivableState.groups = [mockHdSeedGroups[1]!, mockHdSeedGroups[0]!]

            const { result } = renderHook(() => useSelectHDWalletScreen())

            expect(result.current.hdSeedGroups.map(g => g.seedKeyId)).toEqual([
                'wallet-2',
                'wallet-1',
            ])
        })

        it('offers no new wallet', () => {
            const { result } = renderHook(() => useSelectHDWalletScreen())

            expect(result.current.canCreateNewWallet).toBe(false)
        })

        it('adds the chain entry to the picked wallet and names it on the chain', async () => {
            mockDeriveChainAccount.mockResolvedValue(chainAccount)
            const { result } = renderHook(() => useSelectHDWalletScreen())

            await act(async () => {
                result.current.handleSelectWallet(mockHdSeedGroups[1]!)
            })

            expect(mockDeriveChainAccount).toHaveBeenCalledWith('wallet-2')
            expect(mockBuildHdWalletAccount).not.toHaveBeenCalled()
            expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
                account: chainAccount,
                returnTo: undefined,
                chainId: CHAIN_ID,
            })
        })

        it('shows the error toast when the derivation fails', async () => {
            const error = new Error('duplicate')
            mockDeriveChainAccount.mockRejectedValue(error)
            const { result } = renderHook(() => useSelectHDWalletScreen())

            await act(async () => {
                result.current.handleSelectWallet(mockHdSeedGroups[0]!)
            })

            expect(mockShowError).toHaveBeenCalledWith(
                error,
                'onboarding.create_account.error_title',
            )
            expect(mockReplace).not.toHaveBeenCalled()
        })
    })

    it('offers a new wallet when no chain is given', () => {
        const { result } = renderHook(() => useSelectHDWalletScreen())

        expect(result.current.canCreateNewWallet).toBe(true)
    })
})
