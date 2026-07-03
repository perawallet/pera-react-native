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
import { isValidAddress } from 'algosdk'
import {
    deriveFalconAddressMock,
    deriveFalconKeypairMock,
    falconSignMock,
    FALCON_PUBLIC_KEY_LENGTH,
    FALCON_SIGNATURE_LENGTH,
} from '../falcon-utils'

const SEED = new Uint8Array(32).fill(7)
const OTHER_SEED = new Uint8Array(32).fill(9)
const PAYLOAD = new Uint8Array([1, 2, 3, 4, 5])
const OTHER_PAYLOAD = new Uint8Array([6, 7, 8, 9, 10])

describe('deriveFalconKeypairMock', () => {
    test('produces a 1,793-byte public key', () => {
        const { publicKey } = deriveFalconKeypairMock(SEED)
        expect(publicKey).toHaveLength(FALCON_PUBLIC_KEY_LENGTH)
        expect(FALCON_PUBLIC_KEY_LENGTH).toBe(1793)
    })

    test('is deterministic for the same seed', () => {
        const first = deriveFalconKeypairMock(SEED).publicKey
        const second = deriveFalconKeypairMock(SEED).publicKey
        expect(Array.from(first)).toEqual(Array.from(second))
    })

    test('different seeds produce different public keys', () => {
        const first = deriveFalconKeypairMock(SEED).publicKey
        const second = deriveFalconKeypairMock(OTHER_SEED).publicKey
        expect(Array.from(first)).not.toEqual(Array.from(second))
    })

    test('rejects seeds that are not 32 bytes', () => {
        expect(() => deriveFalconKeypairMock(new Uint8Array(16))).toThrow(
            RangeError,
        )
        expect(() => deriveFalconKeypairMock(new Uint8Array(64))).toThrow(
            RangeError,
        )
    })
})

describe('deriveFalconAddressMock', () => {
    test('produces a valid 58-character Algorand address', () => {
        const { publicKey } = deriveFalconKeypairMock(SEED)
        const address = deriveFalconAddressMock(publicKey)
        expect(address).toHaveLength(58)
        expect(isValidAddress(address)).toBe(true)
    })

    test('is deterministic and seed-sensitive end to end', () => {
        const addressOf = (seed: Uint8Array): string =>
            deriveFalconAddressMock(deriveFalconKeypairMock(seed).publicKey)
        expect(addressOf(SEED)).toBe(addressOf(SEED))
        expect(addressOf(SEED)).not.toBe(addressOf(OTHER_SEED))
    })
})

describe('falconSignMock', () => {
    test('produces a deterministic 1,423-byte signature for a (key, payload) pair', () => {
        const first = falconSignMock(SEED, PAYLOAD)
        const second = falconSignMock(SEED, PAYLOAD)
        expect(first).toHaveLength(FALCON_SIGNATURE_LENGTH)
        expect(FALCON_SIGNATURE_LENGTH).toBe(1423)
        expect(Array.from(first)).toEqual(Array.from(second))
    })

    test('different payloads produce different signatures', () => {
        const first = falconSignMock(SEED, PAYLOAD)
        const second = falconSignMock(SEED, OTHER_PAYLOAD)
        expect(Array.from(first)).not.toEqual(Array.from(second))
    })

    test('different keys produce different signatures for the same payload', () => {
        const first = falconSignMock(SEED, PAYLOAD)
        const second = falconSignMock(OTHER_SEED, PAYLOAD)
        expect(Array.from(first)).not.toEqual(Array.from(second))
    })
})
