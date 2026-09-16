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

import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import {
    isDerivableArgon2idConfig,
    isDerivableSaltLength,
    isPositiveInteger,
    isRecord,
    readArgon2idConfig,
} from '../crypto/argon2idConfig'
import { ARGON2ID_CONFIG } from '../crypto/constants'
import { serializeArgon2idConfig } from '../crypto/serializeArgon2idConfig'
import type { Argon2idConfig } from '../models'

export const BACKUP_CREDENTIALS_FILE_NAME = 'pera-backup-encryption-key.json'
const BACKUP_CREDENTIALS_FILE_TYPE = 'backup-credentials'
const BACKUP_CREDENTIALS_FILE_VERSION = 1

// The Drive client sizes uploads by character count, not bytes, so anything
// outside printable ASCII is written as a JSON \u escape.
const toAsciiJson = (value: unknown): string =>
    JSON.stringify(value).replace(
        /[\u007f-\uffff]/g,
        char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
    )

// Plain JSON on purpose: the salt opens nothing without the 12-word phrase,
// which never goes in this file.
export const buildBackupCredentialsFile = (backupSalt: string): string =>
    toAsciiJson({
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

export class BackupCredentialsFileError extends Error {
    constructor(message = 'Not a backup credentials file') {
        super(message)
        this.name = 'BackupCredentialsFileError'
    }
}

/** Raised when the file was written by a newer app than this one. */
export class BackupCredentialsFileUnsupportedVersionError extends BackupCredentialsFileError {
    constructor(readonly version: number) {
        super(`Backup credentials file version ${version} needs a newer app`)
        this.name = 'BackupCredentialsFileUnsupportedVersionError'
    }
}

const hasDerivableSalt = (salt: string): boolean => {
    try {
        return isDerivableSaltLength(decodeFromBase64(salt).length)
    } catch {
        return false
    }
}

export const parseBackupCredentialsFile = (
    contents: string,
): BackupEncryptionKey => {
    let parsed: unknown
    try {
        parsed = JSON.parse(contents)
    } catch {
        throw new BackupCredentialsFileError()
    }
    if (
        !isRecord(parsed) ||
        parsed.t !== BACKUP_CREDENTIALS_FILE_TYPE ||
        !isPositiveInteger(parsed.v)
    ) {
        throw new BackupCredentialsFileError()
    }
    if (parsed.v > BACKUP_CREDENTIALS_FILE_VERSION) {
        throw new BackupCredentialsFileUnsupportedVersionError(parsed.v)
    }

    const argon2id = readArgon2idConfig(parsed.argon2id)
    if (
        typeof parsed.salt !== 'string' ||
        !argon2id ||
        !isDerivableArgon2idConfig(argon2id) ||
        !hasDerivableSalt(parsed.salt)
    ) {
        throw new BackupCredentialsFileError()
    }
    return { salt: parsed.salt, argon2id }
}
