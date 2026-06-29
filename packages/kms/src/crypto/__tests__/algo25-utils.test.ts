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

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('algosdk', async importOriginal => ({
    ...(await importOriginal<typeof import('algosdk')>()),
    mnemonicFromSeed: vi.fn(
        (seed: Uint8Array) => `mnemonic-from-${seed.length}-bytes`,
    ),
}))

import { mnemonicFromSeed } from 'algosdk'
import { algo25SecretKeyToMnemonic } from '../algo25-utils'

beforeEach(() => {
    vi.mocked(mnemonicFromSeed).mockClear()
})

describe('algo25SecretKeyToMnemonic', () => {
    it('truncates a 64-byte keypair to a 32-byte seed before deriving', () => {
        const secretKey = new Uint8Array(64).fill(7)

        const mnemonic = algo25SecretKeyToMnemonic(secretKey)

        expect(mnemonic).toBe('mnemonic-from-32-bytes')
        const seedArg = vi.mocked(mnemonicFromSeed).mock.calls[0][0]
        expect(seedArg).toHaveLength(32)
    })

    it('uses the full buffer when it is shorter than 32 bytes', () => {
        const secretKey = new Uint8Array(16).fill(3)

        const mnemonic = algo25SecretKeyToMnemonic(secretKey)

        expect(mnemonic).toBe('mnemonic-from-16-bytes')
    })

    it('zeroes the derived seed slice after deriving the mnemonic', () => {
        let capturedSeed: Uint8Array | null = null
        vi.mocked(mnemonicFromSeed).mockImplementationOnce(seed => {
            capturedSeed = seed
            return 'words'
        })
        const secretKey = new Uint8Array(64).fill(0xff)

        algo25SecretKeyToMnemonic(secretKey)

        expect(capturedSeed).not.toBeNull()
        expect(Array.from(capturedSeed!)).toEqual(Array(32).fill(0))
    })

    it('still zeroes the seed when mnemonicFromSeed throws', () => {
        let capturedSeed: Uint8Array | null = null
        vi.mocked(mnemonicFromSeed).mockImplementationOnce(seed => {
            capturedSeed = seed
            throw new Error('derive failure')
        })
        const secretKey = new Uint8Array(32).fill(0x42)

        expect(() => algo25SecretKeyToMnemonic(secretKey)).toThrow(
            'derive failure',
        )
        expect(Array.from(capturedSeed!)).toEqual(Array(32).fill(0))
    })
})
