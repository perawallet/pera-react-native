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

import { describe, test, expect, vi } from 'vitest'
import { fromSeed } from '@algorandfoundation/xhd-wallet-api'
import { mnemonicToEntropy, mnemonicToSeedSync } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { entropyToIndices, generateHDMasterKey } from '../hdwallet-utils'
import { prepareHDMasterKey } from '../prepare-hd-master-key'
import { mnemonicWordsToIndices } from '../mnemonic-indices'

vi.mock('@algorandfoundation/xhd-wallet-api', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@algorandfoundation/xhd-wallet-api')
        >()
    return { ...actual, fromSeed: vi.fn(actual.fromSeed) }
})

// Spied, not replaced, so a test can inspect the real master key it produced.
vi.mock('../hdwallet-utils', async importOriginal => {
    const actual = await importOriginal<typeof import('../hdwallet-utils')>()
    return {
        ...actual,
        generateHDMasterKey: vi.fn(actual.generateHDMasterKey),
    }
})

const USER_MNEMONIC =
    'achieve plunge scare have music possible will garden expect kangaroo impulse deny obvious inhale expand process betray voice crash insane electric mean test rude'
const USER_MNEMONIC_INDICES = mnemonicWordsToIndices(USER_MNEMONIC.split(' '))!

const TWELVE_WORD_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('prepareHDMasterKey', () => {
    test('derives a 12-word phrase to its 16-byte entropy and the standard BIP-39 root key', async () => {
        const result = await prepareHDMasterKey({
            mnemonicIndices: mnemonicWordsToIndices(
                TWELVE_WORD_MNEMONIC.split(' '),
            )!,
        })

        expect(Array.from(result.entropy)).toEqual(
            Array.from(mnemonicToEntropy(TWELVE_WORD_MNEMONIC, wordlist)),
        )
        expect(result.entropy.byteLength).toBe(16)
        expect(Array.from(result.rootKey)).toEqual(
            Array.from(fromSeed(mnemonicToSeedSync(TWELVE_WORD_MNEMONIC))),
        )
    })

    test('rejects a 12-word phrase with a bad checksum before deriving anything', async () => {
        const indices = mnemonicWordsToIndices(new Array(12).fill('abandon'))!

        await expect(
            prepareHDMasterKey({ mnemonicIndices: indices }),
        ).rejects.toThrow(/checksum/)
        expect(fromSeed).not.toHaveBeenCalled()
    })

    test('still mints a 24-word phrase (32-byte entropy) when no mnemonic is given', async () => {
        const result = await prepareHDMasterKey()

        expect(result.entropy.byteLength).toBe(32)
        expect(entropyToIndices(result.entropy)).toHaveLength(24)
    })

    test('returns rootKey (96B), entropy (32B), and a stable id when indices provided', async () => {
        const result = await prepareHDMasterKey({
            mnemonicIndices: USER_MNEMONIC_INDICES,
        })
        expect(result.rootKey.byteLength).toBe(96)
        expect(result.entropy.byteLength).toBe(32)
        expect(typeof result.keyId).toBe('string')
        expect(result.keyId.length).toBeGreaterThan(0)
    })

    test('uses the supplied id when given', async () => {
        const result = await prepareHDMasterKey({
            mnemonicIndices: USER_MNEMONIC_INDICES,
            id: 'fixed-id-123',
        })
        expect(result.keyId).toBe('fixed-id-123')
    })

    test('generates fresh entropy on each call when no mnemonic provided', async () => {
        const a = await prepareHDMasterKey()
        const b = await prepareHDMasterKey()
        expect(a.entropy.byteLength).toBe(32)
        expect(b.entropy.byteLength).toBe(32)
        const aHex = Array.from(a.entropy)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('')
        const bHex = Array.from(b.entropy)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('')
        expect(aHex).not.toBe(bHex)
    })

    test('zeroes the seed and entropy when root-key derivation throws', async () => {
        vi.mocked(fromSeed).mockImplementationOnce(() => {
            throw new Error('bad seed')
        })

        await expect(
            prepareHDMasterKey({ mnemonicIndices: USER_MNEMONIC_INDICES }),
        ).rejects.toThrow('bad seed')

        const masterKey = await vi
            .mocked(generateHDMasterKey)
            .mock.results.at(-1)!.value
        expect(masterKey.seed.every((byte: number) => byte === 0)).toBe(true)
        expect(masterKey.entropy.every((byte: number) => byte === 0)).toBe(true)
    })
})
