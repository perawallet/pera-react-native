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
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as secp from '@noble/secp256k1'
import { HDKey } from '@scure/bip32'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { InvalidKeyDataError } from '@algorandfoundation/keystore-core'
import {
    deriveSecp256k1PrivateKey,
    parseBip32Path,
    secp256k1Binding,
    signSecp256k1Recoverable,
} from '../binding'

// BIP-32 test vector 1.
const VECTOR_1_SEED = hexToBytes('000102030405060708090a0b0c0d0e0f')
const CURVE_ORDER = secp.Point.CURVE().n
const PRIVATE_KEY = hexToBytes(
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)

const scalarBytes = (value: bigint): Uint8Array =>
    hexToBytes(value.toString(16).padStart(64, '0'))

const bigIntOf = (bytes: Uint8Array): bigint => BigInt(`0x${bytesToHex(bytes)}`)

afterEach(() => {
    vi.restoreAllMocks()
})

describe('deriveSecp256k1PrivateKey', () => {
    test.each([
        [
            'm',
            'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
        ],
        [
            "m/0'",
            'edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea',
        ],
        [
            "m/0'/1/2'",
            'cbce0d719ecf7431d88e6a89fa1483e02e35092af60c042b1df2ff59fa424dca',
        ],
        [
            "m/0'/1/2'/2/1000000000",
            '471b76e389e528d6de6d816857e012c5455051cad6660850e58372a6c3e6e7c8',
        ],
    ])('derives the BIP-32 vector 1 key at %s', (path, expected) => {
        expect(bytesToHex(deriveSecp256k1PrivateKey(VECTOR_1_SEED, path))).toBe(
            expected,
        )
    })

    test('wipes the master and every node along the path', () => {
        const wipe = vi.spyOn(HDKey.prototype, 'wipePrivateData')

        deriveSecp256k1PrivateKey(VECTOR_1_SEED, "m/44'/60'/0'/0/0")

        // m plus five path segments
        expect(wipe).toHaveBeenCalledTimes(6)
    })

    test.each([["44'/60'"], ["m/44'/x"], ['m//0'], [`m/${2 ** 31}`]])(
        'rejects the malformed path %s',
        path => {
            expect(() => parseBip32Path(path)).toThrow(InvalidKeyDataError)
            expect(() =>
                deriveSecp256k1PrivateKey(VECTOR_1_SEED, path),
            ).toThrow(InvalidKeyDataError)
        },
    )
})

describe('secp256k1Binding.isValidPrivateKey', () => {
    test.each([
        ['zero', new Uint8Array(32)],
        ['the curve order', scalarBytes(CURVE_ORDER)],
        ['31 bytes', new Uint8Array(31).fill(1)],
        ['33 bytes', new Uint8Array(33).fill(1)],
    ])('rejects %s', (_label, key) => {
        expect(secp256k1Binding.isValidPrivateKey(key)).toBe(false)
    })

    test.each([
        ['one', scalarBytes(1n)],
        ['the curve order minus one', scalarBytes(CURVE_ORDER - 1n)],
    ])('accepts %s', (_label, key) => {
        expect(secp256k1Binding.isValidPrivateKey(key)).toBe(true)
    })
})

describe('secp256k1Binding.publicKeyOf', () => {
    test('returns the 65-byte uncompressed SEC1 point', () => {
        const publicKey = secp256k1Binding.publicKeyOf(PRIVATE_KEY)

        expect(publicKey).toHaveLength(65)
        expect(publicKey[0]).toBe(0x04)
    })
})

describe('signSecp256k1Recoverable', () => {
    const publicKey = secp256k1Binding.publicKeyOf(PRIVATE_KEY)
    const compressedPublicKey = secp.getPublicKey(PRIVATE_KEY, true)

    test('every signature verifies, is low-s and recovers the signer', () => {
        // Seeded digests, so a failure reproduces.
        for (let i = 0; i < 64; i++) {
            const digest = sha256(new TextEncoder().encode(`digest-${i}`))

            const signature = signSecp256k1Recoverable(PRIVATE_KEY, digest)

            expect(signature).toHaveLength(65)
            const compact = signature.slice(0, 64)
            const yParity = signature[64]
            expect([0, 1]).toContain(yParity)
            expect(bigIntOf(compact.slice(32)) <= CURVE_ORDER / 2n).toBe(true)
            expect(
                secp.verify(compact, digest, publicKey, { prehash: false }),
            ).toBe(true)
            expect(
                secp.recoverPublicKey(
                    new Uint8Array([yParity, ...compact]),
                    digest,
                    { prehash: false },
                ),
            ).toEqual(compressedPublicKey)
        }
    })

    test('is deterministic and signs the digest as given', () => {
        const digest = new Uint8Array(32).fill(7)

        const first = signSecp256k1Recoverable(PRIVATE_KEY, digest)
        const second = signSecp256k1Recoverable(PRIVATE_KEY, digest)

        expect(second).toEqual(first)
        expect(secp.verify(first.slice(0, 64), digest, publicKey)).toBe(false)
    })
})
