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
import { describe, expect, it } from 'vitest'
import {
    addressWithSignersFromRawPQSigner,
    decodeSignedTransaction,
    encodeMsgpack,
    FALCON_1024_SCHEME,
    makePaymentTxnWithSuggestedParamsFromObject,
} from 'algosdk'
import { generateKey, signCompressed } from 'falcon-1024'
import {
    assemblePQSignedTransaction,
    deriveQuantumAddress,
    pqSigningDigest,
} from '../quantumAdapter'

const SEED = new Uint8Array(48).fill(3)
const RECEIVER = 'HZ57J3K46JIJXILONBBZOHX6BKPXEM2VVXNRFSUED6DKFD5ZD24PMJ3MVA'

const suggestedParams = {
    fee: 1000n,
    minFee: 1000n,
    firstValid: 1n,
    lastValid: 1001n,
    genesisID: 'testnet-v1.0',
    genesisHash: new Uint8Array(32).fill(9),
}

const buildKeypair = () => {
    const { publicKey, privateKey } = generateKey(SEED)
    return { publicKey, privateKey }
}

describe('pq adapter', () => {
    it('derives a stable 58-character address', () => {
        const { publicKey } = buildKeypair()
        const address = deriveQuantumAddress(publicKey)
        expect(address).toHaveLength(58)
        expect(deriveQuantumAddress(publicKey)).toBe(address)
    })

    it('assembles bytes identical to the fork PQ signer (pins the signing preimage)', async () => {
        const { publicKey, privateKey } = buildKeypair()
        const sender = deriveQuantumAddress(publicKey)

        const txn = makePaymentTxnWithSuggestedParamsFromObject({
            sender,
            receiver: RECEIVER,
            amount: 1000n,
            suggestedParams,
        })

        // Reference: let the fork drive signing end to end. It decides the
        // preimage by calling our raw signer with the bytes it wants signed.
        const { txnSigner } = addressWithSignersFromRawPQSigner({
            pqScheme: FALCON_1024_SCHEME,
            pqPublicKey: publicKey,
            pqSigner: bytesToSign =>
                Promise.resolve(signCompressed(privateKey, bytesToSign)),
        })
        const [reference] = await txnSigner([txn], [0])

        // Ours: compute the digest explicitly, sign it, assemble locally.
        const signature = signCompressed(privateKey, pqSigningDigest(txn))
        const ours = encodeMsgpack(
            assemblePQSignedTransaction({
                txn,
                signature: {
                    schemeId: 'falcon1024',
                    publicKey,
                    signature,
                },
            }),
        )

        expect(ours).toEqual(reference)
    })

    it('produces a decodable pqsig carrying the generic scheme/salt/key/sig quadruple', () => {
        const { publicKey, privateKey } = buildKeypair()
        const sender = deriveQuantumAddress(publicKey)
        const txn = makePaymentTxnWithSuggestedParamsFromObject({
            sender,
            receiver: RECEIVER,
            amount: 1000n,
            suggestedParams,
        })
        const signature = signCompressed(privateKey, pqSigningDigest(txn))

        const decoded = decodeSignedTransaction(
            encodeMsgpack(
                assemblePQSignedTransaction({
                    txn,
                    signature: {
                        schemeId: 'falcon1024',
                        publicKey,
                        signature,
                    },
                }),
            ),
        )

        expect(decoded.pqsig?.sch).toEqual(FALCON_1024_SCHEME)
        expect(decoded.pqsig?.pk).toEqual(publicKey)
        expect(decoded.pqsig?.sig).toEqual(signature)
        expect(typeof decoded.pqsig?.slt).toBe('number')
        expect(decoded.sgnr).toBeUndefined()
    })

    it('sets sgnr when the transaction sender is rekeyed to the quantum address', () => {
        const { publicKey, privateKey } = buildKeypair()
        const quantumAddress = deriveQuantumAddress(publicKey)
        const txn = makePaymentTxnWithSuggestedParamsFromObject({
            sender: RECEIVER,
            receiver: RECEIVER,
            amount: 1000n,
            suggestedParams,
        })
        const signature = signCompressed(privateKey, pqSigningDigest(txn))

        const decoded = decodeSignedTransaction(
            encodeMsgpack(
                assemblePQSignedTransaction({
                    txn,
                    signature: {
                        schemeId: 'falcon1024',
                        publicKey,
                        signature,
                    },
                }),
            ),
        )

        expect(decoded.sgnr?.toString()).toBe(quantumAddress)
    })
})
