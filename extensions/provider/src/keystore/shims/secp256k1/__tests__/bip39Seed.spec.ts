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
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { InvalidKeyDataError } from '@algorandfoundation/keystore-core'
import { bip39SeedFromEntropy } from '../bip39Seed'

const subtle = globalThis.crypto.subtle

const entropyOf = (length: number): Uint8Array =>
    Uint8Array.from({ length }, (_, i) => (i * 37 + 11) & 0xff)

describe('bip39SeedFromEntropy', () => {
    test.each([16, 32])(
        'matches @scure/bip39 for %d bytes of entropy',
        async length => {
            const entropy = entropyOf(length)
            const expected = mnemonicToSeedSync(
                entropyToMnemonic(entropy, wordlist),
            )

            const seed = await bip39SeedFromEntropy(subtle, entropy)

            expect(seed).toEqual(expected)
        },
    )

    test('leaves the entropy untouched and zeroes the mnemonic bytes', async () => {
        const entropy = entropyOf(32)
        const imported: Uint8Array[] = []
        const spying: SubtleCrypto = Object.assign(Object.create(subtle), {
            importKey: (...args: Parameters<SubtleCrypto['importKey']>) => {
                imported.push(args[1] as Uint8Array)
                return (
                    subtle.importKey as (...a: unknown[]) => Promise<CryptoKey>
                )(...args)
            },
            deriveBits: subtle.deriveBits.bind(subtle),
        })

        await bip39SeedFromEntropy(spying, entropy)

        expect(entropy).toEqual(entropyOf(32))
        expect(imported).toHaveLength(1)
        expect(imported[0].length).toBeGreaterThan(0)
        expect(imported[0].every(byte => byte === 0)).toBe(true)
    })

    test.each([15, 17, 36])('rejects %d bytes of entropy', async length => {
        await expect(
            bip39SeedFromEntropy(subtle, entropyOf(length)),
        ).rejects.toBeInstanceOf(InvalidKeyDataError)
    })
})
