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
import { PeraWebImportError, PeraWebImportErrorReason } from '../errors'
import type { PeraWebQrPayload } from '../models'
import { parsePeraWebImportFields } from './parse-import-fields'

// Upper bound on the scanned QR string. A transfer QR carries a small JSON
// object (backupId + 32-byte key + a couple of short fields); 8 KB is far above
// any legitimate payload and below QR's own practical capacity.
const MAX_QR_PAYLOAD_LENGTH = 8 * 1024

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

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
    return parsePeraWebImportFields({
        backupId,
        encryptionKey,
        version,
        action,
    })
}
