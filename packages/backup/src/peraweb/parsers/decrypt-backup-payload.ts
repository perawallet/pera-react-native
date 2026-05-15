/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { zeroBytes } from '@perawallet/wallet-core-kms'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import {
    decodePrivateKeyBytes,
    secretboxOpenWithPrependedNonce,
} from '../../shared'
import { PeraWebImportError, PeraWebImportErrorReason } from '../errors'
import type {
    PeraWebBackupAccount,
    PeraWebBackupPayload,
    PeraWebBackupResponse,
} from '../models'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0

/**
 * Normalise a raw account row from the decrypted JSON. Returns null when the
 * shape is missing required fields — the caller silently drops bad rows so
 * one malformed account doesn't block recovery of the rest. Mirrors the same
 * tolerant policy as ASB's `parseAccount`.
 */
const parseAccount = (raw: unknown): PeraWebBackupAccount | null => {
    if (!isPlainObject(raw)) return null
    const {
        address,
        name,
        accountType,
        account_type,
        privateKey,
        private_key,
        metadata,
    } = raw

    if (!isNonEmptyString(address)) return null

    // Field naming differs between legacy clients (camelCase vs snake_case).
    // Accept both so a backup from any producer round-trips.
    const accountTypeValue = isNonEmptyString(accountType)
        ? accountType
        : isNonEmptyString(account_type)
          ? account_type
          : null

    const privateKeyValue = isNonEmptyString(privateKey)
        ? privateKey
        : isNonEmptyString(private_key)
          ? private_key
          : null

    let decodedPrivateKey: Uint8Array | null = null
    if (privateKeyValue) {
        decodedPrivateKey = decodePrivateKeyBytes(privateKeyValue, {
            allowCommaSeparated: true,
        })
        // If the field is present but undecodable, treat the row as malformed
        // rather than silently downgrading to a watch-style import.
        if (!decodedPrivateKey) return null
    }

    return {
        address,
        name: isNonEmptyString(name) ? name : null,
        accountType: accountTypeValue,
        privateKey: decodedPrivateKey,
        metadata: isNonEmptyString(metadata) ? metadata : null,
    }
}

/**
 * Decrypt the `encrypted_content` blob returned from `GET /v1/backups/{id}/`
 * and decode it into a typed payload.
 *
 * Throws `PeraWebImportError` for every user-fixable failure so the UI can
 * map a single error type to localized copy. The raw API response is passed
 * in directly (rather than just the ciphertext) so this function owns the
 * "empty content" check.
 *
 * Secure-memory contract:
 *   - The decrypted `plaintext` buffer is zeroed in `finally`.
 *   - Per-account `privateKey` arrays in the returned payload survive until
 *     the caller (the flow store) wipes them on reset.
 *   - The base64 source strings inside the parsed JSON are immutable JS
 *     strings; we can't wipe them, but we drop our references promptly so
 *     they're eligible for GC after the import completes.
 */
export const decryptPeraWebBackupPayload = (
    response: PeraWebBackupResponse,
    encryptionKey: Uint8Array,
): PeraWebBackupPayload => {
    if (!isNonEmptyString(response.encrypted_content)) {
        throw new PeraWebImportError(PeraWebImportErrorReason.EmptyContent)
    }

    let plaintext: Uint8Array | null = null
    try {
        let ciphertext: Uint8Array
        try {
            ciphertext = decodeFromBase64(response.encrypted_content)
        } catch {
            throw new PeraWebImportError(
                PeraWebImportErrorReason.MalformedPayload,
            )
        }

        plaintext = secretboxOpenWithPrependedNonce(ciphertext, encryptionKey)
        if (!plaintext) {
            throw new PeraWebImportError(
                PeraWebImportErrorReason.DecryptionFailed,
            )
        }

        let parsed: unknown
        try {
            parsed = JSON.parse(new TextDecoder().decode(plaintext))
        } catch {
            throw new PeraWebImportError(
                PeraWebImportErrorReason.MalformedPayload,
            )
        }

        // The decrypted payload is either a bare array of accounts (Android
        // `BackupTransferAccountElement[]`) or an object with an `accounts`
        // field. Accept both so the parser handles either producer.
        let rows: unknown[]
        if (Array.isArray(parsed)) {
            rows = parsed
        } else if (isPlainObject(parsed) && Array.isArray(parsed.accounts)) {
            rows = parsed.accounts
        } else {
            throw new PeraWebImportError(
                PeraWebImportErrorReason.MalformedPayload,
            )
        }

        const accounts: PeraWebBackupAccount[] = []
        for (const row of rows) {
            const account = parseAccount(row)
            if (account) accounts.push(account)
        }

        if (accounts.length === 0) {
            throw new PeraWebImportError(
                PeraWebImportErrorReason.MalformedPayload,
            )
        }

        return { accounts }
    } finally {
        zeroBytes(plaintext)
    }
}
