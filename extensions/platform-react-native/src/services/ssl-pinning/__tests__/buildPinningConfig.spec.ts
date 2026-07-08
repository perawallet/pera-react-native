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

import { describe, expect, test } from 'vitest'
import { buildPinningConfig } from '../buildPinningConfig'
import { PINNED_ROOT_SPKI_HASHES, SSL_PINNING_EXPIRATION_DATE } from '../pins'

describe('buildPinningConfig', () => {
    test('builds a pin entry per perawallet.app host with the root hashes and expiration', () => {
        const result = buildPinningConfig([
            'https://mainnet.staging.api.perawallet.app',
            'https://testnet.staging.api.perawallet.app',
        ])

        expect(result).toEqual({
            'mainnet.staging.api.perawallet.app': {
                includeSubdomains: false,
                publicKeyHashes: PINNED_ROOT_SPKI_HASHES,
                expirationDate: SSL_PINNING_EXPIRATION_DATE,
            },
            'testnet.staging.api.perawallet.app': {
                includeSubdomains: false,
                publicKeyHashes: PINNED_ROOT_SPKI_HASHES,
                expirationDate: SSL_PINNING_EXPIRATION_DATE,
            },
        })
    })

    test('excludes hosts outside perawallet.app so dev overrides stay unpinned', () => {
        const result = buildPinningConfig([
            'https://mainnet.api.perawallet.app',
            'http://localhost:8000',
            'https://mainnet-api.algonode.cloud',
            // Suffix must match on a label boundary, not a substring.
            'https://evil-perawallet.app',
            'https://perawallet.app.attacker.example',
        ])

        expect(result ? Object.keys(result) : []).toEqual([
            'mainnet.api.perawallet.app',
        ])
    })

    test('pins the apex perawallet.app domain itself', () => {
        const result = buildPinningConfig(['https://perawallet.app'])

        expect(result ? Object.keys(result) : []).toEqual(['perawallet.app'])
    })

    test('dedupes hosts that appear in multiple URLs', () => {
        const result = buildPinningConfig([
            'https://mainnet.api.perawallet.app/api/v1/',
            'https://mainnet.api.perawallet.app/other/path',
        ])

        expect(result ? Object.keys(result) : []).toEqual([
            'mainnet.api.perawallet.app',
        ])
    })

    test('returns null when no pinnable host remains', () => {
        expect(buildPinningConfig(['http://localhost:8000'])).toBeNull()
        expect(buildPinningConfig([])).toBeNull()
    })

    test('skips malformed URLs without throwing', () => {
        const result = buildPinningConfig([
            'not a url',
            'https://mainnet.api.perawallet.app',
        ])

        expect(result ? Object.keys(result) : []).toEqual([
            'mainnet.api.perawallet.app',
        ])
    })
})
