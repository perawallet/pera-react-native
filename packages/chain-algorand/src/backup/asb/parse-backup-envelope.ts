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

import { decodeBoundedBase64 } from '@perawallet/wallet-core-shared'
import {
    SecureBackupErrorReason,
    SecureBackupImportError,
    type SecureBackupEnvelope,
} from '@perawallet/wallet-core-backup'
import { ASB_BACKUP_CIPHER_SUITE, ASB_BACKUP_PROTOCOL_VERSION } from './arc35'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

// Defence-in-depth cap on an imported ASB backup file before we base64-decode
// and JSON-parse it. A real backup is well under this even with thousands of
// accounts; the bound exists to reject a hostile/corrupt blob before it forces
// an oversized allocation. Oversize maps to NotBase64 (the existing
// decode-failure reason) so no new locale copy is required.
const MAX_ASB_BACKUP_FILE_BYTES = 5 * 1024 * 1024

/**
 * Parse the on-disk backup file (base64 of an ARC-35 envelope JSON) into a
 * typed envelope. Validates protocol version and cipher suite before
 * returning so the caller doesn't have to.
 *
 * Decoding the outer base64 reuses `base64-js` via `@perawallet/wallet-core-shared`;
 * the inner ciphertext is *also* base64 but is decoded separately at the
 * decryption step (see `decrypt-backup-payload.ts`).
 */
export const parseBackupEnvelope = (raw: string): SecureBackupEnvelope => {
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
        throw new SecureBackupImportError(SecureBackupErrorReason.EmptyFile)
    }

    let outerBytes: Uint8Array
    try {
        outerBytes = decodeBoundedBase64(
            trimmed,
            MAX_ASB_BACKUP_FILE_BYTES,
            'asb backup file',
        )
    } catch {
        throw new SecureBackupImportError(SecureBackupErrorReason.NotBase64)
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(new TextDecoder().decode(outerBytes))
    } catch {
        throw new SecureBackupImportError(
            SecureBackupErrorReason.MalformedEnvelope,
        )
    }

    if (!isPlainObject(parsed)) {
        throw new SecureBackupImportError(
            SecureBackupErrorReason.MalformedEnvelope,
        )
    }

    const { version, suite, ciphertext } = parsed
    if (!isString(version) || !isString(suite) || !isString(ciphertext)) {
        throw new SecureBackupImportError(
            SecureBackupErrorReason.MalformedEnvelope,
        )
    }

    if (version !== ASB_BACKUP_PROTOCOL_VERSION) {
        throw new SecureBackupImportError(
            SecureBackupErrorReason.UnsupportedVersion,
        )
    }
    if (suite !== ASB_BACKUP_CIPHER_SUITE) {
        throw new SecureBackupImportError(
            SecureBackupErrorReason.UnsupportedSuite,
        )
    }

    return { version, suite, ciphertext }
}
