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
import { sha512_256 } from '@noble/hashes/sha2.js'
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

const decode = (encoded: Uint8Array) => decodeSignedTransaction(encoded)

describe('pq adapter', () => {
    it('derives a stable 58-character address', () => {
        const { publicKey } = buildKeypair()
        const address = deriveQuantumAddress(publicKey)
        expect(address).toHaveLength(58)
        expect(deriveQuantumAddress(publicKey)).toBe(address)
    })

    // The preimage contract, pinned against go-algorand rather than against
    // whatever the interim `algosdk` build happens to do. The node verifies a
    // PQ signature over `HashRep(message)` directly (`FalconVerifier.Verify`
    // -> `VerifyBytes(HashRep(message), sig)` in `crypto/falconWrapper.go`),
    // and `HashRep` is the domain-prefixed msgpack encoding that
    // `bytesToSign()` returns. Verified against algod 4.8.298720-master under
    // consensus `future`: signing `bytesToSign()` confirms on-chain, signing
    // its SHA-512/256 digest does not.
    it('signs the domain-prefixed encoding itself, not a digest of it', () => {
        const { publicKey } = buildKeypair()
        const txn = makePaymentTxnWithSuggestedParamsFromObject({
            sender: deriveQuantumAddress(publicKey),
            receiver: RECEIVER,
            amount: 1000n,
            suggestedParams,
        })

        expect(pqSigningDigest(txn)).toEqual(txn.bytesToSign())
        // Guard the specific regression: the old preimage was this digest.
        expect(pqSigningDigest(txn)).not.toEqual(sha512_256(txn.bytesToSign()))
    })

    it('assembles byte-identical output to the SDK PQ signer', async () => {
        const { publicKey, privateKey } = buildKeypair()
        const sender = deriveQuantumAddress(publicKey)

        const txn = makePaymentTxnWithSuggestedParamsFromObject({
            sender,
            receiver: RECEIVER,
            amount: 1000n,
            suggestedParams,
        })

        // Full byte-parity, signature included: the SDK's raw signer is handed
        // `bytesToSign()` verbatim, the same preimage `pqSigningDigest`
        // returns, and this Falcon implementation is deterministic. If a
        // future SDK build reintroduces a pre-hash, `pqsig.sig` diverges here
        // and this fails — which is the regression worth catching, since no
        // unit test can otherwise tell a wrong preimage from a right one.
        const { txnSigner } = addressWithSignersFromRawPQSigner({
            pqScheme: FALCON_1024_SCHEME,
            pqPublicKey: publicKey,
            pqSigner: bytesToSign =>
                Promise.resolve(signCompressed(privateKey, bytesToSign)),
        })
        const [reference] = await txnSigner([txn], [0])

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

        expect(decode(ours)).toEqual(decode(reference))
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

    it('sets sgnr when the transaction sender is rekeyed to the quantum address', async () => {
        const { publicKey, privateKey } = buildKeypair()
        const quantumAddress = deriveQuantumAddress(publicKey)
        const txn = makePaymentTxnWithSuggestedParamsFromObject({
            sender: RECEIVER,
            receiver: RECEIVER,
            amount: 1000n,
            suggestedParams,
        })
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

        const decoded = decodeSignedTransaction(ours)
        expect(decoded.sgnr?.toString()).toBe(quantumAddress)

        // Full parity against the SDK's own signer for the REKEYED case too,
        // not just `sgnr`: `sgnr` alone would still pass if the rekeyed
        // encoding diverged in any other field, and the rekey path is exactly
        // where an extra/missing `sgnr` changes the bytes a node verifies.
        const { txnSigner } = addressWithSignersFromRawPQSigner({
            pqScheme: FALCON_1024_SCHEME,
            pqPublicKey: publicKey,
            pqSigner: bytesToSign =>
                Promise.resolve(signCompressed(privateKey, bytesToSign)),
        })
        const [reference] = await txnSigner([txn], [0])

        expect(decode(ours)).toEqual(decode(reference))
    })
})
