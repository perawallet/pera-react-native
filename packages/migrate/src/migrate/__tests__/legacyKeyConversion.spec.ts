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

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@perawallet/wallet-core-kms', () => ({
    algo25SecretKeyToMnemonic: vi.fn(),
    entropyToMnemonic: vi.fn(
        (entropy: Uint8Array) => `bip39-mnemonic-${entropy.length}B`,
    ),
}))

import { entropyToMnemonic } from '@perawallet/wallet-core-kms'
import type { LegacyHDWallet } from '@perawallet/wallet-extension-platform'
import {
    hdWalletEntropyToMnemonic,
    describeBytes,
} from '../legacyKeyConversion'

beforeEach(() => {
    vi.mocked(entropyToMnemonic).mockClear()
})

describe('hdWalletEntropyToMnemonic', () => {
    const buildWallet = (
        overrides: Partial<LegacyHDWallet> = {},
    ): LegacyHDWallet => ({
        walletId: 'wallet-1',
        name: null,
        entropy: new Uint8Array(32).fill(1),
        keys: [],
        ...overrides,
    })

    it('delegates to kms entropyToMnemonic with the entropy bytes', () => {
        const entropy = new Uint8Array(32).fill(0xab)

        const mnemonic = hdWalletEntropyToMnemonic(buildWallet({ entropy }))

        expect(mnemonic).toBe('bip39-mnemonic-32B')
        const arg = vi.mocked(entropyToMnemonic).mock.calls[0][0]
        expect(arg).toBeInstanceOf(Uint8Array)
        expect(arg).toHaveLength(32)
    })

    it('wipes the transient entropy copy after deriving the mnemonic', () => {
        hdWalletEntropyToMnemonic(
            buildWallet({ entropy: new Uint8Array(32).fill(0xab) }),
        )

        const passedCopy = vi.mocked(entropyToMnemonic).mock.calls[0][0]
        expect(passedCopy.every(b => b === 0)).toBe(true)
    })

    it('leaves the source entropy on the wallet intact for the caller to wipe', () => {
        const entropy = new Uint8Array(32).fill(0xab)

        hdWalletEntropyToMnemonic(buildWallet({ entropy }))

        expect(entropy.every(b => b === 0xab)).toBe(true)
    })

    it('throws when entropy is null', () => {
        expect(() =>
            hdWalletEntropyToMnemonic(
                buildWallet({ walletId: 'w-null', entropy: null }),
            ),
        ).toThrow('HD wallet w-null has no entropy')
    })

    it('throws when entropy is empty', () => {
        expect(() =>
            hdWalletEntropyToMnemonic(
                buildWallet({
                    walletId: 'w-empty',
                    entropy: new Uint8Array(0),
                }),
            ),
        ).toThrow('HD wallet w-empty has no entropy')
    })
})

describe('describeBytes', () => {
    it('returns "null" for null input', () => {
        expect(describeBytes(null)).toBe('null')
    })

    it('returns "empty" for a zero-length buffer', () => {
        expect(describeBytes(new Uint8Array(0))).toBe('empty')
    })

    it('returns the byte length suffixed with B for non-empty buffers', () => {
        expect(describeBytes(new Uint8Array(5))).toBe('5B')
        expect(describeBytes(new Uint8Array(32))).toBe('32B')
    })
})
