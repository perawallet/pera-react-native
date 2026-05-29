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

import { describe, expect, it } from 'vitest'

import { buildNoneAttestationObject } from '../attestationObject'

const hex = (bytes: Uint8Array): string =>
    Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

describe('buildNoneAttestationObject', () => {
    it('emits a 3-entry map keyed fmt/attStmt/authData with an empty attStmt', () => {
        const authData = new Uint8Array([0xde, 0xad])
        const result = buildNoneAttestationObject(authData)

        const expectedPrefix =
            'a3' + // map(3)
            '63' +
            '666d74' + // "fmt"
            '64' +
            '6e6f6e65' + // "none"
            '67' +
            '61747453746d74' + // "attStmt"
            'a0' + // empty map
            '68' +
            '6175746844617461' + // "authData"
            '42' +
            'dead' // bstr(2) authData

        expect(hex(result)).toBe(expectedPrefix)
    })

    it('embeds the authData bytes verbatim with a correct length prefix', () => {
        const authData = new Uint8Array(37).fill(0x11)
        const result = buildNoneAttestationObject(authData)
        const marker = hex(result).indexOf('6175746844617461') // "authData"
        // After the key text, the next byte(s) are the bstr head, then payload.
        const afterKey = result.slice(marker / 2 + 8)
        // 37-byte string uses a 1-byte length prefix: 0x58 0x25
        expect(afterKey[0]).toBe(0x58)
        expect(afterKey[1]).toBe(0x25)
        expect(Array.from(afterKey.slice(2))).toEqual(Array.from(authData))
    })
})
