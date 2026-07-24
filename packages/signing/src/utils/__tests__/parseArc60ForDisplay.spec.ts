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

import { describe, expect, test } from 'vitest'
import { canonify } from 'canonify'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { parseArc60ForDisplay } from '../parseArc60ForDisplay'

const encodeJsonToBase64 = (value: unknown): string =>
    encodeToBase64(new TextEncoder().encode(canonify(value)!))

const baseSiwa = {
    domain: 'arc60.io',
    account_address: 'ABC123',
    uri: 'https://arc60.io/login',
    version: '1',
    nonce: 'abc123',
    chain_id: 'algorand:mainnet',
    type: 'ed25519',
} as const

describe('parseArc60ForDisplay', () => {
    test('returns parsed SIWA for a valid canonical base64 payload', () => {
        const result = parseArc60ForDisplay(
            encodeJsonToBase64(baseSiwa),
            'base64',
        )

        expect(result.type).toBe('siwa')
        if (result.type !== 'siwa') return
        expect(result.siwa.domain).toBe('arc60.io')
        expect(result.siwa.chain_id).toBe('algorand:mainnet')
    })

    test('returns error when encoding is not supported', () => {
        const result = parseArc60ForDisplay('deadbeef', 'hex')

        expect(result.type).toBe('error')
        if (result.type !== 'error') return
        expect(result.message).toMatch(/hex/)
    })

    test('returns error when decoded bytes are not valid UTF-8', () => {
        // 0xff 0xfe 0xfd is a valid base64 decode but not a valid UTF-8 sequence.
        const invalidUtf8 = encodeToBase64(new Uint8Array([0xff, 0xfe, 0xfd]))
        const result = parseArc60ForDisplay(invalidUtf8, 'base64')

        expect(result).toEqual({
            type: 'error',
            message: 'Decoded payload is not valid UTF-8',
        })
    })

    test('returns error when decoded payload is not canonical SIWA JSON', () => {
        // Pretty-printed JSON is valid UTF-8 but fails SIWA canonicalisation.
        const pretty = JSON.stringify(baseSiwa, null, 2)
        const prettyBase64 = encodeToBase64(new TextEncoder().encode(pretty))
        const result = parseArc60ForDisplay(prettyBase64, 'base64')

        expect(result.type).toBe('error')
        if (result.type !== 'error') return
        expect(result.message).toMatch(/SIWA/i)
    })
})
