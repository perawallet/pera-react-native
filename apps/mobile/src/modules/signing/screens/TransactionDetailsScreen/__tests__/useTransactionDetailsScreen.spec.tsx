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

import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { algorandHistoryAdapter } from '@perawallet/wallet-core-chain-algorand/transactions'
import {
    historyChainAdapters,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { AnalyticsMetadataKey, AnalyticsScreenName } from '@analytics'
import {
    allCapabilities,
    ETHEREUM_CHAIN_ID,
    fixtureEthereumDescriptor,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import { useNetworkStatusStore } from '@modules/network'
import { useTransactionDetailsScreen } from '../useTransactionDetailsScreen'

const ALGORAND_SCOPE = { chainId: 'algorand', networkId: 'testnet' }
const ETHEREUM_SCOPE = { chainId: ETHEREUM_CHAIN_ID, networkId: 'sepolia' }

const mockPush = vi.fn()
const routeParams: { current: Record<string, unknown> } = { current: {} }

// Partial: importing `@modules/algorand` loads components that read other
// navigation exports at module scope.
vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<typeof import('@react-navigation/native')>()),
    useNavigation: () => ({ push: mockPush }),
    useRoute: () => ({ params: routeParams.current }),
}))

const { mockTrackScreen } = vi.hoisted(() => ({ mockTrackScreen: vi.fn() }))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackScreen: mockTrackScreen,
}))

const mockUseTransactionDetailQuery = vi.fn()

const { mockRequestSheet } = vi.hoisted(() => ({ mockRequestSheet: vi.fn() }))

vi.mock('@modules/bottom-sheet', async importOriginal => ({
    ...(await importOriginal<typeof import('@modules/bottom-sheet')>()),
    useBottomSheet: () => ({ request: mockRequestSheet }),
}))

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => {
        const actual =
            await importOriginal<
                typeof import('@perawallet/wallet-core-chain-algorand/blockchain')
            >()
        return {
            ...actual,
            useTransactionDetailQuery: (
                ...args: Parameters<typeof actual.useTransactionDetailQuery>
            ) => mockUseTransactionDetailQuery(...args),
        }
    },
)

const historyItem: TransactionHistoryItem = {
    id: 'TX123',
    txType: 'pay',
    sender: 'SENDER_ADDR',
    receiver: 'RECEIVER_ADDR',
    assetSender: null,
    confirmedRound: 41_065_416,
    roundTime: 1_752_576_000,
    chainData: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    amount: new Decimal(2_500_000),
    asset: null,
    balanceImpacts: [],
}

const mockRefetch = vi.fn()

const queryResult = (overrides: Record<string, unknown>) => ({
    data: undefined,
    isLoading: false,
    isPaused: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
})

describe('useTransactionDetailsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseTransactionDetailQuery.mockReturnValue(queryResult({}))
        routeParams.current = { scope: ALGORAND_SCOPE }
        useNetworkStatusStore.getState().setHasInternet(true)
        historyChainAdapters.reset()
        historyChainAdapters.register(algorandHistoryAdapter)
        restoreAlgorandOnlyChains()
    })

    it('renders content from the threaded history row while the fetch is paused offline', () => {
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX123',
            historyTransaction: historyItem,
        }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isPaused: true }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState.kind).toBe('content')
        if (result.current.renderState.kind === 'content') {
            const { family, transaction: native } =
                result.current.renderState.transaction
            const transaction = native as PeraDisplayableTransaction
            expect(family).toBe('algorand')
            expect(transaction.id).toBe('TX123')
            expect(transaction.paymentTransaction?.amount).toBe(2_500_000n)
        }
    })

    it('shows the offline state when paused with no local data', () => {
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX_UNKNOWN',
        }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isPaused: true }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState).toEqual({ kind: 'offline' })
    })

    it('shows typed error copy when the fetch fails', () => {
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX_UNKNOWN',
        }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({
                isError: true,
                error: new PeraNetworkError('timeout'),
            }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState).toEqual({
            kind: 'error',
            titleKey: 'errors.network.timeout.title',
            bodyKey: 'errors.network.timeout.body',
        })
    })

    it('prefers the offline state over a stale error when the device is offline', () => {
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX_UNKNOWN',
        }
        // The query carries a prior non-offline error (e.g. a timeout from
        // before connectivity dropped); offline must win so the Retry isn't dead.
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({
                isError: true,
                error: new PeraNetworkError('timeout'),
            }),
        )
        useNetworkStatusStore.getState().setHasInternet(false)

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState).toEqual({ kind: 'offline' })
    })

    it('falls back to generic error copy for untyped errors', () => {
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX_UNKNOWN',
        }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isError: true, error: new Error('boom') }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState).toEqual({
            kind: 'error',
            titleKey: 'errors.general.title',
            bodyKey: 'errors.general.body',
        })
    })

    it('shows loading while fetching without any local data', () => {
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX_UNKNOWN',
        }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isLoading: true }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState).toEqual({ kind: 'loading' })
    })

    it('prefers the fetched (enriched) transaction over the local row when online', () => {
        const fetched = {
            id: 'TX123',
            txType: 'pay',
            note: new Uint8Array([1]),
        } as unknown as PeraDisplayableTransaction
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX123',
            historyTransaction: historyItem,
        }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ data: { family: 'algorand', transaction: fetched } }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState.kind).toBe('content')
        if (result.current.renderState.kind === 'content') {
            expect(result.current.renderState.transaction).toEqual({
                family: 'algorand',
                transaction: fetched,
            })
        }
    })

    it('keeps the signing-flow object path authoritative and disables the fetch', () => {
        const paramTransaction = {
            id: undefined,
            txType: 'pay',
        } as unknown as PeraDisplayableTransaction
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transaction: { family: 'algorand', transaction: paramTransaction },
        }

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState.kind).toBe('content')
        if (result.current.renderState.kind === 'content') {
            expect(result.current.renderState.transaction).toEqual({
                family: 'algorand',
                transaction: paramTransaction,
            })
        }
        expect(mockUseTransactionDetailQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false }),
        )
    })

    it('retries via the query refetch when online', () => {
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX_UNKNOWN',
        }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isError: true, error: new Error('boom') }),
        )

        const { result } = renderHook(() => useTransactionDetailsScreen())
        act(() => {
            result.current.handleRetry()
        })

        expect(mockRefetch).toHaveBeenCalledTimes(1)
    })

    it('short-circuits retry while offline instead of firing a doomed refetch', () => {
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX_UNKNOWN',
        }
        mockUseTransactionDetailQuery.mockReturnValue(
            queryResult({ isPaused: true }),
        )
        useNetworkStatusStore.getState().setHasInternet(false)

        const { result } = renderHook(() => useTransactionDetailsScreen())
        act(() => {
            result.current.handleRetry()
        })

        expect(mockRefetch).not.toHaveBeenCalled()
    })

    it('returns the route group id for the group panel to read', () => {
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX123',
            historyTransaction: historyItem,
            groupId: 'GROUP1',
        }

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.groupId).toBe('GROUP1')
    })

    it('pushes the related transaction as tagged', () => {
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX123',
            historyTransaction: historyItem,
            groupId: 'GROUP1',
        }

        const { result } = renderHook(() => useTransactionDetailsScreen())
        const inner = { id: 'INNER' } as unknown as PeraDisplayableTransaction
        act(() => {
            result.current.handleRelatedTransactionPress({
                family: 'algorand',
                transaction: inner,
            })
        })

        expect(mockPush).toHaveBeenCalledWith('TransactionDetails', {
            scope: ALGORAND_SCOPE,
            transaction: { family: 'algorand', transaction: inner },
            groupId: 'GROUP1',
        })
    })

    it('fetches nothing for a chain whose UI registers no detail fetch', () => {
        getProvider().chains.register(
            { ...fixtureEthereumDescriptor, family: 'evm' },
            allCapabilities(false),
        )
        routeParams.current = {
            scope: ETHEREUM_SCOPE,
            transactionId: '0xabc',
        }

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(mockUseTransactionDetailQuery).not.toHaveBeenCalled()
        expect(result.current.renderState).toEqual({
            kind: 'error',
            titleKey: 'transactions.unknown.title',
            bodyKey: 'transactions.unknown.body',
        })
    })

    it("renders a fetchless chain's detail from its history row", () => {
        getProvider().chains.register(
            { ...fixtureEthereumDescriptor, family: 'evm' },
            allCapabilities(false),
        )
        const native = { family: 'evm', transaction: { hash: '0xabc' } }
        historyChainAdapters.register({
            ...algorandHistoryAdapter,
            chainId: ETHEREUM_CHAIN_ID,
            toTransactionNative: () => native,
        } as unknown as typeof algorandHistoryAdapter)
        routeParams.current = {
            scope: ETHEREUM_SCOPE,
            transactionId: '0xabc',
            historyTransaction: { ...historyItem, id: '0xabc' },
        }

        const { result } = renderHook(() => useTransactionDetailsScreen())

        expect(result.current.renderState).toEqual({
            kind: 'content',
            transaction: native,
        })
    })

    it('tracks the detail screen with the Algorand chain', () => {
        routeParams.current = {
            scope: ALGORAND_SCOPE,
            transactionId: 'TX123',
        }

        renderHook(() => useTransactionDetailsScreen())

        expect(mockTrackScreen).toHaveBeenCalledOnce()
        expect(mockTrackScreen).toHaveBeenCalledWith(
            AnalyticsScreenName.TransactionDetail,
            { [AnalyticsMetadataKey.ChainId]: 'algorand' },
        )
    })

    it('tracks the detail screen with the Ethereum chain', () => {
        getProvider().chains.register(
            { ...fixtureEthereumDescriptor, family: 'evm' },
            allCapabilities(false),
        )
        routeParams.current = {
            scope: ETHEREUM_SCOPE,
            transactionId: '0xabc',
        }

        renderHook(() => useTransactionDetailsScreen())

        expect(mockTrackScreen).toHaveBeenCalledWith(
            AnalyticsScreenName.TransactionDetail,
            { [AnalyticsMetadataKey.ChainId]: 'ethereum' },
        )
    })

    describe('status notice', () => {
        it.each([
            ['pending', 'warning', 'transactions.notice.pending'],
            ['failed', 'error', 'transactions.notice.failed'],
            ['replaced', 'warning', 'transactions.notice.replaced'],
        ] as const)('flags a %s history row', (status, kind, titleKey) => {
            routeParams.current = {
                scope: ALGORAND_SCOPE,
                transactionId: 'TX123',
                historyTransaction: { ...historyItem, status },
            }

            const { result } = renderHook(() => useTransactionDetailsScreen())

            expect(result.current.notice).toMatchObject({
                kind,
                titleKey,
            })
        })

        it('says since when a pending row has been waiting', () => {
            routeParams.current = {
                scope: ALGORAND_SCOPE,
                transactionId: 'TX123',
                historyTransaction: { ...historyItem, status: 'pending' },
            }

            const { result } = renderHook(() => useTransactionDetailsScreen())

            expect(result.current.notice?.params?.since).toBeTruthy()
        })

        it('has none for a confirmed history row', () => {
            routeParams.current = {
                scope: ALGORAND_SCOPE,
                transactionId: 'TX123',
                historyTransaction: historyItem,
            }

            const { result } = renderHook(() => useTransactionDetailsScreen())

            expect(result.current.notice).toBeNull()
        })

        it('has none for a transaction opened outside history', () => {
            routeParams.current = {
                scope: ALGORAND_SCOPE,
                transactionId: 'TX123',
            }

            const { result } = renderHook(() => useTransactionDetailsScreen())

            expect(result.current.notice).toBeNull()
        })
    })

    describe('a suspected poisoning entry', () => {
        const REAL =
            '2SSSXMFNG55PKDGKJB7MLTGIRSIYAXFCJAWSQFD6C3M7L6JLG5NJIBTGAA'
        const LOOK_ALIKE =
            '2SSSXMBXVWYMJ33BCFI5PED5O7LMFJZWXXSAJCU44W5M4NP4Q5YIJBTGAA'
        const suspectedPoisoning = {
            transactionId: 'TX123',
            counterparty: LOOK_ALIKE,
            imitates: { address: REAL, source: 'contact', name: 'Alice' },
        }

        it('carries the marker and warns only before its counterparty is copied', async () => {
            registerAlgorandAddressCodec()
            mockRequestSheet.mockResolvedValue(undefined)
            routeParams.current = {
                scope: ALGORAND_SCOPE,
                transactionId: 'TX123',
                historyTransaction: historyItem,
                suspectedPoisoning,
            }

            const { result } = renderHook(() => useTransactionDetailsScreen())
            const { confirmReuse } = result.current.addressReuseGuard

            expect(result.current.suspectedPoisoning).toEqual(
                suspectedPoisoning,
            )
            await expect(confirmReuse(REAL)).resolves.toBe(true)
            expect(mockRequestSheet).not.toHaveBeenCalled()
            await expect(confirmReuse(LOOK_ALIKE)).resolves.toBe(false)
            expect(mockRequestSheet).toHaveBeenCalledTimes(1)
        })

        it('guards nothing on an entry opened without the marker', async () => {
            routeParams.current = {
                scope: ALGORAND_SCOPE,
                transactionId: 'TX123',
                historyTransaction: historyItem,
            }

            const { result } = renderHook(() => useTransactionDetailsScreen())

            expect(result.current.suspectedPoisoning).toBeUndefined()
            await expect(
                result.current.addressReuseGuard.confirmReuse(
                    suspectedPoisoning.counterparty,
                ),
            ).resolves.toBe(true)
            expect(mockRequestSheet).not.toHaveBeenCalled()
        })
    })
})
