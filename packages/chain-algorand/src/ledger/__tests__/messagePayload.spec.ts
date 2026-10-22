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

import { describe, expect, it } from 'vitest'
import {
    decodeAlgorandLedgerMessage,
    encodeAlgorandLedgerMessage,
    type AlgorandLedgerMessage,
} from '../messagePayload'

const message: AlgorandLedgerMessage = {
    data: 'eyJhIjoxfQ==',
    signerPublicKey: new Uint8Array(32).fill(7),
    domain: 'arc60.io',
    authenticatorData: new Uint8Array([1, 2, 3, 255]),
    requestId: 'request-1',
    scope: 1,
    encoding: 'base64',
}

const encodeJson = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value))

describe('Algorand Ledger message payload', () => {
    it('round-trips every field, including an absent requestId', () => {
        const { requestId: _requestId, ...withoutRequestId } = message

        expect(
            decodeAlgorandLedgerMessage(encodeAlgorandLedgerMessage(message)),
        ).toEqual(message)
        expect(
            decodeAlgorandLedgerMessage(
                encodeAlgorandLedgerMessage(withoutRequestId),
            ),
        ).toEqual(withoutRequestId)
    })

    it('refuses bytes that are not an encoded Algorand Ledger message', () => {
        const valid = JSON.parse(
            new TextDecoder().decode(encodeAlgorandLedgerMessage(message)),
        )

        expect(() =>
            decodeAlgorandLedgerMessage(new Uint8Array([0xff, 0x00])),
        ).toThrow()
        expect(() =>
            decodeAlgorandLedgerMessage(
                encodeJson({ ...valid, domain: undefined }),
            ),
        ).toThrow()
        expect(() =>
            decodeAlgorandLedgerMessage(encodeJson({ ...valid, scope: '1' })),
        ).toThrow()
        expect(() =>
            decodeAlgorandLedgerMessage(encodeJson({ ...valid, requestId: 7 })),
        ).toThrow()
    })
})
