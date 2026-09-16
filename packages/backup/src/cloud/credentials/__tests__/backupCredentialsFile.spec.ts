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
    BackupCredentialsFileError,
    BackupCredentialsFileUnsupportedVersionError,
    buildBackupCredentialsFile,
    parseBackupCredentialsFile,
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

describe('parseBackupCredentialsFile', () => {
    const fileWith = (overrides: Record<string, unknown>): string =>
        JSON.stringify({
            ...JSON.parse(buildBackupCredentialsFile(SALT)),
            ...overrides,
        })

    test('reads back the salt and KDF a saved file carries', () => {
        expect(
            parseBackupCredentialsFile(buildBackupCredentialsFile(SALT)),
        ).toEqual({ salt: SALT, argon2id: ARGON2ID_CONFIG })
    })

    test.each([
        ['text that is not JSON', 'pera'],
        ['a JSON array', '[]'],
        ['another Pera file type', fileWith({ t: 'backup-sync' })],
        ['a version that is not a positive integer', fileWith({ v: 1.5 })],
        ['a zero version', fileWith({ v: 0 })],
        ['a string version', fileWith({ v: '1' })],
        ['a missing salt', fileWith({ salt: undefined })],
        ['a salt whose length is not base64', fileWith({ salt: '!!!' })],
        ['a salt too short to derive under', fileWith({ salt: 'c2FsdA==' })],
        ['a malformed KDF block', fileWith({ argon2id: { time_cost: -1 } })],
    ])('rejects %s', (_, contents) => {
        let error: unknown
        try {
            parseBackupCredentialsFile(contents)
        } catch (caught) {
            error = caught
        }

        expect(error).toBeInstanceOf(BackupCredentialsFileError)
        expect(error).not.toBeInstanceOf(
            BackupCredentialsFileUnsupportedVersionError,
        )
    })

    test('refuses a KDF that would allocate absurd memory, since any file can be picked', () => {
        const file = fileWith({
            argon2id: {
                ...JSON.parse(buildBackupCredentialsFile(SALT)).argon2id,
                memory_cost: 4_194_304,
            },
        })

        expect(() => parseBackupCredentialsFile(file)).toThrow(
            BackupCredentialsFileError,
        )
    })

    test('names a newer file version instead of calling the file invalid', () => {
        expect(() =>
            parseBackupCredentialsFile(fileWith({ v: 2, salt: undefined })),
        ).toThrow(BackupCredentialsFileUnsupportedVersionError)
    })
})
