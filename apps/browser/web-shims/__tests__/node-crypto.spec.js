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
// environment per-file (precedent: apps/browser/src/content/__tests__/*.spec.ts
// use the same pragma the other direction, jsdom, for the same reason).
import { describe, it, expect, vi, afterEach } from 'vitest'
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
    describe('argon2', () => {
        // Produced by Node 24's OpenSSL-backed crypto.argon2, an implementation
        // independent of noble; CI's Node has no argon2 to compare against live.
        const VECTORS = [
            {
                label: 'm=64 KiB, t=3, p=1, 32 bytes',
                params: { parallelism: 1, tagLength: 32, memory: 64, passes: 3 },
                expected: 'c36de374cc0f7f642549b74d7bf57cdfc7744ba584890ff8c1cbecd80addebab',
            },
            {
                label: 'm=128 KiB, t=2, p=2, 16 bytes',
                params: { parallelism: 2, tagLength: 16, memory: 128, passes: 2 },
                expected: 'd2ad75ff5c5276cd052bc2c66491c4f3',
            },
        ]
        const message = new TextEncoder().encode('correct horse battery staple')
        const nonce = new TextEncoder().encode('a-fixed-test-salt')

        const derive = (algorithm, params) =>
            new Promise((resolve, reject) => {
                shim.argon2(algorithm, { message, nonce, ...params }, (err, result) => {
                    if (err) reject(err)
                    else resolve(result)
                })
            })

        afterEach(() => {
            vi.unstubAllGlobals()
        })

        for (const { label, params, expected } of VECTORS) {
            it(`matches the OpenSSL argon2id output (${label})`, async () => {
                const result = await derive('argon2id', params)
                expect(Buffer.from(result).toString('hex')).toBe(expected)
            })
        }

        it('derives in the vault argon2 worker when one can start', async () => {
            const posted = []
            class FakeWorker {
                constructor(url) { this.url = url }
                postMessage(request) {
                    posted.push({ url: this.url, request })
                    queueMicrotask(() => this.onmessage({ data: Uint8Array.from([7, 7, 7]) }))
                }
                terminate() {}
            }
            vi.stubGlobal('Worker', FakeWorker)

            const result = await derive('argon2id', VECTORS[0].params)

            expect(Array.from(result)).toEqual([7, 7, 7])
            expect(posted).toHaveLength(1)
            expect(posted[0].url).toBe('argon2-worker.js')
            expect(posted[0].request).toMatchObject({ m: 64, t: 3, p: 1 })
        })

        it('falls back to deriving inline when the worker fails', async () => {
            class FailingWorker {
                postMessage() {
                    queueMicrotask(() => this.onerror({ message: 'missing file' }))
                }
                terminate() {}
            }
            vi.stubGlobal('Worker', FailingWorker)

            const result = await derive('argon2id', VECTORS[0].params)

            expect(Buffer.from(result).toString('hex')).toBe(VECTORS[0].expected)
        })

        it('rejects an algorithm other than argon2id', async () => {
            await expect(derive('argon2d', VECTORS[0].params)).rejects.toThrow('unsupported algorithm')
        })
    })

    describe('aes-256-gcm', () => {
        const key = Uint8Array.from({ length: 32 }, (_, i) => i)
        const iv = Uint8Array.from({ length: 12 }, (_, i) => 100 + i)
        const aad = new TextEncoder().encode('backup-item')
        const plaintext = new TextEncoder().encode('{"address":"ALGO","name":"Main"}')

        const seal = crypto => {
            const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
            cipher.setAAD(aad)
            const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
            return { ciphertext, tag: Buffer.from(cipher.getAuthTag()) }
        }

        const open = (crypto, { ciphertext, tag }, openAad = aad) => {
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
            decipher.setAAD(openAad)
            decipher.setAuthTag(tag)
            return Buffer.concat([decipher.update(ciphertext), decipher.final()])
        }

        it('seals byte-identically to node:crypto', () => {
            const expected = seal(nodeCrypto)
            const actual = seal(shim)
            expect(actual.ciphertext.toString('hex')).toBe(expected.ciphertext.toString('hex'))
            expect(actual.tag.toString('hex')).toBe(expected.tag.toString('hex'))
        })

        it('opens what node:crypto sealed', () => {
            expect(open(shim, seal(nodeCrypto)).toString('hex')).toBe(Buffer.from(plaintext).toString('hex'))
        })

        it('throws when the tag does not verify', () => {
            const sealed = seal(shim)
            sealed.tag[0] ^= 1
            expect(() => open(shim, sealed)).toThrow()
        })

        it('throws when the AAD differs', () => {
            expect(() => open(shim, seal(shim), new TextEncoder().encode('other'))).toThrow()
        })

        it('rejects other ciphers and key sizes', () => {
            expect(() => shim.createCipheriv('aes-128-gcm', key.subarray(0, 16), iv)).toThrow('unsupported algorithm')
            expect(() => shim.createCipheriv('aes-256-gcm', key.subarray(0, 16), iv)).toThrow('32-byte key')
        })
    })
})
