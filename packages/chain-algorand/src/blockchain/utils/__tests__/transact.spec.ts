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

// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
    Address,
    encodeMsgpack,
    makePaymentTxnWithSuggestedParamsFromObject,
    decodeSignedTransaction,
} from 'algosdk'
import { generateKey, signCompressed } from 'falcon-1024'
import {
    asAlgosdkTransaction,
    compactSignedResults,
    encodeSignedTransaction,
    groupTransactions,
} from '..'
import type { PeraSignedTransaction } from '@perawallet/wallet-core-chain-contract'
import {
    assemblePQSignedTransaction,
    deriveQuantumAddress,
    pqSigningDigest,
} from '../../pq/quantumAdapter'

describe('utils/transact — compactSignedResults', () => {
    it('drops null padding slots and preserves the order and identity of the rest', () => {
        const first = {
            sig: new Uint8Array([1]),
        } as unknown as PeraSignedTransaction
        const second = {
            sig: new Uint8Array([2]),
        } as unknown as PeraSignedTransaction

        const compacted = compactSignedResults([
            null,
            first,
            null,
            second,
            null,
        ])

        expect(compacted).toEqual([first, second])
        expect(compacted[0]).toBe(first)
        expect(compacted[1]).toBe(second)
    })

    it('returns an empty array for all-null input', () => {
        expect(compactSignedResults([null, null])).toEqual([])
    })
})

describe('utils/transact — pqsig transactions use the ordinary encoding path', () => {
    it('msgpack-encodes a pqsig SignedTransaction like any other', () => {
        const { publicKey, privateKey } = generateKey(
            new Uint8Array(48).fill(5),
        )
        const sender = deriveQuantumAddress(publicKey)
        const txn = makePaymentTxnWithSuggestedParamsFromObject({
            sender,
            receiver: sender,
            amount: 1n,
            suggestedParams: {
                fee: 1000n,
                minFee: 1000n,
                firstValid: 1n,
                lastValid: 1001n,
                genesisID: 'testnet-v1.0',
                genesisHash: new Uint8Array(32).fill(9),
            },
        })
        const signed = assemblePQSignedTransaction({
            txn,
            signature: {
                schemeId: 'falcon1024',
                publicKey,
                signature: signCompressed(privateKey, pqSigningDigest(txn)),
            },
        })

        expect(encodeSignedTransaction(signed)).toEqual(encodeMsgpack(signed))
        expect(
            decodeSignedTransaction(encodeSignedTransaction(signed)).pqsig,
        ).toBeDefined()
    })
})

describe('utils/transact — algosdk narrowing', () => {
    const makePayment = (amount: number) =>
        makePaymentTxnWithSuggestedParamsFromObject({
            sender: Address.zeroAddress(),
            receiver: Address.zeroAddress(),
            amount,
            suggestedParams: {
                fee: 1000,
                flatFee: true,
                firstValid: 1,
                lastValid: 1000,
                genesisHash: new Uint8Array(32),
                genesisID: 'testnet-v1.0',
            },
        })

    it('returns the same instance from asAlgosdkTransaction', () => {
        const txn = makePayment(1)

        expect(asAlgosdkTransaction(txn)).toBe(txn)
    })

    it("groups in place and returns the caller's array", () => {
        const input = [makePayment(1), makePayment(2)]

        const grouped = groupTransactions(input)

        expect(grouped).toBe(input)
        expect(grouped[0].group).toBeDefined()
        expect(grouped[0].group).toEqual(grouped[1].group)
    })
})
