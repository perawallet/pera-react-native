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

import { describe, it, expect, vi } from 'vitest'
import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'
import { submitSignedTransactionGroup } from '../submitSignedTransactionGroup'
import type { AlgokitClientInterface } from '../types'

const makeAlgokit = (response: unknown): AlgokitClientInterface => ({
    client: {
        algod: {
            sendRawTransaction: vi.fn().mockResolvedValue(response),
        },
    },
})

const signedTxn = (txId?: () => string): PeraSignedTransaction =>
    ({
        txn: txId ? { txId } : {},
        blob: new Uint8Array([1]),
    }) as unknown as PeraSignedTransaction

describe('submitSignedTransactionGroup', () => {
    it('encodes, concatenates, and submits the signed group to algod', async () => {
        const algokit = makeAlgokit({ txid: 'TX1' })
        const encode = vi
            .fn()
            .mockReturnValue([new Uint8Array([0xaa]), new Uint8Array([0xbb])])

        const txns = [signedTxn(), signedTxn()]
        const ids = await submitSignedTransactionGroup(algokit, encode, txns)

        expect(encode).toHaveBeenCalledWith(txns)
        // The two encoded blobs are concatenated into a single payload.
        expect(algokit.client.algod.sendRawTransaction).toHaveBeenCalledWith(
            new Uint8Array([0xaa, 0xbb]),
        )
        expect(ids).toEqual(['TX1'])
    })

    it('returns all txIds when algod responds with a string array', async () => {
        const algokit = makeAlgokit({ txid: ['TX1', 'TX2'] })
        const encode = vi.fn().mockReturnValue([new Uint8Array([1])])

        const ids = await submitSignedTransactionGroup(algokit, encode, [
            signedTxn(),
        ])

        expect(ids).toEqual(['TX1', 'TX2'])
    })

    it('falls back to computing the id from each txn when algod omits txid', async () => {
        const algokit = makeAlgokit({})
        const encode = vi.fn().mockReturnValue([new Uint8Array([1])])
        const txIdA = vi.fn().mockReturnValue('COMPUTED_A')
        const txIdB = vi.fn().mockReturnValue('COMPUTED_B')

        const ids = await submitSignedTransactionGroup(algokit, encode, [
            signedTxn(txIdA),
            signedTxn(txIdB),
        ])

        expect(txIdA).toHaveBeenCalled()
        expect(txIdB).toHaveBeenCalled()
        expect(ids).toEqual(['COMPUTED_A', 'COMPUTED_B'])
    })

    it('returns an empty array when algod omits txid and no txn can compute one', async () => {
        const algokit = makeAlgokit({})
        const encode = vi.fn().mockReturnValue([new Uint8Array([1])])

        const ids = await submitSignedTransactionGroup(algokit, encode, [
            signedTxn(),
        ])

        expect(ids).toEqual([])
    })
})
