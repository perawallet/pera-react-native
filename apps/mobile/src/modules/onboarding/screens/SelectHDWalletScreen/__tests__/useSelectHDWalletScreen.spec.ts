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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSelectHDWalletScreen } from '../useSelectHDWalletScreen'
import type { HDWalletGroup } from '@perawallet/wallet-core-accounts'

// Mutable so individual tests can switch between one and many wallet groups.
const groupsState = vi.hoisted(() => ({ groups: [] as HDWalletGroup[] }))

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

let mockRouteParams: { returnTo?: unknown } | undefined
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

const mockHDWalletGroups: HDWalletGroup[] = [
    {
        seedKeyId: 'wallet-1',
        accounts: [
            {
                id: 'hd-1',
                address: 'HD_ADDRESS_1',
                name: 'My Main Wallet',
                type: 'hdWallet' as const,
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9 as const,
                },
                keyPairId: 'wallet-1-acc0-idx0-dt9',
            },
        ],
        firstAccount: {
            id: 'hd-1',
            address: 'HD_ADDRESS_1',
            name: 'My Main Wallet',
            type: 'hdWallet' as const,
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9 as const,
            },
            keyPairId: 'wallet-1-acc0-idx0-dt9',
        },
        accountCount: 1,
    },
    {
        seedKeyId: 'wallet-2',
        accounts: [
            {
                id: 'hd-2',
                address: 'HD_ADDRESS_2',
                type: 'hdWallet' as const,
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9 as const,
                },
                keyPairId: 'wallet-2-acc0-idx0-dt9',
            },
        ],
        firstAccount: {
            id: 'hd-2',
            address: 'HD_ADDRESS_2',
            type: 'hdWallet' as const,
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9 as const,
            },
            keyPairId: 'wallet-2-acc0-idx0-dt9',
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
        useHDWalletGroups: () => ({
            hdWalletGroups: groupsState.groups,
            hasMultipleHDWallets: groupsState.groups.length > 1,
        }),
        useAllAccounts: () => [],
        useCreateAccount: () => ({
            buildHdWalletAccount: mockBuildHdWalletAccount,
        }),
        useAccountBalancesQuery: () => ({
            accountBalances: new Map(),
            portfolioAlgoValue: 0,
            isPending: false,
            isFetched: true,
            isRefetching: false,
            isError: false,
        }),
    }
})

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
        groupsState.groups = mockHDWalletGroups
    })

    it('returns HD wallet groups', () => {
        const { result } = renderHook(() => useSelectHDWalletScreen())
        expect(result.current.hdWalletGroups).toHaveLength(2)
        expect(result.current.hdWalletGroups[0].seedKeyId).toBe('wallet-1')
        expect(result.current.hdWalletGroups[1].seedKeyId).toBe('wallet-2')
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
            address: 'HD_NEW',
            type: 'hdWallet' as const,
        }
        mockBuildHdWalletAccount.mockResolvedValue(mockNewAccount)

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleSelectWallet(mockHDWalletGroups[0])
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
            address: 'HD_NEW',
            type: 'hdWallet' as const,
        }
        mockBuildHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleSelectWallet(mockHDWalletGroups[0])
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
            resolveCreate({ id: 'new', address: 'NEW', type: 'hdWallet' })
        })

        expect(result.current.isCreatingWallet).toBe(false)
    })

    it('creates a new wallet with account 0 and keyIndex 0', async () => {
        const newAccount = {
            id: 'new-id',
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
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
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
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
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
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
            groupsState.groups = [mockHDWalletGroups[0]]
            const newAccount = {
                id: 'x',
                address: 'X',
                type: 'hdWallet' as const,
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
            groupsState.groups = [mockHDWalletGroups[0]]
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
                address: 'X',
                type: 'hdWallet' as const,
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
            groupsState.groups = mockHDWalletGroups

            const { result } = renderHook(() => useSelectHDWalletScreen())

            expect(result.current.isAutoSelecting).toBe(false)
            await act(async () => {})
            expect(mockBuildHdWalletAccount).not.toHaveBeenCalled()
        })

        it('reveals the picker (and toasts) when auto-select fails', async () => {
            groupsState.groups = [mockHDWalletGroups[0]]
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
})
