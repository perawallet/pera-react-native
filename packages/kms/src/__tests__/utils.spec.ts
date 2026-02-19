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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { getSeedFromMasterKey, getEntropyFromMasterKey } from '../utils'
import { StoredKeyMaterial } from '../models'
import { KeyManagementError } from '../errors'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        decodeFromBase64: vi.fn((base64: string) => {
            const binaryString = atob(base64)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
            }
            return bytes
        }),
    }
})

describe('kms/utils', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getSeedFromMasterKey', () => {
        test('obtains seed from StoredKeyMaterial with base64 seed', () => {
            const storedKey: StoredKeyMaterial = {
                seed: btoa('test-seed'),
                seedFormat: 'base64',
            }
            const seed = getSeedFromMasterKey(storedKey)

            expect(seed).toEqual(
                new Uint8Array(new TextEncoder().encode('test-seed')),
            )
        })

        test('obtains seed from StoredKeyMaterial with entropy', () => {
            const storedKey: StoredKeyMaterial = {
                seed: btoa('test-seed'),
                seedFormat: 'base64',
                entropy: btoa('test-entropy'),
            }
            const seed = getSeedFromMasterKey(storedKey)

            expect(seed).toEqual(
                new Uint8Array(new TextEncoder().encode('test-seed')),
            )
        })

        test('throws KeyManagementError when decoding fails', () => {
            vi.mocked(decodeFromBase64).mockImplementationOnce(() => {
                throw new Error('decode failed')
            })

            const storedKey: StoredKeyMaterial = {
                seed: 'invalid',
                seedFormat: 'base64',
            }

            expect(() => getSeedFromMasterKey(storedKey)).toThrow(
                KeyManagementError,
            )
        })
    })

    describe('getEntropyFromMasterKey', () => {
        test('returns decoded entropy when present', () => {
            const storedKey: StoredKeyMaterial = {
                seed: btoa('seed'),
                seedFormat: 'base64',
                entropy: btoa('test-entropy'),
            }
            const entropy = getEntropyFromMasterKey(storedKey)

            expect(entropy).toEqual(
                new Uint8Array(new TextEncoder().encode('test-entropy')),
            )
        })

        test('returns null when entropy is not present', () => {
            const storedKey: StoredKeyMaterial = {
                seed: btoa('seed'),
                seedFormat: 'base64',
            }
            const entropy = getEntropyFromMasterKey(storedKey)

            expect(entropy).toBeNull()
        })

        test('throws KeyManagementError when decoding fails', () => {
            vi.mocked(decodeFromBase64).mockImplementationOnce(() => {
                throw new Error('decode failed')
            })

            const storedKey: StoredKeyMaterial = {
                seed: btoa('seed'),
                seedFormat: 'base64',
                entropy: 'invalid-entropy',
            }

            expect(() => getEntropyFromMasterKey(storedKey)).toThrow(
                KeyManagementError,
            )
        })
    })
})
