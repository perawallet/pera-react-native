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
import { deriveBackupChildKeys } from '../deriveBackupChildKeys'

const hex = (bytes: Uint8Array): string =>
    Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

const MASTER_KEY = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1))

describe('deriveBackupChildKeys', () => {
    test('derives K_enc with the backup-encryption-key HKDF label', () => {
        const { encryptionKey } = deriveBackupChildKeys(MASTER_KEY)

        expect(hex(encryptionKey)).toBe(
            '31b53a4316ec4c91873d458a6f151a5696ea6342e92bcfa8ef478eeb38f228a3',
        )
    })

    test('derives K_auth_seed with the backup-auth-seed HKDF label', () => {
        const { authSeed } = deriveBackupChildKeys(MASTER_KEY)

        expect(hex(authSeed)).toBe(
            'ce7819d8a0f71ee84da37299c3fbd602e149c6d62f2525be0205207284fc2aa0',
        )
    })

    test('produces 32-byte child keys', () => {
        const { encryptionKey, authSeed } = deriveBackupChildKeys(MASTER_KEY)

        expect(encryptionKey).toHaveLength(32)
        expect(authSeed).toHaveLength(32)
    })
})
