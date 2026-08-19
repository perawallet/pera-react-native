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
import { AlgodError } from '@perawallet/wallet-core-blockchain'
import { SubmissionError } from '../../errors'
import { submitRawSignedTransactionGroup } from '../submitRawSignedTransactionGroup'

const mockSendRawTransaction = vi.fn()
const mockTxID = vi.fn(() => 'DERIVED_TXID')

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        decodeSignedTransaction: () => ({ txn: { txID: mockTxID } }),
    }
})

const algokit = {
    client: {
        algod: {
            sendRawTransaction: (...args: unknown[]) => ({
                do: () => mockSendRawTransaction(...args),
            }),
        },
    },
} as never

const RAW = [new Uint8Array([1, 2, 3])]

describe('submitRawSignedTransactionGroup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockTxID.mockReturnValue('DERIVED_TXID')
    })

    it('reports an already-in-ledger resubmit as success', async () => {
        mockSendRawTransaction.mockRejectedValue(
            new AlgodError('duplicate_txn', {}),
        )

        await expect(
            submitRawSignedTransactionGroup(algokit, RAW),
        ).resolves.toEqual(['DERIVED_TXID'])
    })

    it('throws an unknown-outcome error carrying locally derived txIds when the response is lost', async () => {
        const timeout = new Error('aborted')
        timeout.name = 'TimeoutError'
        mockSendRawTransaction.mockRejectedValue(timeout)

        const promise = submitRawSignedTransactionGroup(algokit, RAW)

        await expect(promise).rejects.toBeInstanceOf(SubmissionError)
        const error = await promise.catch((e: SubmissionError) => e)
        expect(error.classification).toBe('unknown-outcome')
        expect(error.txIds).toEqual(['DERIVED_TXID'])
    })

    it('throws a rejected-by-node error for a definitive node verdict', async () => {
        mockSendRawTransaction.mockRejectedValue(
            new AlgodError('overspend', {}),
        )

        const promise = submitRawSignedTransactionGroup(algokit, RAW)

        await expect(promise).rejects.toBeInstanceOf(SubmissionError)
        const error = await promise.catch((e: SubmissionError) => e)
        expect(error.classification).toBe('rejected-by-node')
    })

    it('still classifies when the bytes cannot be decoded, with no txIds to verify', async () => {
        mockTxID.mockImplementation(() => {
            throw new Error('undecodable')
        })
        const timeout = new Error('aborted')
        timeout.name = 'TimeoutError'
        mockSendRawTransaction.mockRejectedValue(timeout)

        const promise = submitRawSignedTransactionGroup(algokit, RAW)

        const error = await promise.catch((e: SubmissionError) => e)
        expect(error.classification).toBe('unknown-outcome')
        expect(error.txIds).toEqual([])
    })

    it('returns the response txid on success without touching the failure path', async () => {
        mockSendRawTransaction.mockResolvedValue({ txid: 'NODE_TXID' })

        await expect(
            submitRawSignedTransactionGroup(algokit, RAW),
        ).resolves.toEqual(['NODE_TXID'])
    })
})
