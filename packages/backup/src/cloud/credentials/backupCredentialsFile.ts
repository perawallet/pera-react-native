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

import { ARGON2ID_CONFIG } from '../crypto/constants'
import { serializeArgon2idConfig } from '../crypto/serializeArgon2idConfig'

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
