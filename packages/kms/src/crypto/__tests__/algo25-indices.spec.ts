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
import { describe, test, expect } from 'vitest'
import { mnemonicFromSeed, seedFromMnemonic } from 'algosdk'
import { algo25SeedToIndices, indicesToAlgo25Seed } from '../algo25-utils'
import {
    mnemonicIndexToWord,
    mnemonicWordsToIndices,
} from '../mnemonic-indices'

describe('algo25SeedToIndices', () => {
    const seeds: Record<string, Uint8Array> = {
        incrementing: Uint8Array.from(
            { length: 32 },
            (_, i) => (i * 13 + 5) & 0xff,
        ),
        'all-zero': new Uint8Array(32),
        'all-ff': new Uint8Array(32).fill(0xff),
    }

    test.each(Object.entries(seeds))(
        'matches the mnemonicFromSeed word path for %s seed',
        (_label, seed) => {
            const viaWords = mnemonicWordsToIndices(
                mnemonicFromSeed(seed).split(' '),
            )
            expect(Array.from(algo25SeedToIndices(seed))).toEqual(
                Array.from(viaWords!),
            )
        },
    )

    test('produces 25 indices (24 seed words + checksum)', () => {
        expect(algo25SeedToIndices(new Uint8Array(32)).length).toBe(25)
    })

    test('rejects a non-32-byte seed', () => {
        expect(() => algo25SeedToIndices(new Uint8Array(31))).toThrow(
            RangeError,
        )
    })
})

describe('indicesToAlgo25Seed', () => {
    const seeds: Record<string, Uint8Array> = {
        incrementing: Uint8Array.from(
            { length: 32 },
            (_, i) => (i * 13 + 5) & 0xff,
        ),
        'all-zero': new Uint8Array(32),
        'all-ff': new Uint8Array(32).fill(0xff),
    }

    test.each(Object.entries(seeds))(
        'round-trips algo25SeedToIndices for %s seed',
        (_label, seed) => {
            expect(
                Array.from(indicesToAlgo25Seed(algo25SeedToIndices(seed))),
            ).toEqual(Array.from(seed))
        },
    )

    test.each(Object.entries(seeds))(
        'matches the seedFromMnemonic word path for %s seed',
        (_label, seed) => {
            const indices = algo25SeedToIndices(seed)
            const viaWords = seedFromMnemonic(
                Array.from(indices, mnemonicIndexToWord).join(' '),
            )
            expect(Array.from(indicesToAlgo25Seed(indices))).toEqual(
                Array.from(viaWords),
            )
        },
    )

    test('rejects a corrupted checksum word', () => {
        const indices = algo25SeedToIndices(new Uint8Array(32).fill(1))
        indices[24] = (indices[24] + 1) & 0x7ff
        expect(() => indicesToAlgo25Seed(indices)).toThrow(/checksum/)
    })

    test('rejects a flipped data word (checksum no longer matches)', () => {
        const indices = algo25SeedToIndices(new Uint8Array(32).fill(1))
        indices[0] = (indices[0] + 1) & 0x7ff
        expect(() => indicesToAlgo25Seed(indices)).toThrow(/checksum/)
    })

    test('rejects a word count other than 25', () => {
        expect(() => indicesToAlgo25Seed(new Uint16Array(24))).toThrow(
            RangeError,
        )
    })

    test('rejects an out-of-range index', () => {
        const indices = algo25SeedToIndices(new Uint8Array(32))
        indices[0] = 2048
        expect(() => indicesToAlgo25Seed(indices)).toThrow(RangeError)
    })

    test('does not consume or zero the caller-supplied indices', () => {
        const indices = algo25SeedToIndices(new Uint8Array(32).fill(9))
        const snapshot = Array.from(indices)
        indicesToAlgo25Seed(indices)
        expect(Array.from(indices)).toEqual(snapshot)
    })
})
