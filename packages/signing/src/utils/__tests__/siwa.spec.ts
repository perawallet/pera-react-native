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
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import { sha256 } from '@noble/hashes/sha2.js'
import { Arc60BadJsonError } from '../arc60'
import {
    parseSiwa,
    buildSiwaAuthRequest,
    SIWA_CHAIN_ID,
    SIWA_MAX_PAYLOAD_BYTES,
    SIWA_MAX_RESOURCE_BYTES,
    SIWA_MAX_RESOURCES,
    SIWA_MAX_STATEMENT_BYTES,
    SIWA_MAX_FIELD_BYTES,
} from '../siwa'

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

describe('parseSiwa — size limits (ARC-60 DoS hardening)', () => {
    test('accepts a statement at the byte cap', () => {
        const statement = 'x'.repeat(SIWA_MAX_STATEMENT_BYTES)
        const canonical = canonify({ ...baseSiwa, statement })!
        expect(parseSiwa(canonical).statement).toBe(statement)
    })

    test('rejects a statement one byte over the cap', () => {
        const statement = 'x'.repeat(SIWA_MAX_STATEMENT_BYTES + 1)
        const canonical = canonify({ ...baseSiwa, statement })!
        expect(() => parseSiwa(canonical)).toThrow(Arc60BadJsonError)
    })

    test('accepts the maximum number of resources', () => {
        const resources = Array.from(
            { length: SIWA_MAX_RESOURCES },
            (_, i) => `https://arc60.io/${i}`,
        )
        const canonical = canonify({ ...baseSiwa, resources })!
        expect(parseSiwa(canonical).resources).toHaveLength(SIWA_MAX_RESOURCES)
    })

    test('rejects one resource over the entry-count cap', () => {
        const resources = Array.from(
            { length: SIWA_MAX_RESOURCES + 1 },
            (_, i) => `https://arc60.io/${i}`,
        )
        const canonical = canonify({ ...baseSiwa, resources })!
        expect(() => parseSiwa(canonical)).toThrow(Arc60BadJsonError)
    })

    test('accepts a resource entry at the byte cap', () => {
        const resources = ['x'.repeat(SIWA_MAX_RESOURCE_BYTES)]
        const canonical = canonify({ ...baseSiwa, resources })!
        expect(parseSiwa(canonical).resources).toEqual(resources)
    })

    test('rejects a resource entry one byte over the cap', () => {
        const resources = ['x'.repeat(SIWA_MAX_RESOURCE_BYTES + 1)]
        const canonical = canonify({ ...baseSiwa, resources })!
        expect(() => parseSiwa(canonical)).toThrow(Arc60BadJsonError)
    })

    test('rejects a descriptor field one byte over the per-field cap', () => {
        const canonical = canonify({
            ...baseSiwa,
            domain: 'x'.repeat(SIWA_MAX_FIELD_BYTES + 1),
        })!
        expect(() => parseSiwa(canonical)).toThrow(Arc60BadJsonError)
    })

    test('rejects an oversized payload before parsing (Layer 3 guard)', () => {
        // A raw string over the cap is rejected by the size guard, not the
        // JSON parser — so even non-JSON junk never reaches JSON.parse/canonify.
        const oversized = 'x'.repeat(SIWA_MAX_PAYLOAD_BYTES + 1)
        expect(() => parseSiwa(oversized)).toThrow(Arc60BadJsonError)
    })

    test('rejects deeply nested input without freezing', () => {
        // A field sent as a deeply nested object is rejected by the zod shape
        // check before canonify ever recurses over it.
        let nested: unknown = 'leaf'
        for (let i = 0; i < 500; i++) nested = { a: nested }
        const json = JSON.stringify({ ...baseSiwa, statement: nested })
        expect(() => parseSiwa(json)).toThrow(Arc60BadJsonError)
    })
})

describe('buildSiwaAuthRequest', () => {
    const args = {
        domain: 'perawallet.app',
        accountAddress: 'ALGOADDRESS',
        uri: 'https://perawallet.app',
        nonce: 'nonce-123',
        statement: 'Prove address ownership',
        now: new Date('2026-07-17T00:00:00.000Z'),
    }

    test('produces a payload that round-trips through parseSiwa', () => {
        const { data } = buildSiwaAuthRequest(args)
        const canonicalJson = new TextDecoder().decode(decodeFromBase64(data))
        const siwa = parseSiwa(canonicalJson)

        expect(siwa.domain).toBe(args.domain)
        expect(siwa.account_address).toBe(args.accountAddress)
        expect(siwa.uri).toBe(args.uri)
        expect(siwa.nonce).toBe(args.nonce)
        expect(siwa.statement).toBe(args.statement)
        expect(siwa.chain_id).toBe(SIWA_CHAIN_ID)
        expect(siwa.type).toBe('ed25519')
    })

    test('sets a 30-minute expiry window by default', () => {
        const { payload } = buildSiwaAuthRequest(args)

        expect(payload['issued-at']).toBe('2026-07-17T00:00:00.000Z')
        expect(payload['expiration-time']).toBe('2026-07-17T00:30:00.000Z')
    })

    test('omits statement when not provided', () => {
        const { statement: _statement, ...rest } = args
        const { payload } = buildSiwaAuthRequest(rest)

        expect(payload.statement).toBeUndefined()
        expect(Object.keys(payload)).not.toContain('statement')
    })

    test('authenticatorData is sha256(domain), matching the ARC-60 domain-binding invariant', () => {
        const { authenticatorData } = buildSiwaAuthRequest(args)
        const expected = sha256(new TextEncoder().encode(args.domain))

        expect([...authenticatorData]).toEqual([...expected])
    })

    test('two calls with different nonces produce different data', () => {
        const first = buildSiwaAuthRequest(args)
        const second = buildSiwaAuthRequest({ ...args, nonce: 'nonce-456' })

        expect(first.data).not.toBe(second.data)
    })
})
