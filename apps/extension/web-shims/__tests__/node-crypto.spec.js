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

// @vitest-environment node
//
// This package's vitest.config.ts defaults to jsdom (web-shims specs render
// through react-native-web). This spec instead needs Node's real node:crypto
// as an oracle to byte-compare against the shim, so it opts into the node
// environment per-file (precedent: apps/extension/src/content/__tests__/*.test.ts
// use the same pragma the other direction, jsdom, for the same reason).
import { describe, it, expect } from 'vitest'
import * as nodeCrypto from 'node:crypto'
import * as shim from '../node-crypto'

const HASH_ALGORITHMS = ['sha256', 'sha512', 'sha512-256']

const FIXTURES = [
    { label: 'empty string', value: '' },
    { label: 'short ASCII string', value: 'hello world' },
    { label: 'fixed byte sequence', value: Uint8Array.from([0, 1, 2, 3, 4, 253, 254, 255]) },
]

describe('node-crypto web shim vs node:crypto', () => {
    describe('createHash', () => {
        for (const algorithm of HASH_ALGORITHMS) {
            for (const { label, value } of FIXTURES) {
                it(`matches node:crypto for ${algorithm} (${label})`, () => {
                    const expected = nodeCrypto.createHash(algorithm).update(value).digest('hex')
                    const actual = shim.createHash(algorithm).update(value).digest('hex')
                    expect(actual).toBe(expected)
                })
            }

            it(`${algorithm}: copy() continues independently and matches a single-pass digest`, () => {
                const part1 = 'first chunk '
                const part2 = 'second chunk'

                const original = shim.createHash(algorithm).update(part1)
                const copy = original.copy()

                original.update(part2)
                copy.update(part2)

                const expected = nodeCrypto.createHash(algorithm).update(part1).update(part2).digest('hex')

                expect(original.digest('hex')).toBe(expected)
                expect(copy.digest('hex')).toBe(expected)
            })
        }
    })

    describe('createHmac', () => {
        const KEYS = [
            { label: 'string key', value: 'super-secret-key' },
            { label: 'Uint8Array key', value: Uint8Array.from([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]) },
        ]

        for (const algorithm of HASH_ALGORITHMS) {
            for (const key of KEYS) {
                for (const { label, value } of FIXTURES) {
                    it(`matches node:crypto for ${algorithm} with ${key.label} (${label})`, () => {
                        const expected = nodeCrypto.createHmac(algorithm, key.value).update(value).digest('hex')
                        const actual = shim.createHmac(algorithm, key.value).update(value).digest('hex')
                        expect(actual).toBe(expected)
                    })
                }
            }
        }
    })

    describe('pbkdf2', () => {
        const password = 'correct horse battery staple'
        const salt = 'a-fixed-test-salt'
        const iterations = 250 // small but nontrivial: proves correctness without slowing the suite
        const keylen = 32

        for (const digest of ['sha256', 'sha512']) {
            it(`matches node:crypto for digest ${digest}`, async () => {
                const [expected, actual] = await Promise.all([
                    new Promise((resolve, reject) => {
                        nodeCrypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
                            if (err) reject(err)
                            else resolve(derivedKey)
                        })
                    }),
                    new Promise((resolve, reject) => {
                        shim.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
                            if (err) reject(err)
                            else resolve(derivedKey)
                        })
                    }),
                ])

                expect(Buffer.from(actual).toString('hex')).toBe(Buffer.from(expected).toString('hex'))
            })
        }
    })

    describe('randomBytes', () => {
        it('returns a Uint8Array of the requested length', () => {
            const bytes = shim.randomBytes(32)
            expect(bytes).toBeInstanceOf(Uint8Array)
            expect(bytes.length).toBe(32)
        })

        it('produces different output across calls', () => {
            const a = shim.randomBytes(32)
            const b = shim.randomBytes(32)
            expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(b).toString('hex'))
        })
    })
})
