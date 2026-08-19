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
import { PeraWebImportError, PeraWebImportErrorReason } from '../errors'
import {
    PERA_WEB_QR_ACTION_IMPORT,
    PERA_WEB_QR_SUPPORTED_VERSION,
    type PeraWebQrPayload,
} from '../models'

const SECRETBOX_KEY_LENGTH = 32

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0

// `backupId` is interpolated into the backup API path. Constrain it to a
// URL-path-safe identifier (charset + length) at the parse boundary so a
// scanned value can't smuggle `../`, `?` or `#` path/query metacharacters,
// defence in depth alongside the `encodeURIComponent` at the request boundary.
const BACKUP_ID_PATTERN = /^[A-Za-z0-9_-]+$/
const MAX_BACKUP_ID_LENGTH = 128
const isValidBackupId = (value: unknown): value is string =>
    isNonEmptyString(value) &&
    value.length <= MAX_BACKUP_ID_LENGTH &&
    BACKUP_ID_PATTERN.test(value)

/**
 * Decode the QR-encoded encryption key. The two legacy clients diverge on the
 * on-wire format:
 *   - iOS uses comma-separated decimal bytes (e.g. "12,34,56,...").
 *   - Android decodes via `decodeBase64OrByteArray()`.
 *
 * In practice modern Pera Web emits base64. We try base64 first and fall back
 * to comma-separated parsing only if the base64 decode produced bytes of the
 * wrong length; base64-js silently drops non-base64 chars, so a "1,2,3"
 * string still "decodes" but to garbage of the wrong length.
 *
 * Throws `MalformedQr` if neither format yields a 32-byte key.
 */
const decodeEncryptionKey = (raw: string): Uint8Array => {
    const trimmed = raw.trim()

    // Base64 (or url-safe base64; base64-js handles `-`/`_` as garbage and
    // drops them; this is fine when modern Pera Web emits standard base64).
    let asBase64: Uint8Array | null = null
    try {
        asBase64 = decodeFromBase64(trimmed)
    } catch {
        asBase64 = null
    }
    if (asBase64 && asBase64.length === SECRETBOX_KEY_LENGTH) {
        return asBase64
    }

    // Comma-separated decimal bytes (legacy iOS format).
    if (trimmed.includes(',')) {
        const parts = trimmed.split(',')
        if (parts.length === SECRETBOX_KEY_LENGTH) {
            const bytes = new Uint8Array(SECRETBOX_KEY_LENGTH)
            for (let i = 0; i < SECRETBOX_KEY_LENGTH; i++) {
                const n = Number(parts[i].trim())
                if (!Number.isInteger(n) || n < 0 || n > 255) {
                    throw new PeraWebImportError(
                        PeraWebImportErrorReason.MalformedQr,
                    )
                }
                bytes[i] = n
            }
            return bytes
        }
    }

    throw new PeraWebImportError(PeraWebImportErrorReason.MalformedQr)
}

/** Raw transfer-payload fields before validation, from either carrier. */
export type PeraWebImportFields = {
    backupId: unknown
    encryptionKey: unknown
    version?: unknown
    action?: unknown
}

/**
 * Validate the Pera Web transfer fields shared by both carriers: the raw
 * JSON QR (`parsePeraWebQrPayload`) and the `perawallet://app/web-import/`
 * app-action URL. `version`/`action` are optional but must match the
 * supported values when present (iOS-strict contract).
 *
 * Throws `PeraWebImportError` on any invalid field.
 */
export const parsePeraWebImportFields = (
    fields: PeraWebImportFields,
): PeraWebQrPayload => {
    const { backupId, encryptionKey, version, action } = fields

    if (!isValidBackupId(backupId) || !isNonEmptyString(encryptionKey)) {
        throw new PeraWebImportError(PeraWebImportErrorReason.MalformedQr)
    }

    // Pera Web has only ever shipped version "1"; future bumps require a
    // coordinated mobile release.
    if (version !== undefined && version !== PERA_WEB_QR_SUPPORTED_VERSION) {
        throw new PeraWebImportError(
            PeraWebImportErrorReason.UnsupportedVersion,
        )
    }

    if (action !== undefined && action !== PERA_WEB_QR_ACTION_IMPORT) {
        throw new PeraWebImportError(PeraWebImportErrorReason.UnsupportedAction)
    }

    return {
        backupId,
        encryptionKey: decodeEncryptionKey(encryptionKey),
    }
}
