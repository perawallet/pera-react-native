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
import { sha512_256 } from '@noble/hashes/sha2'
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

/**
 * Decodes an encoded signed transaction with the PQ signature bytes blanked,
 * so two encodings can be compared on everything BUT which preimage was
 * signed (scheme, salt, public key, `sgnr`, and every transaction field).
 */
const withoutPQSignature = (encoded: Uint8Array) => {
    const decoded = decodeSignedTransaction(encoded)
    return {
        ...decoded,
        pqsig: decoded.pqsig ? { ...decoded.pqsig, sig: undefined } : undefined,
    }
}

describe('pq adapter', () => {
    it('derives a stable 58-character address', () => {
        const { publicKey } = buildKeypair()
        const address = deriveQuantumAddress(publicKey)
        expect(address).toHaveLength(58)
        expect(deriveQuantumAddress(publicKey)).toBe(address)
    })

    // The preimage contract, pinned against go-algorand — NOT against the
    // interim `algosdk` fork. The node verifies a PQ signature over
    // `HashRep(message)` directly (`FalconVerifier.Verify` ->
    // `VerifyBytes(HashRep(message), sig)` in `crypto/falconWrapper.go`), and
    // `HashRep` is the domain-prefixed msgpack encoding that `bytesToSign()`
    // returns. The fork instead hands a raw signer `sha512_256(bytesToSign())`,
    // which every `pqsig`-capable algod rejects with `falcon verify failed`;
    // verified against algod 4.8.298720-master under consensus `future`, where
    // signing `bytesToSign()` confirms on-chain and signing its digest does
    // not. So the fork is the thing that diverges, and byte-parity with the
    // fork is deliberately no longer asserted.
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

    it('assembles the same envelope as the fork PQ signer, signature aside', async () => {
        const { publicKey, privateKey } = buildKeypair()
        const sender = deriveQuantumAddress(publicKey)

        const txn = makePaymentTxnWithSuggestedParamsFromObject({
            sender,
            receiver: RECEIVER,
            amount: 1000n,
            suggestedParams,
        })

        // The fork still pins the ENVELOPE — scheme, salt, public key, field
        // layout, `sgnr` — which is independent of which preimage got signed.
        // Only `pqsig.sig` is excluded, since that is precisely where the fork
        // and the node disagree (see the preimage test above).
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

        expect(withoutPQSignature(ours)).toEqual(withoutPQSignature(reference))
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

        // Envelope-equality against the fork's own signer for the REKEYED case
        // too, not just `sgnr`: `sgnr` alone would still pass if the rekeyed
        // encoding diverged in any other field, and the rekey path is exactly
        // where an extra/missing `sgnr` changes the bytes a node verifies.
        // Signature bytes excluded — see the preimage test above.
        const { txnSigner } = addressWithSignersFromRawPQSigner({
            pqScheme: FALCON_1024_SCHEME,
            pqPublicKey: publicKey,
            pqSigner: bytesToSign =>
                Promise.resolve(signCompressed(privateKey, bytesToSign)),
        })
        const [reference] = await txnSigner([txn], [0])

        expect(withoutPQSignature(ours)).toEqual(withoutPQSignature(reference))
    })
})
