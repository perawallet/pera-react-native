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
import { describe, expect, test } from 'vitest'
import algosdk, {
    addressWithSignersFromRawFalcon1024Signer,
    decodeSignedTransaction,
    encodeUnsignedTransaction,
} from '@joe-p/algosdk'
import { generateKey, signCompressed } from 'falcon-1024'
import {
    deriveQuantumAddress,
    assembleQuantumSignedTxn,
} from '../quantumAdapter'

const seed = new Uint8Array(32).fill(5)
const { publicKey, privateKey } = generateKey(seed)

const sp = {
    fee: 1000n,
    firstValid: 1n,
    lastValid: 1001n,
    genesisHash: new Uint8Array(32),
    genesisID: 'x',
    minFee: 1000n,
}

const makeTxn = () => {
    const address = deriveQuantumAddress(publicKey)
    return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: address,
        receiver: address,
        amount: 0,
        suggestedParams: sp as never,
    })
}

// A different quantum identity, used as the txn's actual sender to exercise
// the rekey branch: the signing key (publicKey/privateKey above) differs from
// the txn's own sender, so the fork must derive and set `sgnr`.
const otherSeed = new Uint8Array(32).fill(7)
const { publicKey: otherPublicKey } = generateKey(otherSeed)

const makeRekeyedTxn = () => {
    const rekeyedSender = deriveQuantumAddress(otherPublicKey)
    const address = deriveQuantumAddress(publicKey)
    return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: rekeyedSender,
        receiver: address,
        amount: 0,
        suggestedParams: sp as never,
    })
}

describe('quantumAdapter', () => {
    test('deriveQuantumAddress is deterministic and 58 chars', () => {
        expect(deriveQuantumAddress(publicKey)).toBe(
            deriveQuantumAddress(publicKey),
        )
        expect(deriveQuantumAddress(publicKey)).toHaveLength(58)
    })

    test('assembleQuantumSignedTxn produces pqsig bytes that decode, matching the fork signer output', async () => {
        const txn = makeTxn()

        // Capture the exact digest the fork asks the signer to sign (avoids
        // reimplementing SHA-512/256), and produce the reference broadcast bytes.
        let capturedDigest: Uint8Array | undefined
        const { txnSigner } = addressWithSignersFromRawFalcon1024Signer({
            falcon1024PublicKey: publicKey,
            falcon1024Signer: async (b: Uint8Array) => {
                capturedDigest = b
                return signCompressed(privateKey, b)
            },
        })
        const [expected] = await txnSigner([txn], [0])

        // The pre-computed signature a KMS signer would return: over that same digest.
        const falconSignature = signCompressed(privateKey, capturedDigest!)
        const assembled = await assembleQuantumSignedTxn({
            unsignedTxnBytes: encodeUnsignedTransaction(txn),
            publicKey,
            falconSignature,
        })

        // Adapter must produce the exact node-ready bytes and decode back to the PQ sender.
        expect(assembled).toEqual(expected)
        const decoded = decodeSignedTransaction(assembled)
        expect(decoded.txn.sender.toString()).toBe(
            deriveQuantumAddress(publicKey),
        )
        expect(decoded.pqsig?.pk).toEqual(publicKey)
        expect(decoded.pqsig?.sig).toEqual(falconSignature)
        // Self-payment: sender already is the quantum address, so the fork
        // must NOT set an auth-addr (sgnr).
        expect(decoded.sgnr).toBeUndefined()
    })

    test('assembleQuantumSignedTxn sets sgnr to the quantum address when the txn sender is rekeyed to it', async () => {
        const txn = makeRekeyedTxn()

        // Same digest-capture technique as above, for the rekeyed txn.
        let capturedDigest: Uint8Array | undefined
        const { txnSigner } = addressWithSignersFromRawFalcon1024Signer({
            falcon1024PublicKey: publicKey,
            falcon1024Signer: async (b: Uint8Array) => {
                capturedDigest = b
                return signCompressed(privateKey, b)
            },
        })
        const [expected] = await txnSigner([txn], [0])

        const falconSignature = signCompressed(privateKey, capturedDigest!)
        const assembled = await assembleQuantumSignedTxn({
            unsignedTxnBytes: encodeUnsignedTransaction(txn),
            publicKey,
            falconSignature,
        })

        expect(assembled).toEqual(expected)
        const decoded = decodeSignedTransaction(assembled)
        // The txn's own sender is the rekeyed (other) quantum address...
        expect(decoded.txn.sender.toString()).toBe(
            deriveQuantumAddress(otherPublicKey),
        )
        // ...but the fork must have derived sgnr as the signer's quantum
        // address, since the signer differs from the txn sender.
        expect(decoded.sgnr?.toString()).toBe(deriveQuantumAddress(publicKey))
    })
})
