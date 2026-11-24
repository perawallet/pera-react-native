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

import { describe, expect, test } from 'vitest'
import { mnemonicIndexToWord } from '@perawallet/wallet-core-kms'
import { pickVerificationPairs } from '../verificationPairs'

describe('pickVerificationPairs', () => {
    test('picks three distinct positions, each with the word stored there', () => {
        const indices = Uint16Array.from({ length: 12 }, (_, i) => i * 100 + 7)

        const pairs = pickVerificationPairs(indices)

        expect(pairs).toHaveLength(3)
        expect(new Set(pairs.map(pair => pair.index)).size).toBe(3)
        for (const { index, word } of pairs) {
            expect(index).toBeGreaterThanOrEqual(0)
            expect(index).toBeLessThan(indices.length)
            expect(word).toBe(mnemonicIndexToWord(indices[index]))
        }
    })
})
