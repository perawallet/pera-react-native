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
    encodeMsgpack,
    makePaymentTxnWithSuggestedParamsFromObject,
    decodeSignedTransaction,
} from 'algosdk'
import { generateKey, signCompressed } from 'falcon-1024'
import { encodeSignedTransaction } from '..'
import {
    assemblePQSignedTransaction,
    deriveQuantumAddress,
    pqSigningDigest,
} from '../../pq/quantumAdapter'

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
