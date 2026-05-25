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

import { describe, expect, test } from 'vitest'
import { canonify } from 'canonify'
import { Arc60BadJsonError } from '../arc60'
import { parseSiwa, SIWA_CHAIN_ID } from '../siwa'

const baseSiwa = {
    domain: 'arc60.io',
    account_address: 'ABC123',
    uri: 'https://arc60.io/login',
    version: '1',
    nonce: 'abc123',
    chain_id: SIWA_CHAIN_ID,
    type: 'ed25519',
} as const

describe('parseSiwa', () => {
    test('accepts a canonical minimal payload', () => {
        const canonical = canonify(baseSiwa)!
        const siwa = parseSiwa(canonical)
        expect(siwa.domain).toBe('arc60.io')
        expect(siwa.chain_id).toBe(SIWA_CHAIN_ID)
        expect(siwa.type).toBe('ed25519')
    })

    test('accepts a canonical payload with optional fields', () => {
        const full = {
            ...baseSiwa,
            statement: 'Sign in to Arc60',
            'issued-at': '2026-01-01T00:00:00Z',
            'expiration-time': '2026-01-02T00:00:00Z',
            'not-before': '2026-01-01T00:00:00Z',
            'request-id': 'req-1',
            resources: ['https://arc60.io/a', 'https://arc60.io/b'],
        }
        const canonical = canonify(full)!
        const siwa = parseSiwa(canonical)
        expect(siwa.resources).toEqual([
            'https://arc60.io/a',
            'https://arc60.io/b',
        ])
    })

    test('rejects non-canonical key ordering', () => {
        // canonify sorts keys alphabetically — reversing them yields a
        // non-canonical string that must round-trip to an error.
        const reversed = JSON.stringify(
            baseSiwa,
            Object.keys(baseSiwa).reverse(),
        )
        expect(() => parseSiwa(reversed)).toThrow(Arc60BadJsonError)
    })

    test('rejects pretty-printed JSON (extra whitespace)', () => {
        const pretty = JSON.stringify(baseSiwa, null, 2)
        expect(() => parseSiwa(pretty)).toThrow(Arc60BadJsonError)
    })

    test('rejects malformed JSON', () => {
        expect(() => parseSiwa('{not json')).toThrow(Arc60BadJsonError)
    })

    test('rejects missing required fields', () => {
        const { domain: _, ...rest } = baseSiwa
        const canonical = canonify(rest)!
        expect(() => parseSiwa(canonical)).toThrow(Arc60BadJsonError)
    })

    test('rejects a payload with a missing nonce', () => {
        const { nonce: _nonce, ...rest } = baseSiwa
        const canonical = canonify(rest)!
        expect(() => parseSiwa(canonical)).toThrow(Arc60BadJsonError)
    })

    test('rejects a payload with an empty nonce', () => {
        const canonical = canonify({ ...baseSiwa, nonce: '' })!
        expect(() => parseSiwa(canonical)).toThrow(Arc60BadJsonError)
    })

    test('rejects wrong chain_id', () => {
        const canonical = canonify({ ...baseSiwa, chain_id: '416' })!
        expect(() => parseSiwa(canonical)).toThrow(Arc60BadJsonError)
    })

    test('rejects wrong signature type', () => {
        const canonical = canonify({ ...baseSiwa, type: 'secp256k1' })!
        expect(() => parseSiwa(canonical)).toThrow(Arc60BadJsonError)
    })
})
