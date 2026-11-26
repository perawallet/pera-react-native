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

import { bytesEqual, type Nullable } from '@perawallet/wallet-core-shared'
import { decodeBase64Salt } from '../crypto/argon2idConfig'
import {
    isBackupCredentialsFileContents,
    parseBackupCredentialsFile,
} from './backupCredentialsFile'

// Base64 contains none of these, so dropping them can't turn a wrong key into a right one.
const NON_BASE64_CHARACTERS =
    /[\s\u00AD\u200B-\u200F\u2060\uFEFF"'\u201C\u201D\u2018\u2019]/g

/**
 * Reduces what the user typed or pasted as the encryption key to the base64
 * salt it carries: a whole pasted credentials file yields its salt, anything
 * else loses whitespace, invisible characters and quotes.
 */
export const normalizeBackupEncryptionKey = (input: string): string => {
    const trimmed = input.trim()
    if (isBackupCredentialsFileContents(trimmed)) {
        return parseBackupCredentialsFile(trimmed).salt
    }
    return input.replace(NON_BASE64_CHARACTERS, '')
}

/** True when the normalised input decodes to the same salt bytes as `backupSalt`. */
export const matchesBackupEncryptionKey = (
    input: string,
    backupSalt: Nullable<string>,
): boolean => {
    const normalized = normalizeBackupEncryptionKey(input)
    if (backupSalt === null || normalized.length === 0) return false
    const entered = decodeBase64Salt(normalized)
    const stored = decodeBase64Salt(backupSalt)
    if (entered === null || stored === null) return false
    return bytesEqual(entered, stored)
}
