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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import type { SwapHistoryItem } from '@perawallet/wallet-core-swaps'
import { VISIBLE_SWAP_STATUSES } from '../../../constants'
import { useSwapHistoryList } from '../useSwapHistoryList'

const { SCOPE, ETH_SCOPE } = vi.hoisted(() => ({
    SCOPE: { chainId: 'algorand', networkId: 'mainnet' } as const,
    ETH_SCOPE: { chainId: 'ethereum', networkId: 'mainnet' } as const,
}))

const {
    mockTransactionOf,
    mockPayoutOf,
    mockNavigate,
    mockTrackEvent,
    mockHistory,
    mockFormatAssetAmount,
    wallet,
} = vi.hoisted(() => ({
    mockTransactionOf: vi.fn(),
    mockPayoutOf: vi.fn(),
    mockNavigate: vi.fn(),
    mockTrackEvent: vi.fn(),
    mockHistory: vi.fn(),
    mockFormatAssetAmount: vi.fn(),
    wallet: {
        accounts: [] as { id: string; name: string }[],
        addresses: [] as unknown[],
    },
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    swapTransactionOf: mockTransactionOf,
    swapPayoutOf: mockPayoutOf,
    useSwapHistoryInfiniteQuery: mockHistory,
    useSwapSigningAccounts: () => wallet.accounts,
    useSwapAccountNames: (accounts: { id: string; name: string }[]) => {
        const names = accounts
            .filter(account =>
                (wallet.addresses as { accountId: string }[]).some(
                    entry => entry.accountId === account.id,
                ),
            )
            .map(account => ({ accountId: account.id, name: account.name }))
        return { names, isMultiAccount: names.length > 1 }
    },
    useSwapAccountsAddresses: () => wallet.addresses,
    swapAccountKey: ({
        scope,
        address,
    }: {
        scope: { chainId: string }
        address: string
    }) => `${scope.chainId}|${address.toLowerCase()}`,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    formatAssetAmount: mockFormatAssetAmount,
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mockTrackEvent,
}))

const ALGO = {
    assetId: '0',
    ref: { ...SCOPE, assetId: '0' },
    unitName: 'ALGO',
    decimals: 6,
}
const USDC = {
    assetId: '31566704',
    ref: { ...SCOPE, assetId: '31566704' },
    unitName: 'USDC',
    decimals: 6,
}

const item = {
    orderId: 'order-1',
    assetIn: ALGO,
    assetOut: USDC,
    amountIn: new Decimal('1000000'),
    amountOut: new Decimal('2000000'),
    sourceAccount: null,
} as unknown as SwapHistoryItem

const historyOf = (swaps: SwapHistoryItem[]) => ({
    swaps,
    isLoading: false,
    isError: false,
    isAccountNotOnDevice: false,
    hasFailedBatch: false,
    readKey: 'read',
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
})

const render = (onClose = vi.fn()) =>
    renderHook(() => useSwapHistoryList({ onClose }))

describe('useSwapHistoryList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockHistory.mockReturnValue(historyOf([]))
        mockTransactionOf.mockReturnValue(undefined)
        mockPayoutOf.mockReturnValue(undefined)
        mockFormatAssetAmount.mockImplementation(
            (amount: Decimal, asset: { unitName: string }) =>
                `${amount.toString()} ${asset.unitName}`,
        )
        wallet.accounts = [
            { id: 'one', name: 'First' },
            { id: 'two', name: 'Second' },
        ]
        wallet.addresses = [
            {
                scope: SCOPE,
                address: 'ADDR1',
                accountId: 'one',
                isOnDevice: true,
            },
            {
                scope: SCOPE,
                address: 'ADDR2',
                accountId: 'two',
                isOnDevice: true,
            },
            {
                scope: ETH_SCOPE,
                address: '0xETH2',
                accountId: 'two',
                isOnDevice: true,
            },
        ]
    })

    it('reads every signing account address, not one account', () => {
        render()

        expect(mockHistory).toHaveBeenCalledWith(
            [
                { scope: SCOPE, address: 'ADDR1', isOnDevice: true },
                { scope: SCOPE, address: 'ADDR2', isOnDevice: true },
                { scope: ETH_SCOPE, address: '0xETH2', isOnDevice: true },
            ],
            VISIBLE_SWAP_STATUSES,
        )
    })

    it('carries whether device registration sends each address', () => {
        wallet.addresses = [
            {
                scope: SCOPE,
                address: 'ADDR1',
                accountId: 'one',
                isOnDevice: true,
            },
            {
                scope: ETH_SCOPE,
                address: '0xETH1',
                accountId: 'one',
                isOnDevice: false,
            },
        ]

        render()

        expect(mockHistory).toHaveBeenCalledWith(
            [
                { scope: SCOPE, address: 'ADDR1', isOnDevice: true },
                { scope: ETH_SCOPE, address: '0xETH1', isOnDevice: false },
            ],
            VISIBLE_SWAP_STATUSES,
        )
    })

    it('offers All accounts and one option per account with a swap address', () => {
        const { result } = render()

        expect(
            result.current.accountOptions.map(option => option.value),
        ).toEqual([null, 'one', 'two'])
        expect(
            result.current.accountOptions.map(option => option.label),
        ).toEqual(['swap.history.list.account_filter_all', 'First', 'Second'])
        expect(result.current.selectedAccountId).toBeNull()
    })

    it('offers no filter for a single account', () => {
        wallet.accounts = [{ id: 'one', name: 'First' }]
        wallet.addresses = [
            {
                scope: SCOPE,
                address: 'ADDR1',
                accountId: 'one',
                isOnDevice: true,
            },
        ]

        const { result } = render()

        expect(result.current.accountOptions).toEqual([])
    })

    it('narrows the read to the picked account and restores all on All', () => {
        const { result } = render()

        act(() => result.current.handleSelectAccount('two'))

        expect(result.current.selectedAccountId).toBe('two')
        expect(mockHistory).toHaveBeenLastCalledWith(
            [
                { scope: SCOPE, address: 'ADDR2', isOnDevice: true },
                { scope: ETH_SCOPE, address: '0xETH2', isOnDevice: true },
            ],
            VISIBLE_SWAP_STATUSES,
        )

        act(() => result.current.handleSelectAccount(null))

        expect(result.current.selectedAccountId).toBeNull()
        expect(mockHistory.mock.lastCall?.[0]).toHaveLength(3)
    })

    it('falls back to All when the picked account leaves the wallet', () => {
        const { result, rerender } = render()
        act(() => result.current.handleSelectAccount('two'))

        wallet.accounts = [
            { id: 'one', name: 'First' },
            { id: 'three', name: 'Third' },
        ]
        wallet.addresses = [
            {
                scope: SCOPE,
                address: 'ADDR1',
                accountId: 'one',
                isOnDevice: true,
            },
            {
                scope: SCOPE,
                address: 'ADDR3',
                accountId: 'three',
                isOnDevice: true,
            },
        ]
        rerender()

        expect(result.current.selectedAccountId).toBeNull()
        expect(mockHistory.mock.lastCall?.[0]).toHaveLength(2)
    })

    it('names the account that paid, matching an EVM address ignoring case', () => {
        const paidByTwo = {
            ...item,
            orderId: 'paid',
            sourceAccount: { scope: ETH_SCOPE, address: '0xeth2' },
        } as unknown as SwapHistoryItem
        const stranger = {
            ...item,
            orderId: 'stranger',
            sourceAccount: { scope: SCOPE, address: 'NOBODY' },
        } as unknown as SwapHistoryItem
        mockHistory.mockReturnValue(historyOf([paidByTwo, stranger, item]))

        const { result } = render()

        expect(result.current.swaps.map(swap => swap.accountName)).toEqual([
            'Second',
            undefined,
            undefined,
        ])
    })

    it("lists an Ethereum swap paid by an EVM address in lowercase with its payer's name", () => {
        const ethSwap = {
            ...item,
            orderId: 'eth-swap',
            assetIn: {
                assetId: 'usdc',
                ref: { ...ETH_SCOPE, assetId: 'usdc' },
                unitName: 'USDC',
                decimals: 6,
            },
            assetOut: {
                assetId: 'native',
                ref: { ...ETH_SCOPE, assetId: 'native' },
                unitName: 'ETH',
                decimals: 18,
            },
            sourceAccount: { scope: ETH_SCOPE, address: '0xeth2' },
        } as unknown as SwapHistoryItem
        mockHistory.mockReturnValue(historyOf([ethSwap]))

        const { result } = render()

        expect(result.current.swaps).toHaveLength(1)
        expect(result.current.swaps[0].accountName).toBe('Second')
    })

    it('rounds amounts through the shared formatter and shows a dash for a missing one', () => {
        const noAmount = {
            ...item,
            orderId: 'none',
            amountIn: null,
        } as unknown as SwapHistoryItem
        mockHistory.mockReturnValue(historyOf([item, noAmount]))

        const { result } = render()

        expect(mockFormatAssetAmount).toHaveBeenCalledWith(item.amountIn, ALGO)
        expect(mockFormatAssetAmount).toHaveBeenCalledWith(item.amountOut, USDC)
        expect(result.current.swaps[0]).toMatchObject({
            amountInLabel: '1000000 ALGO',
            amountOutLabel: '2000000 USDC',
        })
        expect(result.current.swaps[1]).toMatchObject({
            amountInLabel: '-',
            amountOutLabel: '2000000 USDC',
        })
        expect(mockFormatAssetAmount).toHaveBeenCalledTimes(3)
    })

    it('shows the not-on-device state instead of the error or empty state', () => {
        mockHistory.mockReturnValue({
            ...historyOf([]),
            isError: true,
            isAccountNotOnDevice: true,
        })

        const { result } = render()

        expect(result.current.shouldShowNotOnDeviceState).toBe(true)
        expect(result.current.shouldShowErrorState).toBe(false)
        expect(result.current.shouldShowEmptyState).toBe(false)
    })

    it('keeps the filter options while a picked account has no swaps', () => {
        const { result } = render()
        act(() => result.current.handleSelectAccount('one'))

        expect(result.current.shouldShowEmptyState).toBe(true)
        expect(result.current.accountOptions).toHaveLength(3)
    })

    it('reads on while nothing is visible and older pages remain, without showing the empty state', () => {
        const fetchNextPage = vi.fn()
        mockHistory.mockReturnValue({
            ...historyOf([]),
            hasNextPage: true,
            fetchNextPage,
        })

        const { result } = render()

        expect(fetchNextPage).toHaveBeenCalledTimes(1)
        expect(result.current.shouldShowEmptyState).toBe(false)
    })

    it('does not read on while a page is loading or after an error', () => {
        const fetchNextPage = vi.fn()
        mockHistory.mockReturnValue({
            ...historyOf([]),
            hasNextPage: true,
            isFetchingNextPage: true,
            fetchNextPage,
        })
        render()
        mockHistory.mockReturnValue({
            ...historyOf([]),
            hasNextPage: true,
            isError: true,
            fetchNextPage,
        })
        render()

        expect(fetchNextPage).not.toHaveBeenCalled()
    })

    it('names no account on the rows of a wallet with one account', () => {
        wallet.accounts = [{ id: 'one', name: 'First' }]
        wallet.addresses = [
            {
                scope: SCOPE,
                address: 'ADDR1',
                accountId: 'one',
                isOnDevice: true,
            },
        ]
        const paid = {
            ...item,
            sourceAccount: { scope: SCOPE, address: 'ADDR1' },
        } as unknown as SwapHistoryItem
        mockHistory.mockReturnValue(historyOf([paid]))

        const { result } = render()

        expect(result.current.swaps[0].accountName).toBeUndefined()
    })

    it('stops reading on after a few pages, offering to load more instead of claiming the history is empty', () => {
        const fetchNextPage = vi.fn()
        const state = (isFetchingNextPage: boolean) => ({
            ...historyOf([]),
            hasNextPage: true,
            isFetchingNextPage,
            fetchNextPage,
        })
        mockHistory.mockReturnValue(state(false))
        const { result, rerender } = render()

        for (let page = 0; page < 8; page++) {
            mockHistory.mockReturnValue(state(true))
            rerender()
            mockHistory.mockReturnValue(state(false))
            rerender()
        }

        expect(fetchNextPage).toHaveBeenCalledTimes(5)
        expect(result.current.shouldShowEmptyState).toBe(false)
        expect(result.current.shouldShowLoadMore).toBe(true)

        result.current.handleEndReached()
        expect(fetchNextPage).toHaveBeenCalledTimes(6)
    })

    it('starts the reading budget over when the accounts read change', () => {
        const fetchNextPage = vi.fn()
        const state = (isFetchingNextPage: boolean, readKey: string) => ({
            ...historyOf([]),
            hasNextPage: true,
            isFetchingNextPage,
            readKey,
            fetchNextPage,
        })
        mockHistory.mockReturnValue(state(false, 'a'))
        const { rerender } = render()
        const cycle = (readKey: string) => {
            mockHistory.mockReturnValue(state(true, readKey))
            rerender()
            mockHistory.mockReturnValue(state(false, readKey))
            rerender()
        }
        for (let page = 0; page < 8; page++) cycle('a')
        expect(fetchNextPage).toHaveBeenCalledTimes(5)

        for (let page = 0; page < 8; page++) cycle('b')

        expect(fetchNextPage).toHaveBeenCalledTimes(10)
    })

    it('shows the load more offer in the first render after the read set changes only when its budget is spent', () => {
        const fetchNextPage = vi.fn()
        const state = (isFetchingNextPage: boolean, readKey: string) => ({
            ...historyOf([]),
            hasNextPage: true,
            isFetchingNextPage,
            readKey,
            fetchNextPage,
        })
        mockHistory.mockReturnValue(state(false, 'a'))
        const { result, rerender } = render()
        for (let page = 0; page < 8; page++) {
            mockHistory.mockReturnValue(state(true, 'a'))
            rerender()
            mockHistory.mockReturnValue(state(false, 'a'))
            rerender()
        }
        expect(result.current.shouldShowLoadMore).toBe(true)

        mockHistory.mockReturnValue(state(false, 'b'))
        rerender()

        expect(result.current.shouldShowLoadMore).toBe(false)
    })

    it('shows the error state, not the empty state, when a batch failed and nothing is visible', () => {
        mockHistory.mockReturnValue({
            ...historyOf([]),
            hasFailedBatch: true,
        })

        const { result } = render()

        expect(result.current.shouldShowErrorState).toBe(true)
        expect(result.current.shouldShowEmptyState).toBe(false)
    })

    it('keeps the rows that loaded when a batch failed', () => {
        mockHistory.mockReturnValue({
            ...historyOf([item]),
            hasFailedBatch: true,
        })

        const { result } = render()

        expect(result.current.swaps).toHaveLength(1)
        expect(result.current.shouldShowErrorState).toBe(false)
    })

    it('hides rows naming an asset this wallet cannot resolve', () => {
        const legacy = {
            ...item,
            orderId: 'legacy',
            assetOut: null,
        } as unknown as SwapHistoryItem
        mockHistory.mockReturnValue(historyOf([legacy, item]))

        const { result } = render()

        expect(result.current.swaps.map(swap => swap.orderId)).toEqual([
            'order-1',
        ])
        expect(result.current.keyExtractor(result.current.swaps[0])).toBe(
            'order-1',
        )
    })

    it("opens the swap's transaction details for the account that paid", () => {
        const ethSwap = {
            ...item,
            orderId: 'eth',
            assetIn: {
                ...ALGO,
                ref: { ...ETH_SCOPE, assetId: 'native' },
                unitName: 'ETH',
            },
            sourceAccount: { scope: ETH_SCOPE, address: '0xeth2' },
        } as unknown as SwapHistoryItem
        mockHistory.mockReturnValue(historyOf([ethSwap]))
        mockTransactionOf.mockReturnValue({
            scope: ETH_SCOPE,
            transactionId: '0x1',
        })
        const onClose = vi.fn()
        const { result } = render(onClose)

        const [listed] = result.current.swaps
        expect(mockTransactionOf).toHaveBeenCalledWith(ethSwap)
        expect(listed.detailsTarget).toEqual({
            scope: ETH_SCOPE,
            transactionId: '0x1',
            accountAddress: '0xETH2',
            swapPayout: undefined,
        })
        result.current.handleItemPress(listed)

        expect(onClose).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith(
            'TransactionDetails',
            listed.detailsTarget,
        )
        expect(mockTrackEvent).toHaveBeenCalledWith(
            'swapscr_swap_history_see_all_select',
            { chain_id: 'ethereum', swap_pairing: 'ETH/USDC' },
        )
    })

    it("hands a cross-chain swap's payout to the details screen", () => {
        const crossChain = {
            ...item,
            orderId: 'cross',
            sourceAccount: { scope: SCOPE, address: 'ADDR1' },
        } as unknown as SwapHistoryItem
        const payout = { scope: ETH_SCOPE, transactionId: '0xpayout' }
        mockHistory.mockReturnValue(historyOf([crossChain]))
        mockTransactionOf.mockReturnValue({
            scope: SCOPE,
            transactionId: 'DEP',
        })
        mockPayoutOf.mockReturnValue(payout)
        const { result } = render()

        const [listed] = result.current.swaps
        expect(mockPayoutOf).toHaveBeenCalledWith(crossChain)
        result.current.handleItemPress(listed)

        expect(mockNavigate).toHaveBeenCalledWith(
            'TransactionDetails',
            expect.objectContaining({
                scope: SCOPE,
                transactionId: 'DEP',
                swapPayout: payout,
            }),
        )
    })

    it.each([
        {
            name: 'the router has not listed the swap transaction',
            transaction: undefined,
            sourceAccount: { scope: SCOPE, address: 'ADDR1' },
        },
        {
            name: 'the payer is not one of the wallet accounts',
            transaction: { scope: SCOPE, transactionId: 'TX' },
            sourceAccount: { scope: SCOPE, address: 'STRANGER' },
        },
    ])('does nothing when $name', ({ transaction, sourceAccount }) => {
        mockHistory.mockReturnValue(
            historyOf([{ ...item, sourceAccount } as SwapHistoryItem]),
        )
        mockTransactionOf.mockReturnValue(transaction)
        const onClose = vi.fn()
        const { result } = render(onClose)

        const [listed] = result.current.swaps
        expect(listed.detailsTarget).toBeUndefined()
        result.current.handleItemPress(listed)

        expect(onClose).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(mockTrackEvent).not.toHaveBeenCalled()
    })
})
