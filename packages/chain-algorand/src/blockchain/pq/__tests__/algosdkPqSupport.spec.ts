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
    addressFromPQKey,
    addressWithSignersFromRawPQSigner,
    decodeSignedTransaction,
    encodeMsgpack,
    FALCON_1024_SCHEME,
    makePaymentTxnWithSuggestedParamsFromObject,
    SignedTransaction,
} from 'algosdk'

/**
 * The resolved `algosdk` must be a post-quantum-capable build. Official 3.7.0
 * satisfies that, and these assertions passed unchanged across the swap off the
 * vendored `v3.7.0-beta.1` build — which is what they exist to prove. If
 * someone points the specifier back at a pre-3.7 release, this fails loudly
 * instead of silently losing PQ support. Paired with
 * tools/check-single-algosdk.mjs, which catches the same drift at pre-push,
 * before a test run.
 */
describe('resolved algosdk PQ capability', () => {
    it('exposes the scheme-agnostic PQ signer surface', () => {
        expect(typeof addressWithSignersFromRawPQSigner).toBe('function')
        expect(typeof addressFromPQKey).toBe('function')
        expect(FALCON_1024_SCHEME).toBeInstanceOf(Uint8Array)
        expect(FALCON_1024_SCHEME).toHaveLength(2)
    })

    it('derives a PQ address and salt from a scheme and public key', () => {
        const publicKey = new Uint8Array(1793).fill(7)
        const { address, salt } = addressFromPQKey(
            FALCON_1024_SCHEME,
            publicKey,
        )

        expect(address.toString()).toHaveLength(58)
        expect(salt).toBeGreaterThanOrEqual(0)
        expect(salt).toBeLessThanOrEqual(0xff)
    })

    it('carries a pqsig through SignedTransaction encode/decode', () => {
        const publicKey = new Uint8Array(1793).fill(7)
        const signature = new Uint8Array(1232).fill(11)
        const { address, salt } = addressFromPQKey(
            FALCON_1024_SCHEME,
            publicKey,
        )

        const txn = makePaymentTxnWithSuggestedParamsFromObject({
            sender: address.toString(),
            receiver: address.toString(),
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

        const decoded = decodeSignedTransaction(
            encodeMsgpack(
                new SignedTransaction({
                    txn,
                    pqsig: {
                        sch: FALCON_1024_SCHEME,
                        slt: salt,
                        pk: publicKey,
                        sig: signature,
                    },
                }),
            ),
        )

        expect(decoded.pqsig?.sch).toEqual(FALCON_1024_SCHEME)
        expect(decoded.pqsig?.slt).toBe(salt)
        expect(decoded.pqsig?.pk).toEqual(publicKey)
        expect(decoded.pqsig?.sig).toEqual(signature)
    })
})
