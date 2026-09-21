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
    LEGACY_BACKUP_CREDENTIALS_FILE_NAME,
    backupCredentialsFileAddressPrefix,
    backupCredentialsFileName,
    buildBackupCredentialsFile,
    isBackupCredentialsFileName,
    parseBackupCredentialsFile,
} from '../backupCredentialsFile'
import {
    InvalidCredentialsFileError,
    UnsupportedCredentialsFileError,
} from '../../../errors'

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='
const BACKUP_ID =
    'did:pera:VQBGRVJZTE9OR0FMR09SQU5EQUREUkVTU0ZPUlRFU1RJTkdBQUFBQUFB'

describe('buildBackupCredentialsFile', () => {
    test('writes only the salt and the backup KDF under a typed, versioned envelope', () => {
        expect(buildBackupCredentialsFile(SALT)).toBe(
            JSON.stringify({
                v: 1,
                t: 'backup-credentials',
                salt: SALT,
                argon2id: {
                    time_cost: ARGON2ID_CONFIG.timeCost,
                    memory_cost: ARGON2ID_CONFIG.memoryCost,
                    parallelism: ARGON2ID_CONFIG.parallelism,
                    output_length: ARGON2ID_CONFIG.outputLength,
                },
            }),
        )
    })
})

describe('backupCredentialsFileName', () => {
    test('names the file after the backup, so two backups can sit side by side', () => {
        expect(backupCredentialsFileName(BACKUP_ID)).toBe(
            'pera-backup-VQBGR.json',
        )
        expect(
            backupCredentialsFileName(`did:pera:ZZZZZ${'A'.repeat(53)}`),
        ).toBe('pera-backup-ZZZZZ.json')
    })

    test('re-saving the same backup still overwrites rather than piling up', () => {
        expect(backupCredentialsFileName(BACKUP_ID)).toBe(
            backupCredentialsFileName(BACKUP_ID),
        )
    })
})

describe('backupCredentialsFileAddressPrefix', () => {
    test('reads back the prefix its own name carries', () => {
        expect(
            backupCredentialsFileAddressPrefix(
                backupCredentialsFileName(BACKUP_ID),
            ),
        ).toBe('VQBGR')
    })

    test.each([
        ['the legacy flat name', LEGACY_BACKUP_CREDENTIALS_FILE_NAME],
        ['an unrelated file', 'notes.json'],
        ['a lowercase prefix', 'pera-backup-vqbgr.json'],
        // 0, 1, 8 and 9 are not in the base32 alphabet an address uses.
        ['a prefix outside base32', 'pera-backup-V0BG1.json'],
        ['a prefix of the wrong length', 'pera-backup-VQBG.json'],
    ])('returns null for %s', (_, fileName) => {
        expect(backupCredentialsFileAddressPrefix(fileName)).toBeNull()
    })
})

describe('isBackupCredentialsFileName', () => {
    test.each([
        [backupCredentialsFileName(BACKUP_ID), true],
        // Still listed, so a key saved before per-backup names stays restorable.
        [LEGACY_BACKUP_CREDENTIALS_FILE_NAME, true],
        ['pera-backup-VQBG.json', false],
        ['screenshot.png', false],
    ])('%s → %s', (fileName, expected) => {
        expect(isBackupCredentialsFileName(fileName)).toBe(expected)
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
        // Not the "needs a newer app" error: these files are malformed, not new.
        expect(() => parseBackupCredentialsFile(contents)).toThrow(
            InvalidCredentialsFileError,
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
            InvalidCredentialsFileError,
        )
    })

    test('names a newer file version instead of calling the file invalid', () => {
        expect(() =>
            parseBackupCredentialsFile(fileWith({ v: 2, salt: undefined })),
        ).toThrow(UnsupportedCredentialsFileError)
    })
})
