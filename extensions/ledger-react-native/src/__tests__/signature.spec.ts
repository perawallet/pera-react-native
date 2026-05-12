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

import { describe, test, expect } from 'vitest'
import { extractLedgerSignature } from '../signature'
import { LedgerSigningError } from '../errors'

describe('extractLedgerSignature', () => {
    test('throws LedgerSigningError when the signature is null', () => {
        expect(() => extractLedgerSignature(null)).toThrowError(
            LedgerSigningError,
        )
    })

    test('throws LedgerSigningError when the response is shorter than the SW it must strip', () => {
        // A <2-byte response can't possibly contain the APDU status word —
        // surface this as an explicit signing error rather than silently
        // returning an empty Uint8Array.
        expect(() =>
            extractLedgerSignature(Uint8Array.from([0x90])),
        ).toThrowError(LedgerSigningError)
    })

    test('strips the trailing 2-byte APDU status word from the response', () => {
        // hw-app-algorand@6.35.1 returns sig || SW (2 trailing bytes) —
        // mimic that here and assert the helper strips the SW.
        const sig = extractLedgerSignature(
            Uint8Array.from([1, 2, 3, 0x90, 0x00]),
        )
        expect(Array.from(sig)).toEqual([1, 2, 3])
    })

    test('strips exactly 2 trailing bytes from a real-length Ed25519 sig + SW response', () => {
        // Regression: a 66-byte response (64-byte sig + SW_OK) reaches
        // backend Ed25519 verification as a malformed 66-byte signature
        // unless the helper strips the trailing SW. Multisig cosign
        // /joint-accounts/.../responses/ returns 401 in that case.
        const realSig = new Uint8Array(64).fill(0xab)
        const response = new Uint8Array(66)
        response.set(realSig, 0)
        response.set([0x90, 0x00], 64)

        const sig = extractLedgerSignature(response)

        expect(sig).toHaveLength(64)
        expect(Array.from(sig)).toEqual(Array.from(realSig))
    })
})
