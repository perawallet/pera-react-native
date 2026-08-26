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
import { requestSwapProposal } from '../swapExecutionHelpers'
import type {
    PrepareTransactionsResult,
    SwapQuote,
} from '@perawallet/wallet-core-swaps'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    NoConnectionError,
    type Optional,
} from '@perawallet/wallet-core-shared'

const mockAddSignRequest = vi.fn()
const mockSubmitAndAutoRefreshOptions = vi.fn()
const mockDecodeTransaction = vi.fn()
const mockDecodeSignedTransaction = vi.fn()
const mockEncodeSignedTransactions = vi.fn()
const mockSendRawTransaction = vi.fn()
const mockPrepareTransactions = vi.fn()
const mockUpdateSwapStatus = vi.fn()
const mockRegisterHandoff = vi.fn()
const mockUseSelectedAccount = vi.fn()
const mockUseSignerFor = vi.fn()
const mockIsMultisigAccount = vi.fn()
const mockIsAssetFrozen = vi.fn()
// Hoisted so it's initialized before the (hoisted) wallet-core-swaps mock factory
// runs during the package import.
const { mockValidate } = vi.hoisted(() => ({ mockValidate: vi.fn() }))
// Same reason as mockValidate: the wallet-core-signing factory references
// `getOpenSubmissionAttemptsForIntent` as an eager property, not inside a
// function body, so a plain const would still be in TDZ when it runs.
const {
    mockGetOpenSubmissionAttemptsForIntent,
    mockGetOpenSubmissionAttempts,
} = vi.hoisted(() => ({
    mockGetOpenSubmissionAttemptsForIntent: vi.fn(),
    mockGetOpenSubmissionAttempts: vi.fn(),
}))

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
    SubmissionError: class SubmissionError extends Error {
        readonly metadata = { retryable: true }
        constructor(
            readonly txIds: string[],
            readonly classification: string,
            readonly algodError: unknown,
        ) {
            super(`Submission ${classification}`)
        }
    },
    submitAndAutoRefresh: async (
        _algokit: unknown,
        encodeSignedTransactions: (
            txns: PeraSignedTransaction[],
        ) => Uint8Array[],
        signedTxns: PeraSignedTransaction[],
        options?: unknown,
    ): Promise<string[]> => {
        mockSubmitAndAutoRefreshOptions(options)
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
    getOpenSubmissionAttemptsForIntent: mockGetOpenSubmissionAttemptsForIntent,
    getOpenSubmissionAttempts: mockGetOpenSubmissionAttempts,
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
    // Default (set in beforeEach) mirrors the "not rekeyed" case: the
    // resolved signer IS the selected account. Tests exercising a
    // rekeyed-to-quantum sender override this independently of
    // `mockUseSelectedAccount`, matching the real `useSignerFor` contract
    // where the resolved signer can differ from the address's own account.
    useSignerFor: () => mockUseSignerFor(),
    isMultisigAccount: (account: unknown) => mockIsMultisigAccount(account),
    // Real predicate is `account.type === 'quantum'` — mirrored narrowly here
    // rather than mocked with a spy since every test that needs it exercises
    // the guard against a fixed `quantumAccount` fixture below.
    isQuantumAccount: (account: unknown) =>
        (account as { type?: string } | undefined)?.type === 'quantum',
    isAssetFrozen: (...args: unknown[]) => mockIsAssetFrozen(...args),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-1',
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
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
        error: vi.fn(),
    },
    getNetworkErrorMessageKeys: () => ({
        titleKey: 'errors.network.no_connection.title',
        bodyKey: 'errors.network.no_connection.body',
    }),
    isPeraNetworkError: () => false,
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

const quantumAccount: WalletAccount = {
    id: 'quantum-account-1',
    address: 'QUANTUM_ADDR',
    type: 'quantum',
    keyPairId: 'quantum-keypair-1',
}

// A standard (non-quantum) account rekeyed to a quantum auth account:
// `type` stays 'algo25' (its own nominal kind), but the wallet's resolved
// signer for it is the quantum account above — the exact case
// `isQuantumAccount(account)` alone would miss.
const standardAccountRekeyedToQuantum: WalletAccount = {
    id: 'standard-account-1',
    address: 'STANDARD_ADDR',
    type: 'algo25',
    keyPairId: 'standard-keypair-1',
    rekeyAddress: quantumAccount.address,
}

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

// Answers per asset, like the real `isAssetFrozen`. A test asserting a frozen
// side therefore fails if the hook never asked about that side.
const freezeHoldings = (...frozenIds: string[]) =>
    mockIsAssetFrozen.mockImplementation(({ assetId }: { assetId: string }) =>
        Promise.resolve(frozenIds.includes(assetId)),
    )

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

        // Default: no open ledger row for the intent or the sender — the
        // retry guard passes and execution proceeds.
        mockGetOpenSubmissionAttemptsForIntent.mockResolvedValue([])
        mockGetOpenSubmissionAttempts.mockResolvedValue([])

        // Default: status update succeeds
        mockUpdateSwapStatus.mockResolvedValue({ status: 'in_progress' })

        // Default: single-signer account — the normal inline sign → submit
        // flow. The shared-account branch only triggers for multisig senders.
        mockUseSelectedAccount.mockReturnValue(undefined)
        mockIsMultisigAccount.mockReturnValue(false)
        // Default: resolved signer mirrors the selected account (the "not
        // rekeyed" case). Rekey tests override this independently.
        mockUseSignerFor.mockImplementation(() => mockUseSelectedAccount())

        // Default: nothing held is frozen. The gate reads holdings on
        // every execute.
        freezeHoldings()
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

    // makeQuote trades assetIn '0' for assetOut '999'.
    it('refuses a frozen input asset before prepare, with the shared AssetFrozenError copy', async () => {
        mockUseSelectedAccount.mockReturnValue({ address: 'SENDER_ADDR' })
        freezeHoldings('0')
        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-frozen'))
        })

        // Same keys the send path resolves, so the toast is titled "Asset
        // frozen" rather than the generic swap headline.
        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'errors.algod.asset_frozen.body',
            title: 'errors.algod.asset_frozen.title',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error).toEqual({
            phase: 'prepare',
            message: 'errors.algod.asset_frozen.body',
        })
        expect(mockPrepareTransactions).not.toHaveBeenCalled()
    })

    it('refuses a frozen OUTPUT asset — a frozen holding cannot receive either', async () => {
        mockUseSelectedAccount.mockReturnValue({ address: 'SENDER_ADDR' })
        freezeHoldings('999')
        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(
                makeQuote('quote-frozen-out'),
            )
        })

        expect(outcome).toMatchObject({
            kind: 'error',
            phase: 'prepare',
            title: 'errors.algod.asset_frozen.title',
        })
        expect(mockPrepareTransactions).not.toHaveBeenCalled()
    })

    it('reads holdings at execute time rather than from a balances subscription', async () => {
        mockUseSelectedAccount.mockReturnValue({ address: 'SENDER_ADDR' })

        const { result } = renderHook(() => useSwapExecution())
        await act(async () => {
            await result.current.execute(makeQuote('quote-reads-db'))
        })

        // Both sides of the quote get asked about.
        const asked = mockIsAssetFrozen.mock.calls.map(
            ([args]) => (args as { assetId: string }).assetId,
        )
        expect(asked).toEqual(['0', '999'])
        expect(mockIsAssetFrozen).toHaveBeenCalledWith({
            accountAddress: 'SENDER_ADDR',
            assetId: '0',
            network: expect.anything(),
        })
    })

    it('refuses to broadcast while an open swap attempt exists', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({ swapIdStr: 'SWAP1' }),
        )
        mockGetOpenSubmissionAttemptsForIntent.mockResolvedValue([{}])
        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-guard'))
        })

        expect(outcome).toEqual({ kind: 'verifying-previous' })
        expect(result.current.status).toBe('verifying')
        expect(mockGetOpenSubmissionAttemptsForIntent).toHaveBeenCalledWith({
            network: 'mainnet',
            sender: 'SWAPPER',
            intentKey: { kind: 'swap', swapId: 'SWAP1' },
        })
        // The rebuilt attempt must not sign, broadcast, or report anything.
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockSendRawTransaction).not.toHaveBeenCalled()
        expect(mockSubmitAndAutoRefreshOptions).not.toHaveBeenCalled()
        expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
    })

    it('proceeds once the previous attempt resolved', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({ swapIdStr: 'SWAP1' }),
        )
        mockGetOpenSubmissionAttemptsForIntent.mockResolvedValue([])

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-clear'))
        })

        expect(outcome).toEqual({ kind: 'success' })
        expect(result.current.status).toBe('success')
        expect(mockGetOpenSubmissionAttemptsForIntent).toHaveBeenCalledWith({
            network: 'mainnet',
            sender: 'SWAPPER',
            intentKey: { kind: 'swap', swapId: 'SWAP1' },
        })
        // The submit call carries the ledger metadata for this intent.
        expect(mockSubmitAndAutoRefreshOptions).toHaveBeenCalledWith({
            flow: 'swap',
            intentKey: { kind: 'swap', swapId: 'SWAP1' },
            sender: 'SWAPPER',
        })
        expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
        expect(mockSendRawTransaction).toHaveBeenCalled()
        expect(mockUpdateSwapStatus).toHaveBeenCalled()
    })

    it('refuses a re-quoted retry whose swapId no longer matches the open row', async () => {
        // The refusal path itself creates this case: the quote goes stale
        // within SWAP_QUOTE_TTL_MS, the form re-quotes, and prepare returns
        // a NEW backend swap_id — so the intent lookup misses the row it was
        // meant to catch. Only the sender-wide swap-flow check sees it.
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({ swapIdStr: 'SWAP2' }),
        )
        mockGetOpenSubmissionAttemptsForIntent.mockResolvedValue([])
        mockGetOpenSubmissionAttempts.mockResolvedValue([
            { intentKey: { kind: 'swap', swapId: 'SWAP1' } },
        ])

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-requoted'))
        })

        expect(outcome).toEqual({ kind: 'verifying-previous' })
        expect(mockGetOpenSubmissionAttempts).toHaveBeenCalledWith({
            network: 'mainnet',
            sender: 'SWAPPER',
            flow: 'swap',
        })
        // Nothing signed or broadcast — otherwise this is the double spend
        // the ledger exists to prevent.
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockSendRawTransaction).not.toHaveBeenCalled()
    })

    it('skips the retry guard when prepareResult carries no swapId', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({ swapIdStr: '' }),
        )
        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(
                makeQuote('quote-no-swap-id'),
            )
        })

        expect(outcome).toEqual({ kind: 'success' })
        expect(mockGetOpenSubmissionAttemptsForIntent).not.toHaveBeenCalled()
        // The sender-wide check still runs: it needs no swapId, and it is
        // the half of the guard that catches a re-quoted retry.
        expect(mockGetOpenSubmissionAttempts).toHaveBeenCalledWith({
            network: 'mainnet',
            sender: 'SWAPPER',
            flow: 'swap',
        })
        // A blank swapId is no identity at all — recording `{swap:''}` would
        // put unrelated swaps under one intent key.
        expect(mockSubmitAndAutoRefreshOptions).toHaveBeenCalledWith(
            expect.objectContaining({ intentKey: undefined }),
        )
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

        // Generic localized copy, not the pipeline's raw text — that goes to
        // the log only (PERA-4795).
        expect(outcome).toEqual({
            kind: 'error',
            phase: 'signing',
            message: 'swap.execution.error_body',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error?.phase).toBe('signing')
        expect(result.current.error?.message).toBe('swap.execution.error_body')
        expect(result.current.error?.message).not.toContain('Pipeline boom')

        expect(mockUpdateSwapStatus).toHaveBeenCalledWith({
            swapId: '12345',
            data: expect.objectContaining({
                status: 'failed',
                reason: 'blockchain_error',
            }),
        })
    })

    it('rejects a quantum swap on the backend fee contract, not on the signing layer', async () => {
        // Quantum swap is blocked for a server-side reason, not a signing-layer
        // one: a swap group interleaves backend PRE-SIGNED transactions with
        // the user's own, quantum accounts require a raised PQ minimum fee, and
        // raising the fee forces a `grp` recompute that would invalidate
        // signatures the backend already produced and the device can't
        // recreate. The guard must therefore fire on the account BEFORE the
        // signing pipeline is ever invoked (PQ-024 / PERA-4705 tracks the
        // backend-side fix).
        mockUseSelectedAccount.mockReturnValue(quantumAccount)

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-quantum'))
        })

        // `t` is mocked to echo its key, so this pins the exact i18n key the
        // user-facing message resolves through — the guard carries its own key
        // and must not collapse into the generic `swap.execution.error_body`
        // every other non-rejection failure resolves to.
        expect(outcome).toEqual({
            kind: 'error',
            phase: 'signing',
            message: 'swap.execution.quantum_fee_unsupported',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error?.message).toBe(
            'swap.execution.quantum_fee_unsupported',
        )

        // The signing pipeline must never be invoked — the block happens
        // before the request is ever built, not inside its approve callback.
        expect(mockAddSignRequest).not.toHaveBeenCalled()

        // Not a user cancellation, so the backend must still be told.
        expect(mockUpdateSwapStatus).toHaveBeenCalledWith({
            swapId: '12345',
            data: expect.objectContaining({
                status: 'failed',
                reason: 'blockchain_error',
            }),
        })
    })

    it('rejects a swap for a standard account rekeyed to a quantum auth account', async () => {
        // Regression: `isQuantumAccount` is a raw `type === 'quantum'` tag
        // check. The selected account here is nominally 'algo25' — checking
        // ITS type would let this sail past both guards. The guard must key
        // off the resolved EFFECTIVE signer (`useSignerFor`, one rekey hop),
        // which for this account resolves to the quantum auth account.
        mockUseSelectedAccount.mockReturnValue(standardAccountRekeyedToQuantum)
        mockUseSignerFor.mockReturnValue(quantumAccount)

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(
                makeQuote('quote-rekeyed-quantum'),
            )
        })

        // Same fee message as the direct-quantum case: the backend fee is
        // the actual blocker either way, regardless of how the quantum-ness
        // arrives.
        expect(outcome).toEqual({
            kind: 'error',
            phase: 'signing',
            message: 'swap.execution.quantum_fee_unsupported',
        })
        expect(result.current.status).toBe('error')
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('swaps successfully for a standard account that is NOT rekeyed', async () => {
        // Companion to the regression test above: resolving the effective
        // signer must not start rejecting ordinary, non-rekeyed swaps. The
        // resolved signer here is the account itself (no rekey hop).
        const standardAccount: WalletAccount = {
            id: 'standard-account-2',
            address: 'STANDARD_ADDR_2',
            type: 'algo25',
            keyPairId: 'standard-keypair-2',
        }
        mockUseSelectedAccount.mockReturnValue(standardAccount)
        mockUseSignerFor.mockReturnValue(standardAccount)

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(
                makeQuote('quote-standard-not-rekeyed'),
            )
        })

        expect(outcome).toEqual({ kind: 'success' })
        expect(result.current.status).toBe('success')
        expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
    })

    it('guards the shared-account propose path for quantum proposers', async () => {
        // `requestSwapProposal` feeds `createMultisigStrategy`'s
        // `extractSignatures`, which returns `null` for a quantum result —
        // without this guard a quantum proposer would silently POST an empty
        // signature to the backend. Quantum accounts are excluded from
        // multisig participation entirely elsewhere in the app, so this is
        // defence in depth, not the primary gate.
        await expect(
            requestSwapProposal(
                mockAddSignRequest,
                quantumAccount,
                { name: 'swap', description: 'swap' },
                [],
                [],
                vi.fn(),
            ),
        ).rejects.toMatchObject({
            name: 'QuantumSwapBlockedError',
            // The i18n key, not English prose — the display site renders it
            // through `t()`.
            translationKey: 'swap.execution.quantum_multisig_unsupported',
        })

        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('drops null slots before resolving', async () => {
        // Defensive narrowing: a null slot mixed in with real signed txns
        // must still be filtered out before resolving.
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
            // Submission-phase failures carry the resolved title through so
            // the toast headline matches the body (F1) instead of the
            // caller always rendering a hardcoded "Swap Failed".
            expect(outcome.title).toBe('errors.general.title')
        }
        expect(result.current.status).toBe('error')
        expect(result.current.error?.phase).toBe('submission')

        expect(mockUpdateSwapStatus).toHaveBeenCalledWith({
            swapId: '12345',
            data: expect.objectContaining({ status: 'failed' }),
        })
    })

    it('reports an unverified submission as status-unknown rather than a node rejection', async () => {
        // toAlgodError cannot read a SubmissionError, so the old getMessage path
        // fell through to unknown_node_error and claimed the network rejected a
        // transaction that may in fact be confirming.
        const { SubmissionError } =
            await import('@perawallet/wallet-core-signing')
        mockSendRawTransaction.mockRejectedValue(
            new (SubmissionError as unknown as new (
                txIds: string[],
                classification: string,
                algodError: unknown,
            ) => Error)(
                ['TXID'],
                'unknown-outcome',
                new Error('network_unavailable'),
            ),
        )

        const { result } = renderHook(() => useSwapExecution())

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            outcome = await result.current.execute(makeQuote('quote-unknown'))
        })

        expect(outcome?.kind).toBe('error')
        expect(result.current.error?.message).toBe(
            'errors.submission.unknown_outcome.body',
        )
        // F1: the honest unknown-outcome title must reach the outcome, not
        // just the body, or callers keep rendering "Swap Failed" over it.
        if (outcome?.kind === 'error') {
            expect(outcome.title).toBe(
                'errors.submission.unknown_outcome.title',
            )
        }
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

        it('guards the propose path when the multisig account is itself rekeyed to a quantum auth account', async () => {
            // A multisig account can carry its own `rekeyAddress` like any
            // other account. If it were rekeyed to a quantum auth account,
            // the resolved signer for it would be quantum even though
            // `multisigAccount.type` says nothing of the sort — the propose
            // guard must key off that resolved signer, not the raw account.
            mockUseSignerFor.mockReturnValue(quantumAccount)

            const { result } = renderHook(() => useSwapExecution())

            let outcome: Optional<SwapExecutionOutcome>
            await act(async () => {
                outcome = await result.current.execute(
                    makeQuote('quote-msig-rekeyed-quantum'),
                )
            })

            expect(outcome).toEqual({
                kind: 'error',
                phase: 'signing',
                message: expect.stringMatching(/quantum/i),
            })
            expect(result.current.status).toBe('error')
            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(mockRegisterHandoff).not.toHaveBeenCalled()
        })
    })
})
