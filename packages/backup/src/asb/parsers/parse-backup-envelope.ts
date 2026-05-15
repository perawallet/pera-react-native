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

import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import { AsbImportError, AsbErrorReason } from '../errors'
import {
    ASB_BACKUP_CIPHER_SUITE,
    ASB_BACKUP_PROTOCOL_VERSION,
    type AsbBackupEnvelope,
} from '../models'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

/**
 * Parse the on-disk backup file (base64 of an ARC-35 envelope JSON) into a
 * typed envelope. Validates protocol version and cipher suite before
 * returning so the caller doesn't have to.
 *
 * Decoding the outer base64 reuses `base64-js` via `@perawallet/wallet-core-shared`;
 * the inner ciphertext is *also* base64 but is decoded separately at the
 * decryption step (see `decrypt-backup-payload.ts`).
 */
export const parseBackupEnvelope = (raw: string): AsbBackupEnvelope => {
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
        throw new AsbImportError(AsbErrorReason.EmptyFile)
    }

    let outerBytes: Uint8Array
    try {
        outerBytes = decodeFromBase64(trimmed)
    } catch {
        throw new AsbImportError(AsbErrorReason.NotBase64)
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(new TextDecoder().decode(outerBytes))
    } catch {
        throw new AsbImportError(AsbErrorReason.MalformedEnvelope)
    }

    if (!isPlainObject(parsed)) {
        throw new AsbImportError(AsbErrorReason.MalformedEnvelope)
    }

    const { version, suite, ciphertext } = parsed
    if (!isString(version) || !isString(suite) || !isString(ciphertext)) {
        throw new AsbImportError(AsbErrorReason.MalformedEnvelope)
    }

    if (version !== ASB_BACKUP_PROTOCOL_VERSION) {
        throw new AsbImportError(AsbErrorReason.UnsupportedVersion)
    }
    if (suite !== ASB_BACKUP_CIPHER_SUITE) {
        throw new AsbImportError(AsbErrorReason.UnsupportedSuite)
    }

    return { version, suite, ciphertext }
}
