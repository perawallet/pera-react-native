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
import { HDKey } from '@scure/bip32'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { KeyManagementError } from '../../../errors'
import { deriveSecp256k1PrivateKey } from '../derive'

// BIP-32 test vector 1.
const VECTOR_1_SEED = hexToBytes('000102030405060708090a0b0c0d0e0f')

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
        const key = deriveSecp256k1PrivateKey(VECTOR_1_SEED, path)

        expect(bytesToHex(key)).toBe(expected)
    })

    test('leaves the seed untouched', () => {
        const seed = new Uint8Array(VECTOR_1_SEED)

        deriveSecp256k1PrivateKey(seed, "m/0'")

        expect(seed).toEqual(VECTOR_1_SEED)
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
            expect(() =>
                deriveSecp256k1PrivateKey(VECTOR_1_SEED, path),
            ).toThrow(KeyManagementError)
        },
    )
})

afterEach(() => {
    vi.restoreAllMocks()
})
