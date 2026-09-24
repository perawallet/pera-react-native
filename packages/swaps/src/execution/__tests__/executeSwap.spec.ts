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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { PrepareTransactionsResult, SwapQuote } from '../../models'
import {
    executeSwap,
    type ExecuteSwapContext,
    type ExecuteSwapResult,
} from '../executeSwap'
import { requestSwapProposal } from '../swapExecutionHelpers'

const mockAddSignRequest = vi.fn()
const mockSubmitAndAutoRefreshOptions = vi.fn()
const mockAccountInformation = vi.fn()
const mockDecodeTransaction = vi.fn()
const mockDecodeSignedTransaction = vi.fn()
const mockEncodeSignedTransactions = vi.fn()
const mockSendRawTransaction = vi.fn()
const mockPrepareTransactions = vi.fn()
const mockUpdateSwapStatus = vi.fn()
const mockRegisterHandoff = vi.fn()
const mockOnProgress = vi.fn()
const mockIsMultisigAccount = vi.fn()
const mockIsAssetFrozen = vi.fn()
// Hoisted so they're initialized before the (hoisted) mock factories run.
const { mockValidate, mockComputeShortfall, mockGetOpenSubmissionAttempts } =
    vi.hoisted(() => ({
        mockValidate: vi.fn(),
        mockComputeShortfall: vi.fn(),
        mockGetOpenSubmissionAttempts: vi.fn(),
    }))

// Re-implements the few lines of `submitAndAutoRefresh` this flow relies on
// instead of importing the signing package, whose store graph the narrow
// shared mock below can't satisfy.
vi.mock('@perawallet/wallet-core-signing', () => ({
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
    getOpenSubmissionAttempts: mockGetOpenSubmissionAttempts,
    STALE_OPEN_ATTEMPT_MS: 60 * 60 * 1000,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    // Minimal mapping so the pre-sign quote validation has displayable txns;
    // the validator itself is mocked (`mockValidate`), so the shape is inert.
    mapToDisplayableTransaction: (tx: {
        sender?: { toString?: () => string }
    }) => ({ sender: tx?.sender?.toString?.() ?? 'SENDER' }),
    compactSignedResults: (signed: unknown[]) =>
        signed.filter(tx => tx !== null),
}))

// The validator and shortfall math are controllable collaborators here; their
// real behaviour is covered by their own specs.
vi.mock('../../utils/validateSwapGroupAgainstQuote', () => ({
    validateSwapGroupAgainstQuote: mockValidate,
}))
vi.mock('../../utils/computeSwapAlgoShortfall', () => ({
    computeSwapAlgoShortfall: mockComputeShortfall,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    isMultisigAccount: (account: unknown) => mockIsMultisigAccount(account),
    // Real predicate is `account.type === 'quantum'`.
    isQuantumAccount: (account: unknown) =>
        (account as { type?: string } | undefined)?.type === 'quantum',
    isAssetFrozen: (...args: unknown[]) => mockIsAssetFrozen(...args),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    decodeFromBase64: (b64: string) =>
        new Uint8Array(Buffer.from(b64, 'base64')),
    encodeToBase64: (bytes: Uint8Array) =>
        Buffer.from(bytes).toString('base64'),
    generateOrderedUniqueId: () => 'mock-id',
    logger: {
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

const SIGNING_SOURCE = {
    name: 'swap.signing.source_name',
    description: 'swap.signing.source_description',
}

const makeContext = (): ExecuteSwapContext => ({
    network: 'mainnet',
    algorandClient: {
        client: {
            algod: {
                sendRawTransaction: mockSendRawTransaction,
                accountInformation: (address: string) => ({
                    do: () => mockAccountInformation(address),
                }),
            },
        },
    } as unknown as ExecuteSwapContext['algorandClient'],
    assetMbr: 100_000n,
    deviceId: 'device-1',
    addSignRequest: mockAddSignRequest,
    decodeTransaction: mockDecodeTransaction,
    decodeSignedTransaction: mockDecodeSignedTransaction,
    encodeSignedTransactions: mockEncodeSignedTransactions,
    prepareTransactions: mockPrepareTransactions,
    updateSwapStatus: mockUpdateSwapStatus,
    registerHandoff: mockRegisterHandoff,
})

type RunOptions = {
    account?: Nullable<WalletAccount>
    // Defaults to `account` — the "not rekeyed" case where the resolved
    // signer IS the selected account.
    signer?: Nullable<WalletAccount>
    isQuantumSwapEnabled?: boolean
    isCancelled?: () => boolean
}

const run = (
    quote: SwapQuote,
    {
        account = null,
        signer = account,
        isQuantumSwapEnabled = false,
        isCancelled = () => false,
    }: RunOptions = {},
): Promise<ExecuteSwapResult> =>
    executeSwap(
        {
            quote,
            account,
            signer,
            isQuantumSwapEnabled,
            signingSource: SIGNING_SOURCE,
            onProgress: mockOnProgress,
            isCancelled,
        },
        makeContext(),
    )

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
        // unstamped or expired quotes before prepare.
        fetchedAt: Date.now(),
    }) as unknown as SwapQuote

const senderAccount = { address: 'SENDER_ADDR' } as unknown as WalletAccount

const quantumAccount: WalletAccount = {
    id: 'quantum-account-1',
    address: 'QUANTUM_ADDR',
    type: 'quantum',
    keyPairId: 'quantum-keypair-1',
}

// A standard account rekeyed to a quantum auth account: `type` stays 'algo25',
// but the resolved signer for it is the quantum account above — the exact case
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
// side therefore fails if the flow never asked about that side.
const freezeHoldings = (...frozenIds: string[]) =>
    mockIsAssetFrozen.mockImplementation(({ assetId }: { assetId: string }) =>
        Promise.resolve(frozenIds.includes(assetId)),
    )

const lastProgress = () => mockOnProgress.mock.calls.at(-1)?.[0]

describe('executeSwap', () => {
    beforeEach(() => {
        vi.clearAllMocks()

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
        autoApproveWith([makeSignedTxn('tx-id-1'), makeSignedTxn('tx-id-2')])
        mockEncodeSignedTransactions.mockReturnValue([
            new Uint8Array([10, 20]),
            new Uint8Array([30, 40]),
        ])
        mockSendRawTransaction.mockResolvedValue({ txid: 'submitted-tx-id' })
        mockPrepareTransactions.mockResolvedValue(makePrepareResult())
        // No open ledger row for this sender — the retry guard passes.
        mockGetOpenSubmissionAttempts.mockResolvedValue([])
        mockUpdateSwapStatus.mockResolvedValue({ status: 'in_progress' })
        mockIsMultisigAccount.mockReturnValue(false)
        freezeHoldings()
        // A healthy, funded account — the balance preflight passes.
        mockAccountInformation.mockResolvedValue({
            amount: 10_000_000n,
            minBalance: 100_000n,
            assets: [],
        })
        mockComputeShortfall.mockReturnValue(null)
    })

    it('executes full flow: prepare → pipeline sign → submit → update status', async () => {
        const result = await run(makeQuote('quote-123'))

        expect(result).toEqual({ kind: 'success', txIds: ['submitted-tx-id'] })
        expect(mockOnProgress.mock.calls.map(([p]) => p)).toEqual([
            'preparing',
            'signing',
            'submitting',
            'updating-status',
        ])
        expect(mockPrepareTransactions).toHaveBeenCalledWith({
            quote: 'quote-123',
        })

        expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
        const request = mockAddSignRequest.mock
            .calls[0][0] as TransactionSignRequest
        expect(request.type).toBe('transactions')
        expect(request.transport).toBe('callback')
        // Swap renders its own review and success UI, so its `sourceType`
        // must stay `'local'` (outside `INTERACTIVE_SOURCES`) to skip the
        // standard review/completion sheets.
        expect(request.sourceType).toBe('local')
        expect(request.sourceMetadata).toEqual(SIGNING_SOURCE)
        expect(request.txs).toHaveLength(2)
        // The signing-machine analyzer recomputes the group hash over
        // `groupContext`, so it must cover every slot of the prepare result.
        expect(request.groupContext).toHaveLength(2)

        expect(mockSendRawTransaction).toHaveBeenCalled()
        expect(mockUpdateSwapStatus).toHaveBeenCalledWith({
            swapId: '12345',
            data: {
                status: 'in_progress',
                submitted_transaction_ids: ['submitted-tx-id'],
                swap_version: 'v2',
            },
        })
    })

    it('merges pre-signed and user-signed txns in original order within a group', async () => {
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

        const result = await run(makeQuote('quote-mixed'))

        expect(result.kind).toBe('success')

        const request = mockAddSignRequest.mock
            .calls[0][0] as TransactionSignRequest
        expect(request.txs).toHaveLength(1)
        // groupContext must cover ALL 3 slots so the analyzer recomputes the
        // right group hash; without it every mixed-group swap fails with
        // `blockchain_error`.
        expect(request.groupContext).toHaveLength(3)

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

        const signedA = makeSignedTxn('a')
        const signedB = makeSignedTxn('b')
        autoApproveWith([signedA, signedB])

        mockSendRawTransaction
            .mockResolvedValueOnce({ txid: 'group-1-id' })
            .mockResolvedValueOnce({ txid: 'group-2-id' })

        const result = await run(makeQuote('quote-multi'))

        expect(result).toEqual({
            kind: 'success',
            txIds: ['group-1-id', 'group-2-id'],
        })
        expect(mockSendRawTransaction).toHaveBeenCalledTimes(2)
        // Group order is submission order: each group goes out on its own.
        expect(mockEncodeSignedTransactions.mock.calls).toEqual([
            [[signedA]],
            [[signedB]],
        ])
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

        const result = await run(makeQuote('quote-presigned'))

        expect(result.kind).toBe('success')
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockDecodeSignedTransaction).toHaveBeenCalled()
        expect(mockSendRawTransaction).toHaveBeenCalled()
    })

    it('refuses a stale quote before prepare and reports stale-quote', async () => {
        const staleQuote = {
            ...makeQuote('quote-stale'),
            // Well past SWAP_QUOTE_TTL_MS — e.g. the confirm sheet sat
            // behind an offline gap between quote and slide.
            fetchedAt: Date.now() - 10 * 60 * 1000,
        }

        const result = await run(staleQuote)

        expect(result).toEqual({ kind: 'stale-quote' })
        expect(mockPrepareTransactions).not.toHaveBeenCalled()
        expect(mockOnProgress).not.toHaveBeenCalled()
    })

    it('fails a quote with no id before any lookup', async () => {
        const result = await run(makeQuote(''), { account: senderAccount })

        expect(result).toEqual({
            kind: 'failed',
            failure: { phase: 'prepare', reason: 'missing-quote-id' },
        })
        expect(mockIsAssetFrozen).not.toHaveBeenCalled()
        expect(mockPrepareTransactions).not.toHaveBeenCalled()
    })

    // makeQuote trades assetIn '0' for assetOut '999'.
    it('refuses a frozen input asset before prepare', async () => {
        freezeHoldings('0')

        const result = await run(makeQuote('quote-frozen'), {
            account: senderAccount,
        })

        expect(result).toEqual({
            kind: 'failed',
            failure: { phase: 'prepare', reason: 'asset-frozen', assetId: '0' },
        })
        expect(mockPrepareTransactions).not.toHaveBeenCalled()
    })

    it('refuses a frozen OUTPUT asset — a frozen holding cannot receive either', async () => {
        freezeHoldings('999')

        const result = await run(makeQuote('quote-frozen-out'), {
            account: senderAccount,
        })

        expect(result).toEqual({
            kind: 'failed',
            failure: {
                phase: 'prepare',
                reason: 'asset-frozen',
                assetId: '999',
            },
        })
        expect(mockPrepareTransactions).not.toHaveBeenCalled()
    })

    it('reads holdings at execute time rather than from a balances subscription', async () => {
        await run(makeQuote('quote-reads-db'), { account: senderAccount })

        const asked = mockIsAssetFrozen.mock.calls.map(
            ([args]) => (args as { assetId: string }).assetId,
        )
        expect(asked).toEqual(['0', '999'])
        expect(mockIsAssetFrozen).toHaveBeenCalledWith({
            accountAddress: 'SENDER_ADDR',
            assetId: '0',
            network: 'mainnet',
        })
    })

    it('refuses to broadcast while an open swap attempt exists', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({ swapIdStr: 'SWAP1' }),
        )
        mockGetOpenSubmissionAttempts.mockResolvedValue([{}])

        const result = await run(makeQuote('quote-guard'))

        expect(result).toEqual({ kind: 'verifying-previous' })
        // Age-bounded: a row the reconciler can never settle must not block
        // every future swap for this sender.
        expect(mockGetOpenSubmissionAttempts).toHaveBeenCalledWith({
            network: 'mainnet',
            sender: 'SWAPPER',
            flows: ['swap', 'cosign'],
            unevaluatableBefore: expect.any(Number),
        })
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockSendRawTransaction).not.toHaveBeenCalled()
        expect(mockSubmitAndAutoRefreshOptions).not.toHaveBeenCalled()
        expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
    })

    it('proceeds once the previous attempt resolved', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({ swapIdStr: 'SWAP1' }),
        )
        mockGetOpenSubmissionAttempts.mockResolvedValue([])

        const result = await run(makeQuote('quote-clear'))

        expect(result.kind).toBe('success')
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
        // A refused retry goes stale, the form re-quotes, and prepare returns
        // a NEW swap_id — why the guard is sender-wide rather than keyed on
        // the swapId.
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({ swapIdStr: 'SWAP2' }),
        )
        mockGetOpenSubmissionAttempts.mockResolvedValue([
            { intentKey: { kind: 'swap', swapId: 'SWAP1' } },
        ])

        const result = await run(makeQuote('quote-requoted'))

        expect(result).toEqual({ kind: 'verifying-previous' })
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockSendRawTransaction).not.toHaveBeenCalled()
    })

    it('fails closed when the guard lookup itself errors', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({ swapIdStr: 'SWAP1' }),
        )
        mockGetOpenSubmissionAttempts.mockRejectedValue(new Error('db closed'))

        const result = await run(makeQuote('quote-db-error'))

        expect(result).toEqual({ kind: 'verifying-previous' })
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockSendRawTransaction).not.toHaveBeenCalled()
    })

    it('keys the guard on the selected account over the quote swapper', async () => {
        await run(makeQuote('quote-sender'), { account: senderAccount })

        expect(mockGetOpenSubmissionAttempts).toHaveBeenCalledWith(
            expect.objectContaining({ sender: 'SENDER_ADDR' }),
        )
        expect(mockSubmitAndAutoRefreshOptions).toHaveBeenCalledWith(
            expect.objectContaining({ sender: 'SENDER_ADDR' }),
        )
    })

    it('still runs the retry guard when prepareResult carries no swapId', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({ swapIdStr: '' }),
        )

        const result = await run(makeQuote('quote-no-swap-id'))

        expect(result.kind).toBe('success')
        expect(mockGetOpenSubmissionAttempts).toHaveBeenCalledWith({
            network: 'mainnet',
            sender: 'SWAPPER',
            flows: ['swap', 'cosign'],
            unevaluatableBefore: expect.any(Number),
        })
        // A blank swapId is no identity at all — recording `{swap:''}` would
        // put unrelated swaps under one intent key.
        expect(mockSubmitAndAutoRefreshOptions).toHaveBeenCalledWith(
            expect.objectContaining({ intentKey: undefined }),
        )
        // Nothing to report the status against.
        expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
    })

    it('abandons a cancelled execution after prepare settles, before signing', async () => {
        let releasePrepare: (value: unknown) => void = () => {}
        mockPrepareTransactions.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    releasePrepare = resolve
                }),
        )
        let isCancelled = false

        const resultPromise = run(makeQuote('quote-cancel'), {
            isCancelled: () => isCancelled,
        })
        await vi.waitFor(() =>
            expect(mockPrepareTransactions).toHaveBeenCalled(),
        )

        // The user closes the sheet while prepare is still in flight; when the
        // response lands, nothing may proceed to the signing pipeline.
        isCancelled = true
        releasePrepare({
            transactionGroups: [{ transactions: ['AA=='], purpose: 'swap' }],
        })

        expect(await resultPromise).toEqual({ kind: 'cancelled' })
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('reports a prepare rejection with its error for the display layer', async () => {
        const prepareError = new Error('Prepare failed')
        mockPrepareTransactions.mockRejectedValue(prepareError)

        const result = await run(makeQuote('quote-789'))

        expect(result).toEqual({
            kind: 'failed',
            failure: {
                phase: 'prepare',
                reason: 'prepare-failed',
                error: prepareError,
            },
        })
        // No swap exists yet, so there is nothing to report to the backend.
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
    })

    it('refuses a swap the account cannot fund before prepare, naming the shortfall', async () => {
        mockComputeShortfall.mockReturnValue(new Decimal(5000))

        const result = await run(makeQuote('quote-short'), {
            account: senderAccount,
        })

        expect(result).toEqual({
            kind: 'failed',
            failure: {
                phase: 'prepare',
                reason: 'insufficient-algo',
                shortfall: new Decimal(5000),
            },
        })
        expect(mockPrepareTransactions).not.toHaveBeenCalled()
        expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
    })

    it('feeds fresh chain state to the shortfall check and reserves the opt-in MBR when the receive asset is not held', async () => {
        mockAccountInformation.mockResolvedValue({
            amount: 700_000n,
            minBalance: 200_000n,
            assets: [{ assetId: 123n }],
        })

        await run(makeQuote('quote-optin-mbr'), { account: senderAccount })

        expect(mockAccountInformation).toHaveBeenCalledWith('SENDER_ADDR')
        const input = mockComputeShortfall.mock.calls[0][0] as {
            algoBalance: Decimal
            minBalance: Decimal
            optInMbr?: Decimal
        }
        expect(input.algoBalance.toString()).toBe('700000')
        expect(input.minBalance.toString()).toBe('200000')
        // assetOut '999' is not among the holdings, so the prepared group
        // will opt in and raise the MBR by the configured asset MBR.
        expect(input.optInMbr?.toString()).toBe('100000')
    })

    it('skips the opt-in reserve when the account already holds the receive asset', async () => {
        mockAccountInformation.mockResolvedValue({
            amount: 700_000n,
            minBalance: 200_000n,
            assets: [{ assetId: 999n }],
        })

        await run(makeQuote('quote-opted-in'), { account: senderAccount })

        const input = mockComputeShortfall.mock.calls[0][0] as {
            optInMbr?: Decimal
        }
        expect(input.optInMbr).toBeUndefined()
    })

    it('skips the opt-in reserve when the receive asset is ALGO', async () => {
        const quote = {
            ...makeQuote('quote-to-algo'),
            assetIn: { assetId: '999' },
            assetOut: { assetId: '0' },
        } as unknown as SwapQuote

        await run(quote, { account: senderAccount })

        const input = mockComputeShortfall.mock.calls[0][0] as {
            optInMbr?: Decimal
        }
        expect(input.optInMbr).toBeUndefined()
    })

    it('abandons a cancelled execution while the balance preflight is in flight', async () => {
        let releaseAccountInfo: (value: unknown) => void = () => {}
        mockAccountInformation.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    releaseAccountInfo = resolve
                }),
        )
        let isCancelled = false

        const resultPromise = run(makeQuote('quote-cancel-preflight'), {
            account: senderAccount,
            isCancelled: () => isCancelled,
        })
        // The frozen-holdings check awaits before the preflight; wait until
        // the lookup is actually in flight before cancelling.
        await vi.waitFor(() =>
            expect(mockAccountInformation).toHaveBeenCalled(),
        )

        isCancelled = true
        releaseAccountInfo({
            amount: 10_000_000n,
            minBalance: 100_000n,
            assets: [],
        })

        expect(await resultPromise).toEqual({ kind: 'cancelled' })
        expect(mockPrepareTransactions).not.toHaveBeenCalled()
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('reports preparing while the balance preflight runs', async () => {
        // `isCancellable` in the confirmation sheet is `status === 'preparing'`;
        // under 'idle' closing the sheet would dismiss instead of cancelling,
        // leaving the execution running headless.
        let releaseAccountInfo: (value: unknown) => void = () => {}
        mockAccountInformation.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    releaseAccountInfo = resolve
                }),
        )

        const resultPromise = run(makeQuote('quote-preflight-status'), {
            account: senderAccount,
        })
        await vi.waitFor(() =>
            expect(mockAccountInformation).toHaveBeenCalled(),
        )

        expect(lastProgress()).toBe('preparing')

        releaseAccountInfo({
            amount: 10_000_000n,
            minBalance: 100_000n,
            assets: [],
        })
        await resultPromise
    })

    it('proceeds to prepare when the balance lookup fails (the check is advisory)', async () => {
        mockAccountInformation.mockRejectedValue(new Error('node hiccup'))

        const result = await run(makeQuote('quote-preflight-down'), {
            account: senderAccount,
        })

        expect(result.kind).toBe('success')
        expect(mockComputeShortfall).not.toHaveBeenCalled()
        expect(mockPrepareTransactions).toHaveBeenCalled()
    })

    it('treats user rejection as a non-fatal cancellation (no failure report)', async () => {
        autoReject()

        const result = await run(makeQuote('quote-reject'))

        expect(result).toEqual({ kind: 'user-rejected' })
        expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
    })

    it('classifies an on-device Ledger reject arriving via the error callback as a cancellation', async () => {
        // Defense-in-depth: a device reject leaking through `error` instead of
        // `reject` must never post a phantom blockchain_error to the backend.
        const deviceReject = new Error(
            'Operation was rejected on the Ledger device',
        )
        deviceReject.name = 'LedgerUserRejectedError'
        autoError(deviceReject)

        const result = await run(makeQuote('quote-device-reject'))

        expect(result).toEqual({ kind: 'user-rejected' })
        expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
    })

    it('reports failure to backend when the pipeline errors', async () => {
        autoError(new Error('Pipeline boom'))

        const result = await run(makeQuote('quote-pipeline-error'))

        // The pipeline's raw text is not carried: it goes to the log only.
        expect(result).toEqual({
            kind: 'failed',
            failure: { phase: 'signing', reason: 'signing-failed' },
        })
        expect(mockUpdateSwapStatus).toHaveBeenCalledWith({
            swapId: '12345',
            data: {
                status: 'failed',
                reason: 'blockchain_error',
                swap_version: 'v2',
            },
        })
    })

    it('rejects a quantum swap on the backend fee contract, not on the signing layer', async () => {
        // A swap group interleaves backend PRE-SIGNED transactions with the
        // user's; raising the quantum fee forces a `grp` recompute that would
        // invalidate signatures the device can't recreate. The guard must fire
        // BEFORE the signing pipeline is ever invoked.
        const result = await run(makeQuote('quote-quantum'), {
            account: quantumAccount,
        })

        expect(result).toEqual({
            kind: 'failed',
            failure: {
                phase: 'signing',
                reason: 'quantum-blocked',
                translationKey: 'swap.execution.quantum_fee_unsupported',
            },
        })
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
        // The selected account is nominally 'algo25'; the guard must key off
        // the resolved EFFECTIVE signer, which here is quantum.
        const result = await run(makeQuote('quote-rekeyed-quantum'), {
            account: standardAccountRekeyedToQuantum,
            signer: quantumAccount,
        })

        expect(result).toEqual({
            kind: 'failed',
            failure: {
                phase: 'signing',
                reason: 'quantum-blocked',
                translationKey: 'swap.execution.quantum_fee_unsupported',
            },
        })
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('signs and submits for a quantum signer when the quantum-swap flag is on', async () => {
        // With `enable_quantum_swap` on, the backend prices the PQ fee
        // surcharge into the prepared groups, so the fee guard steps aside.
        const result = await run(makeQuote('quote-quantum-enabled'), {
            account: quantumAccount,
            isQuantumSwapEnabled: true,
        })

        expect(result.kind).toBe('success')
        expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
        expect(mockUpdateSwapStatus).not.toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'failed' }),
            }),
        )
    })

    it('signs and submits for a rekeyed-to-quantum sender when the quantum-swap flag is on', async () => {
        const result = await run(makeQuote('quote-rekeyed-quantum-enabled'), {
            account: standardAccountRekeyedToQuantum,
            signer: quantumAccount,
            isQuantumSwapEnabled: true,
        })

        expect(result.kind).toBe('success')
        expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
    })

    it('swaps successfully for a standard account that is NOT rekeyed', async () => {
        const standardAccount: WalletAccount = {
            id: 'standard-account-2',
            address: 'STANDARD_ADDR_2',
            type: 'algo25',
            keyPairId: 'standard-keypair-2',
        }

        const result = await run(makeQuote('quote-standard-not-rekeyed'), {
            account: standardAccount,
        })

        expect(result.kind).toBe('success')
        expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
    })

    it('guards the shared-account propose path for quantum proposers', async () => {
        // Without this guard `createMultisigStrategy`'s `extractSignatures`
        // would resolve `null` for a quantum result and the proposer would
        // POST an empty signature. Defence in depth: quantum accounts are
        // excluded from multisig elsewhere.
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
            translationKey: 'swap.execution.quantum_multisig_unsupported',
        })

        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('drops null slots before resolving', async () => {
        autoApproveWith([
            makeSignedTxn('tx-id-1'),
            null,
            makeSignedTxn('tx-id-2'),
        ] as unknown as PeraSignedTransaction[])

        const result = await run(makeQuote('quote-null-slot'))

        expect(result.kind).toBe('success')
        const encoded = mockEncodeSignedTransactions.mock
            .calls[0][0] as PeraSignedTransaction[]
        expect(encoded).toHaveLength(2)
    })

    it('reports a submission failure with its error and a failed status', async () => {
        const submitError = new Error('Submission failed')
        mockSendRawTransaction.mockRejectedValue(submitError)

        const result = await run(makeQuote('quote-submit-fail'))

        expect(result).toEqual({
            kind: 'failed',
            failure: {
                phase: 'submission',
                reason: 'submission-failed',
                error: submitError,
            },
        })
        expect(mockUpdateSwapStatus).toHaveBeenCalledWith({
            swapId: '12345',
            data: expect.objectContaining({ status: 'failed' }),
        })
    })

    it('still succeeds if status update fails (non-fatal)', async () => {
        mockUpdateSwapStatus.mockRejectedValue(
            new Error('Status update failed'),
        )

        const result = await run(makeQuote('quote-status-fail'))

        expect(result.kind).toBe('success')
    })

    it('swallows a failed failure report', async () => {
        autoError(new Error('Pipeline boom'))
        mockUpdateSwapStatus.mockRejectedValue(new Error('backend down'))

        const result = await run(makeQuote('quote-report-fail'))

        expect(result).toEqual({
            kind: 'failed',
            failure: { phase: 'signing', reason: 'signing-failed' },
        })
    })

    it('returns an error when no transaction groups are returned', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({ transactionGroups: [] }),
        )

        const result = await run(makeQuote('quote-empty'))

        expect(result).toEqual({
            kind: 'failed',
            failure: { phase: 'prepare', reason: 'no-transaction-groups' },
        })
    })

    it('fails closed (no signing) when the prepared group violates the quote', async () => {
        mockValidate.mockImplementationOnce(() => {
            throw new Error('Swap spends more of asset 7 than the quote allows')
        })

        const result = await run(makeQuote('quote-bad'))

        expect(result).toEqual({
            kind: 'failed',
            failure: { phase: 'prepare', reason: 'quote-mismatch' },
        })
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
        } as unknown as WalletAccount

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
            mockIsMultisigAccount.mockReturnValue(true)
            autoPropose({
                signRequestId: 'sign-req-1',
                rawTransactionsBase64: ['cmF3MQ==', 'cmF3Mg=='],
            })
        })

        it('proposes a sync sign-request and returns pending-cosign without submitting', async () => {
            const result = await run(makeQuote('quote-msig'), {
                account: multisigAccount,
            })

            expect(result).toEqual({ kind: 'pending-cosign' })
            expect(lastProgress()).toBe('signing')

            const request = mockAddSignRequest.mock
                .calls[0][0] as TransactionSignRequest
            expect(request.transportOptions?.multisig?.proposeMode).toBe('sync')
            expect(request.sourceMetadata).toEqual(SIGNING_SOURCE)
            // Proposer does NOT submit — the cosign resolver does that later.
            expect(mockSendRawTransaction).not.toHaveBeenCalled()
        })

        it('registers a handoff with the backend signRequestId and proposed raw txns', async () => {
            await run(makeQuote('quote-msig'), { account: multisigAccount })

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
                plan: [
                    {
                        slots: [
                            { kind: 'toSign', flatIndex: 0 },
                            { kind: 'toSign', flatIndex: 1 },
                        ],
                    },
                ],
                expectedRawTransactionsBase64: ['cmF3MQ==', 'cmF3Mg=='],
                registeredAt: expect.any(Number),
            })
        })

        it('a single-signer account still takes the normal inline submit flow', async () => {
            mockIsMultisigAccount.mockReturnValue(false)
            autoApproveWith([makeSignedTxn('tx-1'), makeSignedTxn('tx-2')])

            const result = await run(makeQuote('quote-single-signer'))

            expect(result.kind).toBe('success')
            expect(mockRegisterHandoff).not.toHaveBeenCalled()
            expect(mockSendRawTransaction).toHaveBeenCalled()
        })

        it('treats a rejected proposal as a cancellation (no failure report)', async () => {
            autoReject()

            const result = await run(makeQuote('quote-msig-reject'), {
                account: multisigAccount,
            })

            expect(result).toEqual({ kind: 'user-rejected' })
            expect(mockRegisterHandoff).not.toHaveBeenCalled()
            expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
        })

        it('guards the propose path when the multisig account is itself rekeyed to a quantum auth account', async () => {
            const result = await run(makeQuote('quote-msig-rekeyed-quantum'), {
                account: multisigAccount,
                signer: quantumAccount,
            })

            expect(result).toEqual({
                kind: 'failed',
                failure: {
                    phase: 'signing',
                    reason: 'quantum-blocked',
                    translationKey:
                        'swap.execution.quantum_multisig_unsupported',
                },
            })
            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(mockRegisterHandoff).not.toHaveBeenCalled()
        })

        it('keeps the quantum propose guard even when the quantum-swap flag is on', async () => {
            // The flag only lifts the FEE guard on the inline signing path;
            // quantum keys still can't take part in multisig signing.
            const result = await run(makeQuote('quote-msig-quantum-flag-on'), {
                account: multisigAccount,
                signer: quantumAccount,
                isQuantumSwapEnabled: true,
            })

            expect(result).toEqual({
                kind: 'failed',
                failure: {
                    phase: 'signing',
                    reason: 'quantum-blocked',
                    translationKey:
                        'swap.execution.quantum_multisig_unsupported',
                },
            })
            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(mockRegisterHandoff).not.toHaveBeenCalled()
        })
    })
})
