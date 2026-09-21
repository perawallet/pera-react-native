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

import { assertMaxLength } from '@perawallet/wallet-core-shared'
import {
    decodeBase64Salt,
    isCanonicalArgon2idConfig,
    isDerivableSaltLength,
    isPositiveInteger,
    isRecord,
    readArgon2idConfig,
} from '../crypto/argon2idConfig'
import {
    InvalidCredentialsFileError,
    UnsupportedCredentialsFileError,
} from '../../errors'
import { backupIdToAddress } from '../crypto/backupIdToAddress'
import { ARGON2ID_CONFIG } from '../crypto/constants'
import { serializeArgon2idConfig } from '../crypto/serializeArgon2idConfig'
import type { Argon2idConfig, BackupId } from '../models'

/** Written before a file was named after its backup; still readable. */
export const LEGACY_BACKUP_CREDENTIALS_FILE_NAME =
    'pera-backup-encryption-key.json'

const FILE_NAME_PREFIX = 'pera-backup-'
const FILE_NAME_EXTENSION = '.json'
// Enough to tell one user's own backups apart in a list. Algorand addresses are
// base32, so the legacy name's "encryption-key" can never be mistaken for one.
const ADDRESS_PREFIX_LENGTH = 5
const FILE_NAME_PATTERN = new RegExp(
    `^${FILE_NAME_PREFIX}([A-Z2-7]{${ADDRESS_PREFIX_LENGTH}})\\${FILE_NAME_EXTENSION}$`,
)

const BACKUP_CREDENTIALS_FILE_TYPE = 'backup-credentials'
const BACKUP_CREDENTIALS_FILE_VERSION = 1
// A real credentials file is a few hundred bytes, and of the three read paths
// that land here only the device picker bounds what it hands over.
const MAX_FILE_LENGTH = 16 * 1024

/**
 * Names the file after the backup it unlocks, so a user can keep one per backup
 * in the same folder rather than overwriting the last.
 */
export const backupCredentialsFileName = (backupId: BackupId): string =>
    `${FILE_NAME_PREFIX}${backupIdToAddress(backupId).slice(
        0,
        ADDRESS_PREFIX_LENGTH,
    )}${FILE_NAME_EXTENSION}`

/** The address prefix in a credentials file name; `null` for the legacy name. */
export const backupCredentialsFileAddressPrefix = (
    fileName: string,
): string | null => FILE_NAME_PATTERN.exec(fileName)?.[1] ?? null

export const isBackupCredentialsFileName = (fileName: string): boolean =>
    fileName === LEGACY_BACKUP_CREDENTIALS_FILE_NAME ||
    FILE_NAME_PATTERN.test(fileName)

// Plain JSON on purpose: the salt opens nothing without the 12-word phrase,
// which never goes in this file.
export const buildBackupCredentialsFile = (backupSalt: string): string =>
    JSON.stringify({
        v: BACKUP_CREDENTIALS_FILE_VERSION,
        t: BACKUP_CREDENTIALS_FILE_TYPE,
        salt: backupSalt,
        argon2id: serializeArgon2idConfig(ARGON2ID_CONFIG),
    })

export type BackupEncryptionKey = {
    /** Base64 salt the UI calls the "encryption key". */
    salt: string
    argon2id: Argon2idConfig
}

const hasDerivableSalt = (salt: string): boolean => {
    const decoded = decodeBase64Salt(salt)
    return decoded !== null && isDerivableSaltLength(decoded.length)
}

export const parseBackupCredentialsFile = (
    contents: string,
): BackupEncryptionKey => {
    let parsed: unknown
    try {
        assertMaxLength(contents, MAX_FILE_LENGTH, 'backup credentials file')
        parsed = JSON.parse(contents)
    } catch {
        throw new InvalidCredentialsFileError()
    }
    if (
        !isRecord(parsed) ||
        parsed.t !== BACKUP_CREDENTIALS_FILE_TYPE ||
        !isPositiveInteger(parsed.v)
    ) {
        throw new InvalidCredentialsFileError()
    }
    if (parsed.v > BACKUP_CREDENTIALS_FILE_VERSION) {
        throw new UnsupportedCredentialsFileError()
    }

    const argon2id = readArgon2idConfig(parsed.argon2id)
    if (
        typeof parsed.salt !== 'string' ||
        !argon2id ||
        !isCanonicalArgon2idConfig(argon2id) ||
        !hasDerivableSalt(parsed.salt)
    ) {
        throw new InvalidCredentialsFileError()
    }
    return { salt: parsed.salt, argon2id }
}
