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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    useSwapExecution,
    type SwapExecutionOutcome,
} from '../useSwapExecution'
import type {
    PrepareTransactionsResult,
    SwapQuote,
} from '@perawallet/wallet-core-swaps'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'
import {
    NoConnectionError,
    type Optional,
} from '@perawallet/wallet-core-shared'

const mockAddSignRequest = vi.fn()
const mockDecodeTransaction = vi.fn()
const mockDecodeSignedTransaction = vi.fn()
const mockEncodeSignedTransactions = vi.fn()
const mockSendRawTransaction = vi.fn()
const mockPrepareTransactions = vi.fn()
const mockUpdateSwapStatus = vi.fn()
const mockRegisterHandoff = vi.fn()
const mockUseSelectedAccount = vi.fn()
const mockIsMultisigAccount = vi.fn()
// Hoisted so it's initialized before the (hoisted) wallet-core-swaps mock factory
// runs during the package import.
const { mockValidate } = vi.hoisted(() => ({ mockValidate: vi.fn() }))

// We deliberately do NOT delegate to the real `submitAndAutoRefresh`
// via `vi.importActual` here. Importing the signing package transitively
// pulls in its store (`registerStore`, `createPersistStorage`, etc.), and
// the local `@perawallet/wallet-core-shared` mock below is intentionally
// narrow. Re-implementing the few lines here keeps this test isolated from
// the signing package's module graph.
vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({
        addSignRequest: mockAddSignRequest,
    }),
    submitAndAutoRefresh: async (
        _algokit: unknown,
        encodeSignedTransactions: (
            txns: PeraSignedTransaction[],
        ) => Uint8Array[],
        signedTxns: PeraSignedTransaction[],
    ): Promise<string[]> => {
        const encoded = encodeSignedTransactions(signedTxns)
        const response = (await mockSendRawTransaction(encoded)) as {
            txid?: string | string[]
        }
        const ids: string[] = []
        if (typeof response?.txid === 'string') {
            ids.push(response.txid)
        } else if (Array.isArray(response?.txid)) {
            ids.push(...response.txid)
        }
        if (ids.length === 0) {
            for (const signedTxn of signedTxns) {
                if (signedTxn.txn.txID) {
                    ids.push(signedTxn.txn.txID())
                }
            }
        }
        return ids
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => {
    class MockAlgodError extends Error {
        constructor(
            public readonly code: string,
            public readonly params: Record<string, unknown> = {},
            public readonly originalError?: Error,
        ) {
            super(`[algod:${code}] ${originalError?.message ?? code}`)
            this.name = 'AlgodError'
        }
    }
    return {
        useTransactionEncoder: () => ({
            decodeTransaction: mockDecodeTransaction,
            decodeSignedTransaction: mockDecodeSignedTransaction,
            encodeSignedTransactions: mockEncodeSignedTransactions,
        }),
        useAlgorandClient: () => ({
            client: {
                algod: {
                    sendRawTransaction: mockSendRawTransaction,
                },
            },
        }),
        useNetwork: () => ({ network: 'mainnet' }),
        AlgodError: MockAlgodError,
        toAlgodError: (err: unknown) =>
            new MockAlgodError(
                'unknown_node_error',
                { raw: err instanceof Error ? err.message : String(err) },
                err instanceof Error ? err : undefined,
            ),
        // Minimal mapping so the pre-sign quote validation has displayable txns;
        // the validator itself is mocked (`mockValidate`), so the shape is inert.
        mapToDisplayableTransaction: (tx: {
            sender?: { toString?: () => string }
        }) => ({ sender: tx?.sender?.toString?.() ?? 'SENDER' }),
        // Quantum accounts are only feature-flag-gated out of swap today —
        // there's no structural guard in this module. `swapExecutionHelpers`'
        // approve callback fails loudly if one ever shows up here (see the
        // dedicated quantum test below); the real predicate checks for
        // `pqSignedBytes`, which none of this spec's plain signed-txn
        // fixtures carry.
        isQuantumSignedTransaction: (tx: unknown) =>
            (tx as { pqSignedBytes?: unknown })?.pqSignedBytes instanceof
            Uint8Array,
        compactSignedResults: (signed: unknown[]) =>
            signed.filter(tx => tx !== null),
    }
})

// `validateSwapGroupAgainstQuote` is a controllable collaborator here — its real
// behavior is covered by the swaps package's own unit tests. Default: passes
// (no-op); a test opts into a rejection via `mockValidate.mockImplementationOnce`.
vi.mock('@perawallet/wallet-core-swaps', () => ({
    // Mirrors the real freshness contract (canonical spec:
    // packages/swaps quoteFreshness.spec.ts) — unstamped means stale.
    isQuoteFresh: (quote: { fetchedAt?: number }) =>
        quote.fetchedAt !== undefined && Date.now() - quote.fetchedAt <= 60_000,
    usePrepareTransactionsMutation: () => ({
        mutateAsync: mockPrepareTransactions,
    }),
    useUpdateSwapStatusMutation: () => ({
        mutateAsync: mockUpdateSwapStatus,
    }),
    validateSwapGroupAgainstQuote: mockValidate,
    useSwapHandoffStore: (
        selector: (state: {
            handoffs: Record<string, unknown>
            registerHandoff: typeof mockRegisterHandoff
            removeHandoff: () => void
            resetState: () => void
        }) => unknown,
    ) =>
        selector({
            handoffs: {},
            registerHandoff: mockRegisterHandoff,
            removeHandoff: vi.fn(),
            resetState: vi.fn(),
        }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => mockUseSelectedAccount(),
    isMultisigAccount: (account: unknown) => mockIsMultisigAccount(account),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-1',
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    concatBytes: (...arrays: Uint8Array[]) => {
        const totalLength = arrays.reduce((sum, a) => sum + a.length, 0)
        const result = new Uint8Array(totalLength)
        let offset = 0
        for (const arr of arrays) {
            result.set(arr, offset)
            offset += arr.length
        }
        return result
    },
    decodeFromBase64: (b64: string) =>
        new Uint8Array(Buffer.from(b64, 'base64')),
    encodeToBase64: (bytes: Uint8Array) =>
        Buffer.from(bytes).toString('base64'),
    generateOrderedUniqueId: () => 'mock-id',
    logger: {
        warn: vi.fn(),
    },
    // Thrown by the prepare mutation's `assertOnline()` guard when offline
    // (OFF-004). Kept minimal — this file only needs an identifiable error type.
    NoConnectionError: class NoConnectionError extends Error {
        constructor() {
            super('No network connection found')
            this.name = 'NoConnectionError'
        }
    },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

const makePrepareResult = (
    overrides: Partial<PrepareTransactionsResult> = {},
): PrepareTransactionsResult => ({
    transactionGroups: [
        {
            purpose: 'swap',
            transactions: ['dHhuMQ==', 'dHhuMg=='], // base64 for 'txn1', 'txn2'
        },
    ],
    swapId: '12345',
    swapIdStr: '12345',
    swapVersion: 'v2',
    ...overrides,
})

const makeQuote = (quoteIdStr: string): SwapQuote =>
    ({
        quoteIdStr,
        swapperAddress: 'SWAPPER',
        assetIn: { assetId: '0' },
        assetOut: { assetId: '999' },
        // Freshly stamped: the confirm-time freshness guard refuses
        // unstamped or expired quotes before prepare (PERA-4589).
        fetchedAt: Date.now(),
    }) as unknown as SwapQuote

const makeSignedTxn = (id: string): PeraSignedTransaction =>
    ({
        txn: { txID: () => id },
        sig: new Uint8Array([1]),
    }) as unknown as PeraSignedTransaction

/**
 * Configure addSignRequest so it auto-approves: as soon as the swap hook
 * registers the request, fire its `approve` callback with `signed`.
 */
const autoApproveWith = (signed: PeraSignedTransaction[]) => {
    mockAddSignRequest.mockImplementation((request: TransactionSignRequest) => {
        // Defer to the next microtask to mimic real pipeline behavior.
        void Promise.resolve().then(() => request.approve?.(signed))
    })
}

const autoReject = () => {
    mockAddSignRequest.mockImplementation((request: TransactionSignRequest) => {
        void Promise.resolve().then(() => request.reject?.())
    })
}

const autoError = (err: Error) => {
    mockAddSignRequest.mockImplementation((request: TransactionSignRequest) => {
        void Promise.resolve().then(() => request.error?.(err))
    })
}

describe('useSwapExecution', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Default: decodeTransaction returns a fake PeraTransaction
        mockDecodeTransaction.mockImplementation(
            () =>
                ({
                    sender: {
                        toString: () => 'SENDER',
                        publicKey: new Uint8Array(),
                    },
                    txID: () => 'mock-tx-id',
                }) as unknown as PeraTransaction,
        )

        // Default: pipeline auto-approves with two signed txns
        autoApproveWith([makeSignedTxn('tx-id-1'), makeSignedTxn('tx-id-2')])

        // Default: encode returns byte arrays
        mockEncodeSignedTransactions.mockReturnValue([
            new Uint8Array([10, 20]),
            new Uint8Array([30, 40]),
        ])

        // Default: algod returns tx IDs
        mockSendRawTransaction.mockResolvedValue({ txid: 'submitted-tx-id' })

        // Default: prepare returns valid result
        mockPrepareTransactions.mockResolvedValue(makePrepareResult())

        // Default: status update succeeds
        mockUpdateSwapStatus.mockResolvedValue({ status: 'in_progress' })

        // Default: single-signer account — the normal inline sign → submit
        // flow. The shared-account branch only triggers for multisig senders.
        mockUseSelectedAccount.mockReturnValue(undefined)
        mockIsMultisigAccount.mockReturnValue(false)
    })

    it('starts with idle status', () => {
        const { result } = renderHook(() => useSwapExecution())

        expect(result.current.status).toBe('idle')
        expect(result.current.error).toBeNull()
        expect(result.current.txIds).toEqual([])
    })

    it('executes full flow: prepare → pipeline sign → submit → update status', async () => {
        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-123'))
        })

        expect(outcome).toEqual({ kind: 'success' })
        expect(result.current.status).toBe('success')
        expect(mockPrepareTransactions).toHaveBeenCalledWith({
            quote: 'quote-123',
        })

        // The signing pipeline must be invoked exactly once with a
        // callback-transport request containing both unsigned txns.
        expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
        const request = mockAddSignRequest.mock
            .calls[0][0] as TransactionSignRequest
        expect(request.type).toBe('transactions')
        expect(request.transport).toBe('callback')
        // Swap is a headless-by-default flow: it renders its own review and
        // success UI, so its `sourceType` must stay `'local'` (outside
        // `INTERACTIVE_SOURCES`) to skip the standard review/completion
        // sheets.
        expect(request.sourceType).toBe('local')
        expect(request.txs).toHaveLength(2)
        // groupContext must cover every slot in the backend's prepare result
        // (all-unsigned in this case → same as `txs`). The signing-machine
        // analyzer recomputes the group hash over `groupContext`, so if we
        // ever stop passing it, swap groups with backend-pre-signed slots
        // will fail validation.
        expect(request.groupContext).toHaveLength(2)

        expect(mockSendRawTransaction).toHaveBeenCalled()
        expect(mockUpdateSwapStatus).toHaveBeenCalledWith({
            swapId: '12345',
            data: expect.objectContaining({
                status: 'in_progress',
                swap_version: 'v2',
            }),
        })
    })

    it('merges pre-signed and user-signed txns in original order within a group', async () => {
        // Group has 3 slots: [pre-signed, unsigned, pre-signed]
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({
                transactionGroups: [
                    {
                        purpose: 'swap',
                        signedTransactions: ['cHJlMQ==', null, 'cHJlMg=='],
                        transactions: [null, 'dHhuMg==', null],
                    },
                ],
            }),
        )

        const preSigned1 = makeSignedTxn('pre-1')
        const preSigned2 = makeSignedTxn('pre-2')
        const userSigned = makeSignedTxn('user-1')

        mockDecodeSignedTransaction
            .mockReturnValueOnce(preSigned1)
            .mockReturnValueOnce(preSigned2)

        autoApproveWith([userSigned])

        const { result } = renderHook(() => useSwapExecution())

        await act(async () => {
            await result.current.execute(makeQuote('quote-mixed'))
        })

        expect(result.current.status).toBe('success')

        // Pipeline should only see the one unsigned txn.
        const request = mockAddSignRequest.mock
            .calls[0][0] as TransactionSignRequest
        expect(request.txs).toHaveLength(1)
        // groupContext, on the other hand, must cover ALL 3 slots so the
        // analyzer recomputes the right group hash. This was the regression
        // that made every mixed-group swap fail with `blockchain_error`.
        expect(request.groupContext).toHaveLength(3)

        // Verify the encoder received the slots in the correct interleaved order.
        expect(mockEncodeSignedTransactions).toHaveBeenCalledTimes(1)
        const encoded = mockEncodeSignedTransactions.mock
            .calls[0][0] as PeraSignedTransaction[]
        expect(encoded).toEqual([preSigned1, userSigned, preSigned2])
    })

    it('submits multiple groups independently and aggregates txIds', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({
                transactionGroups: [
                    {
                        purpose: 'opt-in',
                        transactions: ['ZzE='], // 'g1'
                    },
                    {
                        purpose: 'swap',
                        transactions: ['ZzI='], // 'g2'
                    },
                ],
            }),
        )

        autoApproveWith([makeSignedTxn('a'), makeSignedTxn('b')])

        mockSendRawTransaction
            .mockResolvedValueOnce({ txid: 'group-1-id' })
            .mockResolvedValueOnce({ txid: 'group-2-id' })

        const { result } = renderHook(() => useSwapExecution())

        await act(async () => {
            await result.current.execute(makeQuote('quote-multi'))
        })

        expect(result.current.status).toBe('success')
        expect(mockSendRawTransaction).toHaveBeenCalledTimes(2)
        expect(result.current.txIds).toEqual(['group-1-id', 'group-2-id'])
    })

    it('handles fully pre-signed groups without invoking the pipeline', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({
                transactionGroups: [
                    {
                        purpose: 'fee',
                        signedTransactions: ['c2lnbmVk'], // 'signed'
                    },
                ],
            }),
        )

        mockDecodeSignedTransaction.mockReturnValue(makeSignedTxn('pre-signed'))

        const { result } = renderHook(() => useSwapExecution())

        await act(async () => {
            await result.current.execute(makeQuote('quote-presigned'))
        })

        expect(result.current.status).toBe('success')
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockDecodeSignedTransaction).toHaveBeenCalled()
        expect(mockSendRawTransaction).toHaveBeenCalled()
    })

    it('refuses a stale quote before prepare and reports stale-quote', async () => {
        const { result } = renderHook(() => useSwapExecution())

        const staleQuote = {
            ...makeQuote('quote-stale'),
            // Well past SWAP_QUOTE_TTL_MS — e.g. the confirm sheet sat
            // behind an offline gap between quote and slide.
            fetchedAt: Date.now() - 10 * 60 * 1000,
        }

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(staleQuote)
        })

        expect(outcome).toEqual({ kind: 'stale-quote' })
        expect(mockPrepareTransactions).not.toHaveBeenCalled()
        expect(result.current.status).toBe('idle')
    })

    it('abandons a cancelled execution after prepare settles, before signing', async () => {
        let releasePrepare: (value: unknown) => void = () => {}
        mockPrepareTransactions.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    releasePrepare = resolve
                }),
        )

        const { result } = renderHook(() => useSwapExecution())

        let outcomePromise: Promise<SwapExecutionOutcome> | undefined
        act(() => {
            outcomePromise = result.current.execute(makeQuote('quote-cancel'))
        })

        // The user closes the sheet while prepare is still in flight; when
        // the response lands, nothing may proceed to the signing pipeline.
        act(() => {
            result.current.cancel()
        })

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            releasePrepare({
                transactionGroups: [
                    { transactions: ['AA=='], purpose: 'swap' },
                ],
            })
            outcome = await outcomePromise
        })

        expect(outcome).toEqual({ kind: 'cancelled' })
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(result.current.status).toBe('idle')
    })

    it('sets error on prepare failure', async () => {
        mockPrepareTransactions.mockRejectedValue(new Error('Prepare failed'))

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-789'))
        })

        // Prepare maps the error through getMessage like the submission phase,
        // so the toAlgodError mock yields the localized unknown_node_error body.
        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'errors.algod.unknown_node_error.body',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error).toEqual({
            phase: 'prepare',
            message: 'errors.algod.unknown_node_error.body',
        })
    })

    it('surfaces a structured prepare error when offline (fail-fast, no signing)', async () => {
        // OFF-004: offline, the prepare mutation's `assertOnline()` guard
        // rejects before the transport instead of pausing. The hook must map
        // that into a structured `{ kind: 'error', phase: 'prepare' }` outcome
        // — the flow surfaces an error rather than hanging — and must never
        // advance to signing.
        mockPrepareTransactions.mockRejectedValue(new NoConnectionError())

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-offline'))
        })

        expect(outcome?.kind).toBe('error')
        if (outcome?.kind === 'error') {
            expect(outcome.phase).toBe('prepare')
        }
        expect(result.current.status).toBe('error')
        expect(result.current.error?.phase).toBe('prepare')

        // Failed fast: never reached signing, and (a prepare-phase failure)
        // never reported anything to the backend.
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
    })

    it('treats user rejection as a non-fatal cancellation (no failure report)', async () => {
        autoReject()

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-reject'))
        })

        expect(outcome).toEqual({ kind: 'cancelled' })
        expect(result.current.status).toBe('error')
        expect(result.current.error?.phase).toBe('signing')
        expect(result.current.error?.message).toBe(
            'swap.execution.user_rejected',
        )

        // Backend should NOT be told about a user-initiated cancel.
        expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
    })

    it('classifies an on-device Ledger reject arriving via the error callback as a cancellation', async () => {
        // Defense-in-depth: even if a device reject leaks through the
        // request's `error` callback instead of `reject`, it must never
        // post a phantom blockchain_error to the swap backend.
        const deviceReject = new Error(
            'Operation was rejected on the Ledger device',
        )
        deviceReject.name = 'LedgerUserRejectedError'
        autoError(deviceReject)

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(
                makeQuote('quote-device-reject'),
            )
        })

        expect(outcome).toEqual({ kind: 'cancelled' })
        expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
    })

    it('reports failure to backend when the pipeline errors', async () => {
        autoError(new Error('Pipeline boom'))

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(
                makeQuote('quote-pipeline-error'),
            )
        })

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'signing',
            message: 'Pipeline boom',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error?.phase).toBe('signing')
        expect(result.current.error?.message).toBe('Pipeline boom')

        expect(mockUpdateSwapStatus).toHaveBeenCalledWith({
            swapId: '12345',
            data: expect.objectContaining({
                status: 'failed',
                reason: 'blockchain_error',
            }),
        })
    })

    it('fails loudly instead of silently dropping a quantum-signed transaction', async () => {
        // Quantum accounts are only feature-flag-gated out of swap today —
        // there is no structural guard in this module preventing one from
        // routing into this flow. If a quantum-signed carrier ever comes
        // back from the pipeline, the approve callback must reject instead
        // of silently filtering it out, which would vanish signed slots and
        // corrupt the group downstream into an opaque submission crash.
        const quantumSigned = {
            txn: { txID: () => 'quantum-1' },
            pqSignedBytes: new Uint8Array([9, 9]),
        } as unknown as PeraSignedTransaction

        autoApproveWith([quantumSigned])

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-quantum'))
        })

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'signing',
            message: 'Quantum accounts are not supported in swap flows yet',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error?.message).toBe(
            'Quantum accounts are not supported in swap flows yet',
        )

        // Not a user cancellation, so the backend must still be told.
        expect(mockUpdateSwapStatus).toHaveBeenCalledWith({
            swapId: '12345',
            data: expect.objectContaining({
                status: 'failed',
                reason: 'blockchain_error',
            }),
        })
    })

    it('drops null slots before resolving without treating them as quantum', async () => {
        // Defensive narrowing: a null slot mixed in with real signed txns
        // must still be filtered out and must not trip the quantum guard.
        autoApproveWith([
            makeSignedTxn('tx-id-1'),
            null,
            makeSignedTxn('tx-id-2'),
        ] as unknown as PeraSignedTransaction[])

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-null-slot'))
        })

        expect(outcome).toEqual({ kind: 'success' })
        expect(result.current.status).toBe('success')
    })

    it('sets error on submission failure and reports failed status', async () => {
        mockSendRawTransaction.mockRejectedValue(new Error('Submission failed'))

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(
                makeQuote('quote-submit-fail'),
            )
        })

        expect(outcome?.kind).toBe('error')
        if (outcome?.kind === 'error') {
            expect(outcome.phase).toBe('submission')
        }
        expect(result.current.status).toBe('error')
        expect(result.current.error?.phase).toBe('submission')

        expect(mockUpdateSwapStatus).toHaveBeenCalledWith({
            swapId: '12345',
            data: expect.objectContaining({ status: 'failed' }),
        })
    })

    it('still succeeds if status update fails (non-fatal)', async () => {
        mockUpdateSwapStatus.mockRejectedValue(
            new Error('Status update failed'),
        )

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(
                makeQuote('quote-status-fail'),
            )
        })

        expect(outcome).toEqual({ kind: 'success' })
        expect(result.current.status).toBe('success')
    })

    it('resets state', async () => {
        mockPrepareTransactions.mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useSwapExecution())

        await act(async () => {
            await result.current.execute(makeQuote('quote-reset'))
        })

        expect(result.current.status).toBe('error')

        act(() => {
            result.current.reset()
        })

        expect(result.current.status).toBe('idle')
        expect(result.current.error).toBeNull()
        expect(result.current.txIds).toEqual([])
    })

    it('returns error when no transaction groups returned', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({ transactionGroups: [] }),
        )

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-empty'))
        })

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'No transaction groups returned',
        })
        expect(result.current.error?.phase).toBe('prepare')
        expect(result.current.error?.message).toBe(
            'No transaction groups returned',
        )
    })

    it('fails closed (no signing) when the prepared group violates the quote', async () => {
        // The validator rejects the prepared group (its real logic is covered by
        // the swaps package tests); the flow must not sign and must report failed.
        mockValidate.mockImplementationOnce(() => {
            throw new Error('Swap spends more of asset 7 than the quote allows')
        })

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-bad'))
        })

        expect(outcome?.kind).toBe('error')
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockUpdateSwapStatus).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'failed' }),
            }),
        )
    })

    describe('shared-account (multisig) swaps', () => {
        const multisigAccount = {
            address: 'JOINT_ADDR',
            multisigDetails: { threshold: 2, addresses: ['A', 'B'] },
        }

        /** Fire the request's onProposed as the propose transport would. */
        const autoPropose = (info: {
            signRequestId: string
            rawTransactionsBase64: string[]
        }) => {
            mockAddSignRequest.mockImplementation(
                (request: TransactionSignRequest) => {
                    void Promise.resolve().then(() =>
                        request.onProposed?.({
                            signRequestId: info.signRequestId,
                            status: 'pending',
                            rawTransactionsBase64: info.rawTransactionsBase64,
                        }),
                    )
                },
            )
        }

        beforeEach(() => {
            mockUseSelectedAccount.mockReturnValue(multisigAccount)
            mockIsMultisigAccount.mockReturnValue(true)
            autoPropose({
                signRequestId: 'sign-req-1',
                rawTransactionsBase64: ['cmF3MQ==', 'cmF3Mg=='],
            })
        })

        it('proposes a sync sign-request and returns pending-cosign without submitting', async () => {
            const { result } = renderHook(() => useSwapExecution())

            let outcome: Optional<SwapExecutionOutcome>
            await act(async () => {
                outcome = await result.current.execute(makeQuote('quote-msig'))
            })

            expect(outcome).toEqual({ kind: 'pending-cosign' })
            expect(result.current.status).toBe('pending-cosign')

            const request = mockAddSignRequest.mock
                .calls[0][0] as TransactionSignRequest
            expect(request.transportOptions?.multisig?.proposeMode).toBe('sync')
            // Proposer does NOT submit — the cosign resolver does that later.
            expect(mockSendRawTransaction).not.toHaveBeenCalled()
        })

        it('registers a handoff with the backend signRequestId and proposed raw txns', async () => {
            const { result } = renderHook(() => useSwapExecution())

            await act(async () => {
                await result.current.execute(makeQuote('quote-msig'))
            })

            expect(mockRegisterHandoff).toHaveBeenCalledTimes(1)
            const record = mockRegisterHandoff.mock.calls[0][0]
            expect(record).toMatchObject({
                swapIdStr: '12345',
                signRequestId: 'sign-req-1',
                network: 'mainnet',
                multisigAddress: 'JOINT_ADDR',
                deviceId: 'device-1',
                msigMetadata: {
                    version: 1,
                    threshold: 2,
                    addresses: ['A', 'B'],
                },
                expectedRawTransactionsBase64: ['cmF3MQ==', 'cmF3Mg=='],
            })
        })

        it('a single-signer account still takes the normal inline submit flow', async () => {
            mockUseSelectedAccount.mockReturnValue(undefined)
            mockIsMultisigAccount.mockReturnValue(false)
            autoApproveWith([makeSignedTxn('tx-1'), makeSignedTxn('tx-2')])

            const { result } = renderHook(() => useSwapExecution())

            let outcome: Optional<SwapExecutionOutcome>
            await act(async () => {
                outcome = await result.current.execute(
                    makeQuote('quote-single-signer'),
                )
            })

            expect(outcome).toEqual({ kind: 'success' })
            expect(mockRegisterHandoff).not.toHaveBeenCalled()
            expect(mockSendRawTransaction).toHaveBeenCalled()
        })
    })
})
