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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import {
    chainAccountOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { FeeAdjustment, TransactionSignRequest } from '../../models'
import {
    TEST_CHAIN_ID,
    algo25Account,
    watchAccount,
} from '../../__tests__/accounts'

const mockSigningRequest = {
    currentRequest: undefined as unknown,
    currentActorRef: null as unknown,
    signAndSendRequest: vi.fn(),
    rejectRequest: vi.fn(),
    retryRequest: vi.fn(),
}

vi.mock('../useSigningRequest', () => ({
    useSigningRequest: () => mockSigningRequest,
}))

const addressOf = (account: WalletAccount) =>
    chainAccountOf(account, TEST_CHAIN_ID)?.address

const mockAllAccounts = vi.fn<() => WalletAccount[]>(() => [
    algo25Account('ADDR_A'),
    algo25Account('ADDR_B'),
])
const mockCanSignWith = vi.fn<(account: WalletAccount) => boolean>(() => true)

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => mockAllAccounts(),
        canSignWith: (account: WalletAccount) => mockCanSignWith(account),
    }
})

const mockMapToDisplayable = vi.fn((tx: unknown) => tx)

import {
    fakeReviewerAdapter,
    registerFakeReviewerAdapter,
} from '../../__tests__/fakeReviewerAdapter'
import { reviewerChainAdapters } from '../../chain-adapter'
import {
    asUnsignedAlgorandTransaction,
    makeTestAddress,
    makeTestPaymentTx,
    makeUnsignedTransaction,
    SECOND_CHAIN_SCOPE,
} from '../../__tests__/transactions'
import {
    useSigningPipeline,
    __resetDisplayDataCacheForTests,
} from '../useSigningPipeline'

beforeEach(() => {
    registerFakeReviewerAdapter({
        toTransactionNative: tx =>
            mockMapToDisplayable(tx) as TransactionNative,
    })
    mockSigningRequest.currentRequest = undefined
    mockSigningRequest.currentActorRef = null
    mockSigningRequest.signAndSendRequest.mockReset()
    mockSigningRequest.rejectRequest.mockReset()
    mockSigningRequest.retryRequest.mockReset()
    mockAllAccounts.mockReturnValue([
        algo25Account('ADDR_A'),
        algo25Account('ADDR_B'),
    ])
    mockCanSignWith.mockReturnValue(true)
    mockMapToDisplayable.mockClear()
    __resetDisplayDataCacheForTests()
})

describe('useSigningPipeline', () => {
    test('returns empty data when there is no current request', () => {
        const { result } = renderHook(() => useSigningPipeline())
        expect(result.current.currentRequest).toBeUndefined()
        expect(result.current.stage).toBe('idle')
        expect(result.current.allTransactions).toEqual([])
        expect(result.current.listItems).toEqual([])
        expect(result.current.isLoading).toBe(false)
        expect(result.current.isRetryable).toBe(false)
    })

    test('next, fail, retry are no-ops with no request', () => {
        const { result } = renderHook(() => useSigningPipeline())
        result.current.next()
        result.current.fail()
        result.current.retry()
        expect(mockSigningRequest.signAndSendRequest).not.toHaveBeenCalled()
        expect(mockSigningRequest.rejectRequest).not.toHaveBeenCalled()
        expect(mockSigningRequest.retryRequest).not.toHaveBeenCalled()
    })

    test('next, fail, retry forward to useSigningRequest when request exists', () => {
        const request = {
            id: 'req-1',
            type: 'arbitrary-data',
            data: [],
        } as unknown
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())
        act(() => {
            result.current.next()
            result.current.fail()
            result.current.retry()
        })

        expect(mockSigningRequest.signAndSendRequest).toHaveBeenCalledWith(
            request,
        )
        expect(mockSigningRequest.rejectRequest).toHaveBeenCalledWith(request)
        expect(mockSigningRequest.retryRequest).toHaveBeenCalledWith(request)
    })

    test('computes display data for transaction requests', () => {
        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            chainId: 'algorand',
            transport: 'network',
            txs: [
                { sender: { toString: () => 'ADDR_A' }, fee: 1000n } as never,
            ],
        }
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())
        // `allTransactions` comes from mapToDisplayableTransaction which passes through
        expect(result.current.allTransactions).toHaveLength(1)
        // A planned chain answers signability through its own checks.
        expect(result.current.hasUnsignableTransaction).toBe(false)
        expect(result.current.signableAddresses.size).toBeGreaterThan(0)
    })

    describe('on a chain with no planner, which its own body reviews', () => {
        const request = {
            id: 'req-neutral',
            type: 'transactions',
            transport: 'network',
            txs: [makeUnsignedTransaction('0xFROM')],
        } satisfies TransactionSignRequest

        test("reviews each transaction through its chain's reviewer, and signs only those whose signer the wallet holds", () => {
            const LIST_ITEMS = [{ type: 'transaction' }] as never
            const createTransactionListItems = vi.fn(() => LIST_ITEMS)
            reviewerChainAdapters.register({
                ...fakeReviewerAdapter({
                    toTransactionNative: tx =>
                        mockMapToDisplayable(tx) as TransactionNative,
                    resolveAllSignerAddresses: req =>
                        'txs' in req
                            ? req.txs.map(
                                  tx => (tx.payload as { from: string }).from,
                              )
                            : [],
                    createTransactionListItems,
                    classifyRequestStructure: () => 'list',
                }),
                chainId: SECOND_CHAIN_SCOPE.chainId,
            })
            mockAllAccounts.mockReturnValue([
                {
                    id: 'eth',
                    custody: { kind: 'watch' },
                    chains: { ethereum: { address: '0xHELD' } },
                } as WalletAccount,
            ])
            const twoSigners = {
                ...request,
                txs: [
                    makeUnsignedTransaction('0xHELD'),
                    makeUnsignedTransaction('0xFOREIGN'),
                ],
            } satisfies TransactionSignRequest
            mockSigningRequest.currentRequest = twoSigners

            const { result } = renderHook(() => useSigningPipeline())

            expect(result.current.allTransactions).toEqual(twoSigners.txs)
            expect([...result.current.signableIndices]).toEqual([0])
            expect(createTransactionListItems).toHaveBeenCalledWith(
                twoSigners.txs,
                new Set([0]),
            )
            expect(result.current.listItems).toBe(LIST_ITEMS)
            expect(result.current.requestStructure).toBe('list')
            expect(result.current.totalFee.isZero()).toBe(true)
            expect(result.current.hasUnsignableTransaction).toBe(true)
        })

        test('flags a transaction its chain cannot read, though every one it reads is signable', () => {
            const unreadable = makeUnsignedTransaction('0xHELD')
            reviewerChainAdapters.register({
                ...fakeReviewerAdapter({
                    toTransactionNative: tx =>
                        tx === unreadable
                            ? null
                            : (tx as unknown as TransactionNative),
                    resolveAllSignerAddresses: () => ['0xHELD'],
                }),
                chainId: SECOND_CHAIN_SCOPE.chainId,
            })
            mockAllAccounts.mockReturnValue([
                {
                    id: 'eth',
                    custody: { kind: 'watch' },
                    chains: { ethereum: { address: '0xHELD' } },
                } as WalletAccount,
            ])
            const readable = makeUnsignedTransaction('0xHELD')
            mockSigningRequest.currentRequest = {
                ...request,
                txs: [readable, unreadable],
            } satisfies TransactionSignRequest

            const { result } = renderHook(() => useSigningPipeline())

            expect(result.current.allTransactions).toEqual([readable])
            expect([...result.current.signableIndices]).toEqual([0])
            expect(result.current.hasUnsignableTransaction).toBe(true)
        })

        test('flags nothing when the wallet holds every signer', () => {
            reviewerChainAdapters.register({
                ...fakeReviewerAdapter({
                    resolveAllSignerAddresses: () => ['0xHELD'],
                }),
                chainId: SECOND_CHAIN_SCOPE.chainId,
            })
            mockAllAccounts.mockReturnValue([
                {
                    id: 'eth',
                    custody: { kind: 'watch' },
                    chains: { ethereum: { address: '0xHELD' } },
                } as WalletAccount,
            ])
            mockSigningRequest.currentRequest = {
                ...request,
                txs: [makeUnsignedTransaction('0xHELD')],
            } satisfies TransactionSignRequest

            const { result } = renderHook(() => useSigningPipeline())

            expect(result.current.hasUnsignableTransaction).toBe(false)
        })

        test('shows nothing when no reviewer reads its chain', () => {
            mockSigningRequest.currentRequest = request

            const { result } = renderHook(() => useSigningPipeline())

            expect(result.current.allTransactions).toEqual([])
            expect(mockMapToDisplayable).not.toHaveBeenCalled()
        })
    })

    describe('on an Algorand chain-neutral request', () => {
        const [tx0, tx1, tx2] = [1n, 2n, 3n].map(amount =>
            asUnsignedAlgorandTransaction(
                makeTestPaymentTx(makeTestAddress(1), {
                    receiver: makeTestAddress(2),
                    amount,
                }),
            ),
        )
        const feeAdjustments: FeeAdjustment[] = [
            {
                index: 2,
                originalFee: 1000n,
                adjustedFee: 2000n,
                reason: 'quantum-minimum',
            },
        ]
        const request = {
            id: 'req-neutral-algorand',
            type: 'transactions',
            transport: 'callback',
            txs: [tx0, tx2],
            chainData: {
                algorand: {
                    groupContext: [tx0, tx1, tx2],
                    signableIndices: [0, 2],
                    signerOverrides: new Map([[1, 'AUTH']]),
                    feeAdjustments,
                },
            },
        } satisfies TransactionSignRequest

        test('reviews its full group from its Algorand group facts', () => {
            const adapter = registerFakeReviewerAdapter()
            mockSigningRequest.currentRequest = request

            const { result } = renderHook(() => useSigningPipeline())

            expect(adapter.toTransactionNative).toHaveBeenCalledTimes(3)
            expect(adapter.createTransactionListItems).toHaveBeenCalledWith(
                [tx0, tx1, tx2],
                new Set([0, 2]),
            )
            expect(result.current.signableIndices).toEqual(new Set([0, 2]))
            expect(result.current.feeAdjustments).toBe(feeAdjustments)
        })

        test("gates warnings on a signer override, at its transaction's slot in the full group", () => {
            const adapter = registerFakeReviewerAdapter()
            mockSigningRequest.currentRequest = request

            renderHook(() => useSigningPipeline())

            expect(adapter.aggregateTransactionWarnings).toHaveBeenCalledWith(
                [tx0, tx1, tx2],
                expect.any(Set),
                expect.any(Set),
                new Map([[2, 'AUTH']]),
            )
        })
    })

    test('shares the display transform across consumers — computes once per request', () => {
        const txs = [
            { sender: { toString: () => 'ADDR_A' }, fee: 1000n },
            { sender: { toString: () => 'ADDR_A' }, fee: 1000n },
            { sender: { toString: () => 'ADDR_A' }, fee: 1000n },
        ]
        const request: TransactionSignRequest = {
            id: 'shared-req',
            type: 'transactions',
            chainId: 'algorand',
            transport: 'network',
            txs: txs as never,
        }
        mockSigningRequest.currentRequest = request

        // Three independent consumers, mirroring the ~6-8 components that
        // call useSigningPipeline in the real signing-sheet tree.
        renderHook(() => useSigningPipeline())
        renderHook(() => useSigningPipeline())
        renderHook(() => useSigningPipeline())

        // mapToDisplayableTransaction runs once per txn for the FIRST
        // consumer; the rest hit the shared cache. Without sharing it would
        // be 3 consumers × 3 txns = 9 calls.
        expect(mockMapToDisplayable).toHaveBeenCalledTimes(3)
    })

    test('releases the shared cache when no request is active (no retention after the sheet closes)', () => {
        const txs = [{ sender: { toString: () => 'ADDR_A' }, fee: 1000n }]
        const request: TransactionSignRequest = {
            id: 'kept-req',
            type: 'transactions',
            chainId: 'algorand',
            transport: 'network',
            txs: txs as never,
        }
        mockSigningRequest.currentRequest = request

        const { rerender } = renderHook(() => useSigningPipeline())
        expect(mockMapToDisplayable).toHaveBeenCalledTimes(1)

        // Queue drains → the cache for the just-finished request is dropped.
        mockSigningRequest.currentRequest = undefined
        rerender()

        // The very same request object returns. If the cache had been
        // retained it would be served (0 calls); because it was released, the
        // transform runs again.
        mockMapToDisplayable.mockClear()
        mockSigningRequest.currentRequest = request
        rerender()
        expect(mockMapToDisplayable).toHaveBeenCalledTimes(1)
    })

    test('defaults signableIndices to all indices when groupContext is absent', () => {
        const request: TransactionSignRequest = {
            id: 'req-3',
            type: 'transactions',
            chainId: 'algorand',
            transport: 'network',
            txs: [
                { sender: { toString: () => 'ADDR_A' }, fee: 1000n } as never,
                { sender: { toString: () => 'ADDR_A' }, fee: 1000n } as never,
            ],
        }
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())
        expect(result.current.signableIndices).toEqual(new Set([0, 1]))
    })

    test('passes an empty authorizer map when there are no signerOverrides', () => {
        const adapter = registerFakeReviewerAdapter()
        mockSigningRequest.currentRequest = {
            id: 'req-no-override',
            type: 'transactions',
            chainId: 'algorand',
            transport: 'callback',
            txs: [{ sender: 'FOREIGN_E', fee: 1000n } as never],
        } satisfies TransactionSignRequest

        renderHook(() => useSigningPipeline())

        expect(adapter.aggregateTransactionWarnings).toHaveBeenCalledWith(
            expect.any(Array),
            expect.any(Set),
            expect.any(Set),
            new Map(),
        )
    })

    test("surfaces the adapter's warnings", () => {
        registerFakeReviewerAdapter({
            aggregateTransactionWarnings: vi.fn(() => [
                {
                    type: 'rekey',
                    senderAddress: 'FOREIGN_E',
                } as never,
            ]),
        })
        mockSigningRequest.currentRequest = {
            id: 'req-warn',
            type: 'transactions',
            chainId: 'algorand',
            transport: 'callback',
            txs: [{ sender: 'FOREIGN_E', fee: 1000n } as never],
        } satisfies TransactionSignRequest

        const { result } = renderHook(() => useSigningPipeline())

        expect(result.current.warnings.map(w => w.type)).toEqual(['rekey'])
    })

    test('subscribes to actor ref and derives stage from snapshot', () => {
        const subscriberCalls: Array<(s: unknown) => void> = []
        const actorRef = {
            subscribe: (cb: (s: unknown) => void) => {
                subscriberCalls.push(cb)
                return { unsubscribe: vi.fn() }
            },
        }
        mockSigningRequest.currentActorRef = actorRef

        const onEvent = vi.fn()
        const { result } = renderHook(() => useSigningPipeline({ onEvent }))

        // push a rejected snapshot
        act(() => {
            subscriberCalls[0]({
                matches: (s: string) => s === 'rejected',
                context: { error: null },
            })
        })

        expect(result.current.stage).toBe('rejected')
        expect(onEvent).toHaveBeenCalledWith({ type: 'signing_rejected' })
    })

    test('signableAddresses contains only accounts where canSignWith returns true', () => {
        mockAllAccounts.mockReturnValue([
            algo25Account('SIGNER'),
            watchAccount('WATCH'),
            watchAccount('REKEYED_UNSIGNABLE'),
        ])
        mockCanSignWith.mockImplementation(a => addressOf(a) === 'SIGNER')

        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            chainId: 'algorand',
            transport: 'network',
            txs: [],
        }
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())

        expect(result.current.signableAddresses.has('SIGNER')).toBe(true)
        expect(result.current.signableAddresses.has('WATCH')).toBe(false)
        expect(result.current.signableAddresses.has('REKEYED_UNSIGNABLE')).toBe(
            false,
        )
        expect(result.current.signableAddresses.size).toBe(1)
    })

    test('signableAddresses is empty when no accounts pass canSignWith', () => {
        mockAllAccounts.mockReturnValue([watchAccount('A'), watchAccount('B')])
        mockCanSignWith.mockReturnValue(false)

        mockSigningRequest.currentRequest = {
            id: 'req-1',
            type: 'transactions',
            chainId: 'algorand',
            transport: 'network',
            txs: [],
        } as TransactionSignRequest

        const { result } = renderHook(() => useSigningPipeline())
        expect(result.current.signableAddresses.size).toBe(0)
    })

    test('signableAddresses is empty when there are no accounts at all', () => {
        mockAllAccounts.mockReturnValue([])

        mockSigningRequest.currentRequest = {
            id: 'req-1',
            type: 'transactions',
            chainId: 'algorand',
            transport: 'network',
            txs: [],
        } as TransactionSignRequest

        const { result } = renderHook(() => useSigningPipeline())
        expect(result.current.signableAddresses.size).toBe(0)
    })

    test('isLoading is true during signing stage', () => {
        const subscriberCalls: Array<(s: unknown) => void> = []
        mockSigningRequest.currentActorRef = {
            subscribe: (cb: (s: unknown) => void) => {
                subscriberCalls.push(cb)
                return { unsubscribe: vi.fn() }
            },
        }
        const { result } = renderHook(() => useSigningPipeline())

        act(() => {
            subscriberCalls[0]({
                matches: (s: string) => s === 'signing',
                context: {
                    error: null,
                    groupSigners: new Map([
                        ['g0', { custody: 'local', scheme: 'ed25519' }],
                    ]),
                },
            })
        })

        expect(result.current.stage).toBe('signing')
        expect(result.current.isLoading).toBe(true)
    })

    test('exposes resolved when actor snapshot has populated context', () => {
        const subscriberCalls: Array<(s: unknown) => void> = []
        const initialSnapshot = {
            matches: (s: string) => s === 'awaiting_user',
            context: {
                signerAddress: 'A123',
                allAccounts: [algo25Account('A123')],
                groupSigners: new Map([
                    ['A123', { custody: 'local', scheme: 'ed25519' }],
                ]),
                request: {
                    id: 'r1',
                    type: 'transactions',
                    sourceType: 'local',
                    transport: 'network',
                    txs: [{}],
                },
                signableGroups: [{ signerAddress: 'A123' }],
                deps: {
                    scope: { chainId: TEST_CHAIN_ID, networkId: 'mainnet' },
                },
                error: null,
            },
        }
        const actorRef = {
            subscribe: (cb: (s: unknown) => void) => {
                subscriberCalls.push(cb)
                return { unsubscribe: vi.fn() }
            },
            getSnapshot: () => initialSnapshot,
        }
        mockSigningRequest.currentActorRef = actorRef

        const { result } = renderHook(() => useSigningPipeline())

        expect(result.current.resolved).not.toBeNull()
        expect(result.current.resolved!.signerType).toBe('local')
        expect(result.current.resolved!.kind).toMatchObject({
            type: 'transactions',
            isMultisigCosign: false,
            hasMultiple: false,
        })
    })

    test('resolved is null when no actor is active', () => {
        mockSigningRequest.currentActorRef = null
        const { result } = renderHook(() => useSigningPipeline())
        expect(result.current.resolved).toBeNull()
    })
})
