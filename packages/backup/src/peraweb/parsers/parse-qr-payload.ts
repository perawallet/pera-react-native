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

import {
    assertMaxLength,
    decodeFromBase64,
} from '@perawallet/wallet-core-shared'
import { PeraWebImportError, PeraWebImportErrorReason } from '../errors'
import {
    PERA_WEB_QR_ACTION_IMPORT,
    PERA_WEB_QR_SUPPORTED_VERSION,
    type PeraWebQrPayload,
} from '../models'

const SECRETBOX_KEY_LENGTH = 32

// Upper bound on the scanned QR string. A transfer QR carries a small JSON
// object (backupId + 32-byte key + a couple of short fields); 8 KB is far above
// any legitimate payload and below QR's own practical capacity.
const MAX_QR_PAYLOAD_LENGTH = 8 * 1024

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0

// `backupId` is interpolated into the backup API path. Constrain it to a
// URL-path-safe identifier (charset + length) at the QR boundary so a scanned
// value can't smuggle `../`, `?` or `#` path/query metacharacters — defence in
// depth alongside the `encodeURIComponent` at the request boundary.
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
 * wrong length — base64-js silently drops non-base64 chars, so a "1,2,3"
 * string still "decodes" but to garbage of the wrong length.
 *
 * Throws `MalformedQr` if neither format yields a 32-byte key.
 */
const decodeEncryptionKey = (raw: string): Uint8Array => {
    const trimmed = raw.trim()

    // Base64 (or url-safe base64 — base64-js handles `-`/`_` as garbage and
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

/**
 * Parse the raw QR string a user scans on web.perawallet.app's "Transfer
 * Accounts" page into a typed payload.
 *
 * The QR is a JSON object with at least `backupId` and `encryptionKey`. iOS
 * also reads optional `version` and `action` fields and rejects values it
 * doesn't recognise; Android skips these checks but produces the same QRs.
 * We require `version === "1"` and (when present) `action === "import"`,
 * matching iOS's stricter contract.
 */
export const parsePeraWebQrPayload = (raw: string): PeraWebQrPayload => {
    // Defence-in-depth: cap the scanned string before JSON.parse. A legitimate
    // transfer QR is a small JSON object (well under this); QR symbols can't
    // physically carry much more anyway. Oversize maps to MalformedQr.
    try {
        assertMaxLength(raw, MAX_QR_PAYLOAD_LENGTH, 'pera-web qr payload')
    } catch {
        throw new PeraWebImportError(PeraWebImportErrorReason.MalformedQr)
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new PeraWebImportError(PeraWebImportErrorReason.MalformedQr)
    }

    if (!isPlainObject(parsed)) {
        throw new PeraWebImportError(PeraWebImportErrorReason.MalformedQr)
    }

    const { backupId, encryptionKey, version, action } = parsed
    if (!isValidBackupId(backupId) || !isNonEmptyString(encryptionKey)) {
        throw new PeraWebImportError(PeraWebImportErrorReason.MalformedQr)
    }

    // `version` is optional, but if it's present it MUST be the supported one.
    // Pera Web has only ever shipped `"1"`; future bumps require a coordinated
    // mobile release.
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
