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
import { describe, expect, test } from 'vitest'
import * as secp from '@noble/secp256k1'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import {
    isValidSecp256k1PrivateKey,
    secp256k1PublicKeyOf,
    signSecp256k1,
} from '../ecdsa'

const CURVE_ORDER = secp.Point.CURVE().n
const HALF_ORDER = CURVE_ORDER / 2n

const scalarBytes = (value: bigint): Uint8Array =>
    hexToBytes(value.toString(16).padStart(64, '0'))

const bigIntOf = (bytes: Uint8Array): bigint => BigInt(`0x${bytesToHex(bytes)}`)

const PRIVATE_KEY = hexToBytes(
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)

describe('isValidSecp256k1PrivateKey', () => {
    test.each([
        ['zero', new Uint8Array(32)],
        ['the curve order', scalarBytes(CURVE_ORDER)],
        ['above the curve order', scalarBytes(CURVE_ORDER + 1n)],
        ['all ones', new Uint8Array(32).fill(0xff)],
        ['31 bytes', new Uint8Array(31).fill(1)],
        ['33 bytes', new Uint8Array(33).fill(1)],
    ])('rejects %s', (_label, key) => {
        expect(isValidSecp256k1PrivateKey(key)).toBe(false)
    })

    test.each([
        ['one', scalarBytes(1n)],
        ['the curve order minus one', scalarBytes(CURVE_ORDER - 1n)],
    ])('accepts %s', (_label, key) => {
        expect(isValidSecp256k1PrivateKey(key)).toBe(true)
    })
})

describe('secp256k1PublicKeyOf', () => {
    test('returns the 65-byte uncompressed SEC1 point', () => {
        const publicKey = secp256k1PublicKeyOf(PRIVATE_KEY)

        expect(publicKey).toHaveLength(65)
        expect(publicKey[0]).toBe(0x04)
        expect(publicKey).toEqual(secp.getPublicKey(PRIVATE_KEY, false))
    })
})

describe('signSecp256k1', () => {
    const publicKey = secp256k1PublicKeyOf(PRIVATE_KEY)
    const compressedPublicKey = secp.getPublicKey(PRIVATE_KEY, true)

    test('every signature verifies, is low-s and recovers the signer', () => {
        // Seeded digests, so a failure reproduces.
        for (let i = 0; i < 64; i++) {
            const digest = sha256(new TextEncoder().encode(`digest-${i}`))

            const { r, s, recovery } = signSecp256k1(digest, PRIVATE_KEY)

            expect(r).toHaveLength(32)
            expect(s).toHaveLength(32)
            expect(bigIntOf(s) <= HALF_ORDER).toBe(true)
            const compact = new Uint8Array([...r, ...s])
            expect(
                secp.verify(compact, digest, publicKey, { prehash: false }),
            ).toBe(true)
            const recovered = secp.recoverPublicKey(
                new Uint8Array([recovery, ...r, ...s]),
                digest,
                { prehash: false },
            )
            expect(recovered).toEqual(compressedPublicKey)
        }
    })

    test('signs the digest as given, without hashing it again', () => {
        const digest = new Uint8Array(32).fill(7)

        const { r, s } = signSecp256k1(digest, PRIVATE_KEY)

        const compact = new Uint8Array([...r, ...s])
        expect(
            secp.verify(compact, digest, publicKey, { prehash: false }),
        ).toBe(true)
        expect(secp.verify(compact, digest, publicKey)).toBe(false)
    })

    test('leaves the private key untouched', () => {
        const key = new Uint8Array(PRIVATE_KEY)

        signSecp256k1(new Uint8Array(32).fill(1), key)

        expect(key).toEqual(PRIVATE_KEY)
    })
})
