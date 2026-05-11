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
import { useSelectHDWalletScreen } from '../useSelectHDWalletScreen'
import type { HDWalletGroup } from '@perawallet/wallet-core-accounts'

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

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

const mockCreateHdWalletAccount = vi.fn()

const mockHDWalletGroups: HDWalletGroup[] = [
    {
        keyPairId: 'wallet-1',
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
                keyPairId: 'wallet-1',
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
            keyPairId: 'wallet-1',
        },
        accountCount: 1,
    },
    {
        keyPairId: 'wallet-2',
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
                keyPairId: 'wallet-2',
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
            keyPairId: 'wallet-2',
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
            hdWalletGroups: mockHDWalletGroups,
            hasMultipleHDWallets: true,
        }),
        useAllAccounts: () => [],
        useCreateAccount: () => ({
            createHdWalletAccount: mockCreateHdWalletAccount,
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
    })

    it('returns HD wallet groups', () => {
        const { result } = renderHook(() => useSelectHDWalletScreen())
        expect(result.current.hdWalletGroups).toHaveLength(2)
        expect(result.current.hdWalletGroups[0].keyPairId).toBe('wallet-1')
        expect(result.current.hdWalletGroups[1].keyPairId).toBe('wallet-2')
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
        const mockNewAccount = { id: 'hd-new', address: 'HD_NEW', type: 'hdWallet' as const }
        mockCreateHdWalletAccount.mockResolvedValue(mockNewAccount)

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleSelectWallet(mockHDWalletGroups[0])
        })

        expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
            account: mockNewAccount,
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
        mockCreateHdWalletAccount.mockReturnValue(
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
        mockCreateHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleCreateNewWallet()
        })

        expect(mockCreateHdWalletAccount).toHaveBeenCalledWith({
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
        mockCreateHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleCreateNewWallet()
        })

        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('shows error toast when wallet creation fails', async () => {
        mockCreateHdWalletAccount.mockRejectedValue(
            new Error('Creation failed'),
        )

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleCreateNewWallet()
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('resets isCreatingWallet after wallet creation fails', async () => {
        mockCreateHdWalletAccount.mockRejectedValue(
            new Error('Creation failed'),
        )

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleCreateNewWallet()
        })

        expect(result.current.isCreatingWallet).toBe(false)
    })

    it('does not navigate when wallet creation fails', async () => {
        mockCreateHdWalletAccount.mockRejectedValue(
            new Error('Creation failed'),
        )

        const { result } = renderHook(() => useSelectHDWalletScreen())

        await act(async () => {
            result.current.handleCreateNewWallet()
        })

        expect(mockPush).not.toHaveBeenCalled()
    })
})
