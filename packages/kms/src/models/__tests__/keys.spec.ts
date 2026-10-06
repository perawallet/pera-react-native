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

import { describe, test, expect } from 'vitest'
import type { Key } from '@algorandfoundation/keystore-core'
import { KeyManagementError } from '../../errors'
import {
    FALCON_CHILD_KEY_TYPE,
    PQ_DERIVATION_CANONICAL,
    PQ_DERIVATION_LEGACY,
    decodeSecp256k1Signature,
    encodeSecp256k1Signature,
    isSecp256k1Key,
    quantumSignKeyId,
    secp256k1SignKeyId,
} from '../keys'

describe('PQDerivation constants', () => {
    // `extensions/provider` cannot import these (workspace cycle) so it
    // declares its own copies of the literals. Pinning the values here, not
    // just the id shapes below, is what keeps that duplication safe — a
    // drifted literal on either side would silently break the provider's
    // ability to recognise legacy vs. canonical children.
    test('legacy derivation is the literal "legacy"', () => {
        expect(PQ_DERIVATION_LEGACY).toBe('legacy')
    })

    test('canonical derivation is the literal "pqk1"', () => {
        expect(PQ_DERIVATION_CANONICAL).toBe('pqk1')
    })
})

describe('quantumSignKeyId', () => {
    test('legacy derivation keeps the historical id', () => {
        // Existing accounts persist this exact string as `keyPairId`. Changing
        // it orphans every quantum account created before.
        expect(quantumSignKeyId('seed-1', PQ_DERIVATION_LEGACY)).toBe(
            'seed-1-quantum',
        )
    })

    test('canonical derivation gets a distinct id', () => {
        expect(quantumSignKeyId('seed-1', PQ_DERIVATION_CANONICAL)).toBe(
            'seed-1-quantum-pqk1',
        )
    })

    test('the two derivations never collide for one seed', () => {
        // A single seed hosts both children once dual-derivation import lands.
        expect(quantumSignKeyId('seed-1', PQ_DERIVATION_LEGACY)).not.toBe(
            quantumSignKeyId('seed-1', PQ_DERIVATION_CANONICAL),
        )
    })

    test('does not name the signature algorithm', () => {
        expect(
            quantumSignKeyId('seed-1', PQ_DERIVATION_CANONICAL),
        ).not.toContain('falcon')
    })
})

describe('FALCON_CHILD_KEY_TYPE', () => {
    // Spelled exactly as keystore-core's KeyType: the engine stamps this
    // literal onto the entry it generates, so a drifted spelling would make
    // every "is this child quantum?" guard read false.
    test('names the concrete algorithm on the keystore child entry', () => {
        expect(FALCON_CHILD_KEY_TYPE).toBe('falcon-1024')
    })
})

describe('secp256k1SignKeyId', () => {
    test('keys the child by seed, account and key index', () => {
        expect(secp256k1SignKeyId('seed-1', 0, 3)).toBe(
            'seed-1-bip32-acc0-idx3',
        )
    })

    test('never names the algorithm', () => {
        const id = secp256k1SignKeyId('seed-1', 2, 7)

        expect(id).not.toMatch(/secp256k1|ecdsa/i)
    })
})

describe('isSecp256k1Key', () => {
    const entry = (overrides: Partial<Key>): Key => ({
        id: 'k',
        type: 'secret-key',
        algorithm: 'raw',
        extractable: false,
        metadata: {
            pera: {
                keyScheme: 'secp256k1',
                origin: 'derived',
                publicKey: '04',
            },
        },
        ...overrides,
    })

    test('recognises a secret-key entry marked secp256k1', () => {
        expect(isSecp256k1Key(entry({}))).toBe(true)
    })

    test('rejects an entropy secret, an ed25519 child and a missing key', () => {
        expect(
            isSecp256k1Key(
                entry({ metadata: { parentKeyId: 's', entropyKey: true } }),
            ),
        ).toBe(false)
        expect(isSecp256k1Key(entry({ type: 'hd-derived-ed25519' }))).toBe(
            false,
        )
        expect(isSecp256k1Key(undefined)).toBe(false)
    })
})

describe('secp256k1 signature encoding', () => {
    const signature = {
        r: new Uint8Array(32).fill(0x11),
        s: new Uint8Array(32).fill(0x22),
        recovery: 1 as const,
    }

    test('lays out r, s and the recovery byte in 65 bytes', () => {
        const bytes = encodeSecp256k1Signature(signature)

        expect(bytes).toHaveLength(65)
        expect(bytes[0]).toBe(0x11)
        expect(bytes[32]).toBe(0x22)
        expect(bytes[64]).toBe(1)
        expect(decodeSecp256k1Signature(bytes)).toEqual(signature)
    })

    test('rejects a wrong length or a recovery byte other than 0 or 1', () => {
        const bytes = encodeSecp256k1Signature(signature)
        const badRecovery = new Uint8Array(bytes)
        badRecovery[64] = 2

        expect(() => decodeSecp256k1Signature(bytes.slice(0, 64))).toThrow(
            KeyManagementError,
        )
        expect(() => decodeSecp256k1Signature(badRecovery)).toThrow(
            KeyManagementError,
        )
    })
})
