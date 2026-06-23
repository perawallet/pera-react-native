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
import { describe, test, expect } from 'vitest'
import { mnemonicFromSeed } from '@algorandfoundation/algokit-utils/algo25'
import { algo25SeedToIndices } from '../algo25-utils'
import { mnemonicWordsToIndices } from '../mnemonic-indices'

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
