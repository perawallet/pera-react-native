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

import { describe, test, expect, vi } from 'vitest'

// Argon2id is native-only; mock it to a fixed master key (0x01..0x20) so the
// orchestration is deterministic and the downstream HKDF/Ed25519 vectors match
// the per-unit specs.
const { deriveBackupMasterKeyMock } = vi.hoisted(() => ({
    deriveBackupMasterKeyMock: vi.fn(
        async () => new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1)),
    ),
}))

vi.mock('../deriveBackupMasterKey', () => ({
    deriveBackupMasterKey: deriveBackupMasterKeyMock,
}))

import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { deriveBackupKeys } from '../deriveBackupKeys'

const hex = (bytes: Uint8Array): string =>
    Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

const SALT = encodeToBase64(new Uint8Array(16).fill(9))

describe('deriveBackupKeys', () => {
    test('derives backupId and child keys from mnemonic + salt', async () => {
        const result = await deriveBackupKeys({
            mnemonic: ['abandon', 'ability', 'able'],
            salt: SALT,
        })

        expect(result.backupId).toBe(
            'did:pera:DACRSHIYIZJMAW7C42ORH2BNF54SPP4SF6B5A4ZB47OMOLPY3QXUX3WV54',
        )
        expect(hex(result.encryptionKey)).toBe(
            '31b53a4316ec4c91873d458a6f151a5696ea6342e92bcfa8ef478eeb38f228a3',
        )
        expect(hex(result.authPublicKey)).toBe(
            '1805191d184652c05be2e69d13e82d2f7927bf922f83d07321e7dcc72df8dc2f',
        )
    })

    test('feeds the decoded salt bytes into the master-key derivation', async () => {
        await deriveBackupKeys({ mnemonic: ['abandon'], salt: SALT })

        const saltArg = deriveBackupMasterKeyMock.mock.calls.at(-1)?.[1]
        expect(saltArg).toEqual(new Uint8Array(16).fill(9))
    })
})
