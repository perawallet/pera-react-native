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
import { ARGON2ID_CONFIG } from '../../crypto/constants'
import {
    BACKUP_CREDENTIALS_FILE_NAME,
    buildBackupCredentialsFile,
} from '../backupCredentialsFile'

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='

describe('buildBackupCredentialsFile', () => {
    test('writes only the salt and the backup KDF under a typed, versioned envelope', () => {
        expect(JSON.parse(buildBackupCredentialsFile(SALT))).toEqual({
            v: 1,
            t: 'backup-credentials',
            salt: SALT,
            argon2id: {
                time_cost: ARGON2ID_CONFIG.timeCost,
                memory_cost: ARGON2ID_CONFIG.memoryCost,
                parallelism: ARGON2ID_CONFIG.parallelism,
                output_length: ARGON2ID_CONFIG.outputLength,
            },
        })
    })

    test('escapes anything outside printable ASCII so the file reads back to the same salt', () => {
        // A Cyrillic "А" typed for "A" decodes to the same key bytes, so it can
        // reach the store; the emoji pins per-code-unit escaping of surrogates.
        const lookAlikeSalt = `А${SALT.slice(1)}${String.fromCodePoint(0x1f600)}`

        const file = buildBackupCredentialsFile(lookAlikeSalt)

        expect(file).toMatch(/^[\x20-\x7E]*$/)
        expect(JSON.parse(file).salt).toBe(lookAlikeSalt)
    })

    test('keeps the file name stable so a re-save overwrites the earlier file', () => {
        expect(BACKUP_CREDENTIALS_FILE_NAME).toBe(
            'pera-backup-encryption-key.json',
        )
    })
})
