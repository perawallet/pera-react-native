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
import { useSwapExecution } from '../useSwapExecution'
import type { PrepareTransactionsResult } from '@perawallet/wallet-core-swaps'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'

const mockAddSignRequest = vi.fn()
const mockDecodeTransaction = vi.fn()
const mockDecodeSignedTransaction = vi.fn()
const mockEncodeSignedTransactions = vi.fn()
const mockSendRawTransaction = vi.fn()
const mockPrepareTransactions = vi.fn()
const mockUpdateSwapStatus = vi.fn()

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
                if (signedTxn.txn.txId) {
                    ids.push(signedTxn.txn.txId())
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
        AlgodError: MockAlgodError,
        toAlgodError: (err: unknown) =>
            new MockAlgodError(
                'unknown_node_error',
                { raw: err instanceof Error ? err.message : String(err) },
                err instanceof Error ? err : undefined,
            ),
    }
})

vi.mock('@perawallet/wallet-core-swaps', () => ({
    usePrepareTransactionsMutation: () => ({
        mutateAsync: mockPrepareTransactions,
    }),
    useUpdateSwapStatusMutation: () => ({
        mutateAsync: mockUpdateSwapStatus,
    }),
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
    generateOrderedUniqueId: () => 'mock-id',
    logger: {
        warn: vi.fn(),
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
    swapId: 12345,
    swapIdStr: '12345',
    swapVersion: 'v2',
    ...overrides,
})

const makeSignedTxn = (id: string): PeraSignedTransaction =>
    ({
        txn: { txId: () => id },
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
                    txId: () => 'mock-tx-id',
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
    })

    it('starts with idle status', () => {
        const { result } = renderHook(() => useSwapExecution())

        expect(result.current.status).toBe('idle')
        expect(result.current.error).toBeNull()
        expect(result.current.txIds).toEqual([])
    })

    it('executes full flow: prepare → pipeline sign → submit → update status', async () => {
        const { result } = renderHook(() => useSwapExecution())

        let success: boolean | undefined
        await act(async () => {
            success = await result.current.execute('quote-123')
        })

        expect(success).toBe(true)
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
        expect(request.sourceType).toBe('local')
        expect(request.headless).toBe(true)
        expect(request.txs).toHaveLength(2)

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
            await result.current.execute('quote-mixed')
        })

        expect(result.current.status).toBe('success')

        // Pipeline should only see the one unsigned txn.
        const request = mockAddSignRequest.mock
            .calls[0][0] as TransactionSignRequest
        expect(request.txs).toHaveLength(1)

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
            await result.current.execute('quote-multi')
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
            await result.current.execute('quote-presigned')
        })

        expect(result.current.status).toBe('success')
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockDecodeSignedTransaction).toHaveBeenCalled()
        expect(mockSendRawTransaction).toHaveBeenCalled()
    })

    it('sets error on prepare failure', async () => {
        mockPrepareTransactions.mockRejectedValue(new Error('Prepare failed'))

        const { result } = renderHook(() => useSwapExecution())

        let success: boolean | undefined
        await act(async () => {
            success = await result.current.execute('quote-789')
        })

        expect(success).toBe(false)
        expect(result.current.status).toBe('error')
        expect(result.current.error).toEqual({
            phase: 'prepare',
            message: 'Prepare failed',
        })
    })

    it('treats user rejection as a non-fatal cancellation (no failure report)', async () => {
        autoReject()

        const { result } = renderHook(() => useSwapExecution())

        let success: boolean | undefined
        await act(async () => {
            success = await result.current.execute('quote-reject')
        })

        expect(success).toBe(false)
        expect(result.current.status).toBe('error')
        expect(result.current.error?.phase).toBe('signing')
        expect(result.current.error?.message).toBe(
            'swap.execution.user_rejected',
        )

        // Backend should NOT be told about a user-initiated cancel.
        expect(mockUpdateSwapStatus).not.toHaveBeenCalled()
    })

    it('reports failure to backend when the pipeline errors', async () => {
        autoError(new Error('Pipeline boom'))

        const { result } = renderHook(() => useSwapExecution())

        let success: boolean | undefined
        await act(async () => {
            success = await result.current.execute('quote-pipeline-error')
        })

        expect(success).toBe(false)
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

    it('sets error on submission failure and reports failed status', async () => {
        mockSendRawTransaction.mockRejectedValue(new Error('Submission failed'))

        const { result } = renderHook(() => useSwapExecution())

        let success: boolean | undefined
        await act(async () => {
            success = await result.current.execute('quote-submit-fail')
        })

        expect(success).toBe(false)
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

        let success: boolean | undefined
        await act(async () => {
            success = await result.current.execute('quote-status-fail')
        })

        expect(success).toBe(true)
        expect(result.current.status).toBe('success')
    })

    it('resets state', async () => {
        mockPrepareTransactions.mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useSwapExecution())

        await act(async () => {
            await result.current.execute('quote-reset')
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

        let success: boolean | undefined
        await act(async () => {
            success = await result.current.execute('quote-empty')
        })

        expect(success).toBe(false)
        expect(result.current.error?.phase).toBe('prepare')
        expect(result.current.error?.message).toBe(
            'No transaction groups returned',
        )
    })
})
