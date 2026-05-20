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
import { Address } from '@algorandfoundation/algokit-utils'
import { decodeMsgpack } from '@algorandfoundation/algokit-utils/common'
import {
    assembleSignedMultisigTransactions,
    type ParticipantResponse,
} from '../assembleSignedMultisigTransactions'

// =============================================================================
// Test fixtures
// =============================================================================

const pkOfByte = (byte: number): Uint8Array => new Uint8Array(32).fill(byte)
const addrFromByte = (byte: number): string =>
    new Address(pkOfByte(byte)).toString()

const ADDR_1 = addrFromByte(0x01)
const ADDR_2 = addrFromByte(0x02)
const ADDR_3 = addrFromByte(0x03)

const sigOf = (byte: number): string => {
    const bytes = new Uint8Array(64).fill(byte)
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
}

const SIG_1 = sigOf(0xaa)
const SIG_2 = sigOf(0xbb)
const ZERO_SIG = sigOf(0x00)

// A minimal valid msgpack object — a 1-entry map { "x": 1 } — so the
// assembler has something concrete to embed as the "txn" value.
const FAKE_TX_BYTES = new Uint8Array([
    0x81, // fixmap, 1 entry
    0xa1, // fixstr, len 1
    0x78, // "x"
    0x01, // positive fixint, value 1
])
const FAKE_TX_B64 = (() => {
    let s = ''
    for (const b of FAKE_TX_BYTES) s += String.fromCharCode(b)
    return btoa(s)
})()

const buildResponse = (
    address: string,
    response: 'signed' | 'declined',
    signatures?: (string | null)[],
): ParticipantResponse => ({ address, response, signatures })

describe('assembleSignedMultisigTransactions', () => {
    test('produces valid msgpack with msig (subsig/thr/v) and embedded txn', () => {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2, ADDR_3],
            version: 1,
            threshold: 2,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1]),
                buildResponse(ADDR_2, 'signed', [SIG_2]),
                buildResponse(ADDR_3, 'declined'),
            ],
        })

        expect(result.kind).toBe('success')
        if (result.kind !== 'success') return
        expect(result.signedTransactionsBytes).toHaveLength(1)

        const decoded = decodeMsgpack(
            result.signedTransactionsBytes[0],
            Object,
        ) as Record<string, unknown>

        expect(Object.keys(decoded).sort()).toEqual(['msig', 'txn'])

        const msig = decoded.msig as Record<string, unknown>
        expect(msig.v).toBe(1)
        expect(msig.thr).toBe(2)
        const subsigs = msig.subsig as Array<{
            pk: Uint8Array
            s?: Uint8Array
        }>
        expect(subsigs).toHaveLength(3)
        // Order matches participantAddresses
        expect(subsigs[0].s).toBeDefined()
        expect(subsigs[1].s).toBeDefined()
        // ADDR_3 declined → no signature
        expect(subsigs[2].s).toBeUndefined()
        // Each subsig.pk is the corresponding 32-byte public key
        expect(subsigs[0].pk.length).toBe(32)
        expect(Array.from(subsigs[0].pk)).toEqual(Array.from(pkOfByte(0x01)))
        expect(Array.from(subsigs[1].pk)).toEqual(Array.from(pkOfByte(0x02)))
        expect(Array.from(subsigs[2].pk)).toEqual(Array.from(pkOfByte(0x03)))
    })

    test('embeds raw transaction bytes verbatim (no decode + re-encode)', () => {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [buildResponse(ADDR_1, 'signed', [SIG_1])],
        })

        if (result.kind !== 'success') throw new Error('expected success')
        const decoded = decodeMsgpack(
            result.signedTransactionsBytes[0],
            Object,
        ) as Record<string, unknown>
        // The inner txn map was `{ "x": 1 }` — survives roundtrip.
        expect(decoded.txn).toEqual({ x: 1 })
    })

    test('errors when threshold is not met', () => {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2, ADDR_3],
            version: 1,
            threshold: 3,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1]),
                buildResponse(ADDR_2, 'signed', [SIG_2]),
                buildResponse(ADDR_3, 'declined'),
            ],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            expect(result.reason).toMatch(/not enough valid signatures/i)
        }
    })

    test('treats all-zero signatures as missing (sanity filter)', () => {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 2,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1]),
                buildResponse(ADDR_2, 'signed', [ZERO_SIG]),
            ],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            expect(result.reason).toMatch(/not enough valid signatures.*1\/2/i)
        }
    })

    test('treats null per-txn signatures as missing', () => {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64, FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 2,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1, SIG_1]),
                buildResponse(ADDR_2, 'signed', [SIG_2, null]),
            ],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            // Second transaction has only 1 of 2 signatures.
            expect(result.reason).toMatch(/Transaction 1.*1\/2/i)
        }
    })

    test('treats malformed base64 signatures as missing', () => {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 2,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1]),
                buildResponse(ADDR_2, 'signed', ['@@@']),
            ],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            expect(result.reason).toMatch(/not enough valid signatures.*1\/2/i)
        }
    })

    test('rejects invalid base64 raw transaction', () => {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: ['@@@'],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [buildResponse(ADDR_1, 'signed', [SIG_1])],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            expect(result.reason).toMatch(/invalid base64 raw transaction/i)
        }
    })

    test('produces empty list for empty input', () => {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: [],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 1,
            responses: [],
        })

        expect(result).toEqual({ kind: 'success', signedTransactionsBytes: [] })
    })

    test('rejects invalid participant addresses', () => {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: ['INVALID_ADDRESS'],
            version: 1,
            threshold: 1,
            responses: [buildResponse('INVALID_ADDRESS', 'signed', [SIG_1])],
        })

        expect(result.kind).toBe('error')
        if (result.kind === 'error') {
            expect(result.reason).toMatch(/public keys/i)
        }
    })

    test('rejects invalid threshold (0 or > participants)', () => {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 0,
            responses: [],
        })
        expect(result.kind).toBe('error')

        const result2 = assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 3,
            responses: [],
        })
        expect(result2.kind).toBe('error')
    })

    test('handles multi-transaction lists (each tx gets its own signed bytes)', () => {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: [FAKE_TX_B64, FAKE_TX_B64],
            participantAddresses: [ADDR_1, ADDR_2],
            version: 1,
            threshold: 2,
            responses: [
                buildResponse(ADDR_1, 'signed', [SIG_1, SIG_1]),
                buildResponse(ADDR_2, 'signed', [SIG_2, SIG_2]),
            ],
        })

        expect(result.kind).toBe('success')
        if (result.kind !== 'success') return
        expect(result.signedTransactionsBytes).toHaveLength(2)
    })
})
