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

import { describe, test, expect } from 'vitest'
import { mnemonicIndexToWord } from '@perawallet/wallet-core-kms'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import { generateCloudBackupCredentials } from '../generateCloudBackupCredentials'

describe('generateCloudBackupCredentials', () => {
    test('produces 12 wordlist indices that resolve to non-empty words', () => {
        const { mnemonicIndices } = generateCloudBackupCredentials()

        expect(mnemonicIndices).toBeInstanceOf(Uint16Array)
        expect(mnemonicIndices).toHaveLength(12)
        expect(
            Array.from(mnemonicIndices, index =>
                mnemonicIndexToWord(index),
            ).every(word => word.length > 0),
        ).toBe(true)
    })

    test('produces a base64 salt that decodes to 16 bytes', () => {
        const { salt } = generateCloudBackupCredentials()

        expect(decodeFromBase64(salt)).toHaveLength(16)
    })

    test('generates fresh credentials on each call', () => {
        const first = generateCloudBackupCredentials()
        const second = generateCloudBackupCredentials()

        expect(Array.from(first.mnemonicIndices)).not.toEqual(
            Array.from(second.mnemonicIndices),
        )
        expect(first.salt).not.toBe(second.salt)
    })
})
