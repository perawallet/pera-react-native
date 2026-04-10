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

const mockSignTransactions = vi.fn()
const mockDecodeTransaction = vi.fn()
const mockDecodeSignedTransaction = vi.fn()
const mockEncodeSignedTransactions = vi.fn()
const mockSendRawTransaction = vi.fn()
const mockPrepareTransactions = vi.fn()
const mockUpdateSwapStatus = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useTransactionSigner: () => ({
        signTransactions: mockSignTransactions,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
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
}))

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
    logger: {
        warn: vi.fn(),
    },
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

describe('useSwapExecution', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Default: decodeTransaction returns a fake PeraTransaction
        mockDecodeTransaction.mockImplementation(() => ({
            sender: { toString: () => 'SENDER', publicKey: new Uint8Array() },
            txId: () => 'mock-tx-id',
        }))

        // Default: signTransactions returns signed versions
        mockSignTransactions.mockResolvedValue([
            { txn: { txId: () => 'tx-id-1' }, sig: new Uint8Array([1]) },
            { txn: { txId: () => 'tx-id-2' }, sig: new Uint8Array([2]) },
        ])

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

    it('executes full flow: prepare → sign → submit → update status', async () => {
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
        expect(mockSignTransactions).toHaveBeenCalled()
        expect(mockSendRawTransaction).toHaveBeenCalled()
        expect(mockUpdateSwapStatus).toHaveBeenCalledWith({
            swapId: '12345',
            data: expect.objectContaining({
                status: 'in_progress',
                swap_version: 'v2',
            }),
        })
    })

    it('handles pre-signed transaction groups without signing', async () => {
        mockPrepareTransactions.mockResolvedValue(
            makePrepareResult({
                transactionGroups: [
                    {
                        purpose: 'fee',
                        signedTransactions: ['c2lnbmVk'], // base64 for 'signed'
                    },
                ],
            }),
        )

        mockDecodeSignedTransaction.mockReturnValue({
            txn: { txId: () => 'pre-signed-tx' },
            sig: new Uint8Array([99]),
        })

        const { result } = renderHook(() => useSwapExecution())

        await act(async () => {
            await result.current.execute('quote-456')
        })

        expect(result.current.status).toBe('success')
        expect(mockSignTransactions).not.toHaveBeenCalled()
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

    it('sets error on signing failure and reports failed status', async () => {
        mockSignTransactions.mockRejectedValue(new Error('Signing failed'))

        const { result } = renderHook(() => useSwapExecution())

        let success: boolean | undefined
        await act(async () => {
            success = await result.current.execute('quote-sign-fail')
        })

        expect(success).toBe(false)
        expect(result.current.status).toBe('error')
        expect(result.current.error?.phase).toBe('signing')
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
