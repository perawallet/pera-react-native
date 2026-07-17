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

import { describe, it, expect } from 'vitest'
import { isQuantumSignedTransaction, encodeSignedTransaction } from '..'

describe('utils/transact — QuantumSignedTransaction carrier', () => {
    describe('isQuantumSignedTransaction', () => {
        it('discriminates the carrier from a plain algosdk SignedTransaction', () => {
            const carrier = {
                txn: {} as never,
                pqSignedBytes: new Uint8Array([9, 9]),
            }

            expect(isQuantumSignedTransaction(carrier)).toBe(true)
        })

        it('returns false for a value without pqSignedBytes', () => {
            const notACarrier = { txn: {} as never } as never

            expect(isQuantumSignedTransaction(notACarrier)).toBe(false)
        })
    })

    describe('encodeSignedTransaction', () => {
        it('returns pqSignedBytes verbatim for the carrier (no re-encoding)', () => {
            const bytes = new Uint8Array([1, 2, 3])

            const encoded = encodeSignedTransaction({
                txn: {} as never,
                pqSignedBytes: bytes,
            })

            expect(encoded).toBe(bytes)
        })
    })
})
