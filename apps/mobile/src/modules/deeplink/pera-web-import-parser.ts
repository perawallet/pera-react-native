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
    parsePeraWebImportFields,
    parsePeraWebQrPayload,
    PeraWebImportError,
} from '@perawallet/wallet-core-backup'
import {
    DeeplinkType,
    readPeraAppLink,
    type PeraWebImportDeeplink,
} from '@perawallet/wallet-core-deeplinks'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'

// Both secrets below are the payload itself, so `sourceUrl` is dropped rather
// than echoed to a logger or crash reporter.
const toLink = (parsed: {
    backupId: string
    encryptionKey: Uint8Array
}): PeraWebImportDeeplink => ({
    type: DeeplinkType.PERA_WEB_IMPORT,
    sourceUrl: '',
    backupId: parsed.backupId,
    encryptionKey: parsed.encryptionKey,
})

/**
 * Pera Web "Transfer Accounts" QR: `backupId` + 32-byte secretbox `encryptionKey`.
 * Tried ahead of the legacy recover-account JSON, which shares its leading `{`.
 */
const parsePeraWebJsonQr = (url: string): Nullable<PeraWebImportDeeplink> => {
    const trimmed = url.trim()
    if (!trimmed.startsWith('{')) return null
    try {
        return toLink(parsePeraWebQrPayload(trimmed))
    } catch (error) {
        // Not a Pera Web QR (wrong shape, unsupported version, malformed
        // key); the package falls back to the legacy mnemonic JSON parser.
        if (!(error instanceof PeraWebImportError)) {
            logger.warn('parsePeraWebJsonQr: unexpected error', { error })
        }
        return null
    }
}

/**
 * The `web-import` app action (native iOS/Android parse it too). Dispatch stays
 * QR-only via usePeraWebImportDeeplink's source gate, so a tapped link parses
 * but never stages an import.
 */
const parsePeraWebImportAction = (
    url: string,
): Nullable<PeraWebImportDeeplink> => {
    const link = readPeraAppLink(url)
    if (link?.action !== 'web-import') return null
    try {
        return toLink(
            parsePeraWebImportFields({
                backupId: link.params.backupId,
                encryptionKey: link.params.encryptionKey,
                version: link.params.version,
                action: link.params.action,
            }),
        )
    } catch {
        // A malformed or unsupported payload reads as unrecognized, the same
        // silent outcome as any other unknown Pera-owned link.
        return null
    }
}

export const parsePeraWebImportLink = (
    url: string,
): Nullable<PeraWebImportDeeplink> =>
    parsePeraWebJsonQr(url) ?? parsePeraWebImportAction(url)
