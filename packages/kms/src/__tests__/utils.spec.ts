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

import { describe, test, expect, vi } from 'vitest'
import { getSeedFromMasterKey } from '../utils'

vi.mock('@perawallet/wallet-core-shared', () => ({
    decodeFromBase64: vi.fn((base64: string) => {
        const binaryString = atob(base64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }
        return bytes
    }),
}))

describe('kms/utils - getSeedFromMasterKey', () => {
    test('obtains seed from JSON stringified master key data', () => {
        const masterKey = {
            seed: btoa('test-seed'),
            entropy: 'test-entropy',
        }
        const keyData = new TextEncoder().encode(JSON.stringify(masterKey))
        const seed = getSeedFromMasterKey(keyData)

        expect(seed).toEqual(
            new Uint8Array(new TextEncoder().encode('test-seed')),
        )
    })

    test('obtains seed from raw master key data', () => {
        const keyData = new Uint8Array([1, 2, 3, 4])
        const seed = getSeedFromMasterKey(keyData)

        expect(seed).toEqual(new Uint8Array([1, 2, 3, 4]))
    })
})
