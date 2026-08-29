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
import type { TransactionSignRequest } from '../../models'

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

const mockAllAccounts = vi.fn<() => Array<{ address: string; type: string }>>(
    () => [
        { address: 'ADDR_A', type: 'algo25' },
        { address: 'ADDR_B', type: 'algo25' },
    ],
)
const mockCanSignWith = vi.fn<(account: { address: string }) => boolean>(
    () => true,
)

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => mockAllAccounts(),
        canSignWith: (account: { address: string }) => mockCanSignWith(account),
    }
})

const mockMapToDisplayable = vi.fn((tx: unknown) => tx)

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        mapToDisplayableTransaction: (tx: unknown) => mockMapToDisplayable(tx),
    }
})

import {
    useSigningPipeline,
    __resetDisplayDataCacheForTests,
} from '../useSigningPipeline'

beforeEach(() => {
    mockSigningRequest.currentRequest = undefined
    mockSigningRequest.currentActorRef = null
    mockSigningRequest.signAndSendRequest.mockReset()
    mockSigningRequest.rejectRequest.mockReset()
    mockSigningRequest.retryRequest.mockReset()
    mockAllAccounts.mockReturnValue([
        { address: 'ADDR_A', type: 'algo25' },
        { address: 'ADDR_B', type: 'algo25' },
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
            transport: 'algod',
            txs: [
                { sender: { toString: () => 'ADDR_A' }, fee: 1000n } as never,
            ],
        }
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())
        // `allTransactions` comes from mapToDisplayableTransaction which passes through
        expect(result.current.allTransactions).toHaveLength(1)
        expect(result.current.signableAddresses.size).toBeGreaterThan(0)
    })

    test('prefers groupContext over txs for display so partial atomic groups show fully', () => {
        const wallet = { sender: { toString: () => 'ADDR_A' }, fee: 1000n }
        const other = { sender: { toString: () => 'ADDR_B' }, fee: 1000n }
        const request: TransactionSignRequest = {
            id: 'req-2',
            type: 'transactions',
            transport: 'algod',
            // Wallet only signs slot 0; slot 1 is the other party's tx.
            txs: [wallet as never],
            groupContext: [wallet as never, other as never],
            signableIndices: [0],
        }
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())
        expect(result.current.allTransactions).toHaveLength(2)
        expect(result.current.signableIndices).toEqual(new Set([0]))
    })

    test('stamps isExternal on list items based on signableIndices', () => {
        // Three transactions without a group so they each become a
        // SingleTransactionItem directly (no group-expansion path).
        const tx0 = { sender: { toString: () => 'ADDR_A' }, fee: 1000n }
        const tx1 = { sender: { toString: () => 'ADDR_B' }, fee: 1000n }
        const tx2 = { sender: { toString: () => 'ADDR_A' }, fee: 1000n }
        const request: TransactionSignRequest = {
            id: 'req-external',
            type: 'transactions',
            transport: 'algod',
            // Wallet signs slots 0 and 2; slot 1 belongs to the other party.
            txs: [tx0 as never, tx2 as never],
            groupContext: [tx0 as never, tx1 as never, tx2 as never],
            signableIndices: [0, 2],
        }
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())

        // Three items, one per transaction (no grouping without a `group` field).
        expect(result.current.listItems).toHaveLength(3)
        expect(
            result.current.listItems.map(
                item => (item as { isExternal: boolean }).isExternal,
            ),
        ).toEqual([false, true, false])
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
            transport: 'algod',
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
            transport: 'algod',
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
            transport: 'algod',
            txs: [
                { sender: { toString: () => 'ADDR_A' }, fee: 1000n } as never,
                { sender: { toString: () => 'ADDR_A' }, fee: 1000n } as never,
            ],
        }
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())
        expect(result.current.signableIndices).toEqual(new Set([0, 1]))
    })

    // a dApp can set a foreign `sender` it never imported while
    // signing with a wallet-held account via `signerOverrides`. The rekey/close
    // warning (and its blocking gate) must follow the authorizing entity, and
    // the override is keyed by position in `txs` (the signable subset) — so the
    // pipeline must translate it into the full-group display index space via
    // `signableIndices` before gating.
    test('gates warnings on signerOverrides, translating subset index via signableIndices', () => {
        mockAllAccounts.mockReturnValue([{ address: 'ADDR_O', type: 'algo25' }])

        const otherPartyTx = { sender: 'OTHER', fee: 1000n }
        const foreignRekeyTx = {
            sender: 'FOREIGN_E',
            fee: 1000n,
            rekeyTo: { publicKey: new Uint8Array(32) },
        }
        const request: TransactionSignRequest = {
            id: 'req-override',
            type: 'transactions',
            transport: 'callback',
            // Wallet signs only the foreign-sender tx, authorized by ADDR_O.
            txs: [foreignRekeyTx as never],
            groupContext: [otherPartyTx as never, foreignRekeyTx as never],
            // foreignRekeyTx sits at group index 1; override is keyed by its
            // subset index 0.
            signableIndices: [1],
            signerOverrides: new Map([[0, 'ADDR_O']]),
        }
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())

        const rekeyWarnings = result.current.warnings.filter(
            w => w.type === 'rekey',
        )
        expect(rekeyWarnings).toHaveLength(1)
        expect(
            (rekeyWarnings[0] as { senderAddress: string }).senderAddress,
        ).toBe('FOREIGN_E')
    })

    test('does not warn for a foreign sender when no signerOverride authorizes it', () => {
        mockAllAccounts.mockReturnValue([{ address: 'ADDR_O', type: 'algo25' }])

        const foreignRekeyTx = {
            sender: 'FOREIGN_E',
            fee: 1000n,
            rekeyTo: { publicKey: new Uint8Array(32) },
        }
        const request: TransactionSignRequest = {
            id: 'req-no-override',
            type: 'transactions',
            transport: 'callback',
            txs: [foreignRekeyTx as never],
        }
        mockSigningRequest.currentRequest = request

        const { result } = renderHook(() => useSigningPipeline())

        expect(
            result.current.warnings.filter(w => w.type === 'rekey'),
        ).toHaveLength(0)
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
            { address: 'SIGNER', type: 'algo25' },
            { address: 'WATCH', type: 'watch' },
            { address: 'REKEYED_UNSIGNABLE', type: 'watch' },
        ])
        mockCanSignWith.mockImplementation(a => a.address === 'SIGNER')

        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            transport: 'algod',
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
        mockAllAccounts.mockReturnValue([
            { address: 'A', type: 'watch' },
            { address: 'B', type: 'watch' },
        ])
        mockCanSignWith.mockReturnValue(false)

        mockSigningRequest.currentRequest = {
            id: 'req-1',
            type: 'transactions',
            transport: 'algod',
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
            transport: 'algod',
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
                    groupSignerTypes: new Map([['g0', 'localKey']]),
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
                allAccounts: [{ address: 'A123', type: 'algo25' }],
                groupSignerTypes: new Map([['A123', 'localKey']]),
                request: {
                    id: 'r1',
                    type: 'transactions',
                    sourceType: 'local',
                    transport: 'algod',
                    txs: [{}],
                },
                signableGroups: [{ signerAddress: 'A123' }],
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
        expect(result.current.resolved!.signerType).toBe('localKey')
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
