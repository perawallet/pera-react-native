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
    decodeFromBase64,
    encodeToBase64,
    fromUrlSafeBase64,
    toUrlSafeBase64,
} from '@perawallet/wallet-core-shared'
import type { BackupItemKey } from './types'

export const BACKUP_ACCOUNTS_KEY_PREFIX = 'accounts/'
export const BACKUP_SECRETS_KEY_PREFIX = 'secrets/'
export const BACKUP_CONTACTS_KEY_PREFIX = 'contacts/'

export const accountItemKey = (address: string): BackupItemKey =>
    `${BACKUP_ACCOUNTS_KEY_PREFIX}${address}`

export const secretsItemKey = (address: string): BackupItemKey =>
    `${BACKUP_SECRETS_KEY_PREFIX}${address}`

/** An address record and its key material are both BackupItemType.ACCOUNT on
 *  the wire, so only the key prefix tells them apart. */
export const isAccountItemKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX)

/** Address an `accounts/` key names, or null for any other item. */
export const accountAddressFromItemKey = (key: BackupItemKey): string | null =>
    isAccountItemKey(key) ? key.slice(BACKUP_ACCOUNTS_KEY_PREFIX.length) : null

export const contactItemKey = (address: string): BackupItemKey =>
    `${BACKUP_CONTACTS_KEY_PREFIX}${address}`

export const isContactItemKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_CONTACTS_KEY_PREFIX)

/** Address a `contacts/` key names, or null for any other item. */
export const contactAddressFromItemKey = (key: BackupItemKey): string | null =>
    isContactItemKey(key) ? key.slice(BACKUP_CONTACTS_KEY_PREFIX.length) : null

export const BACKUP_PASSKEYS_KEY_PREFIX = 'passkeys/'

/** The server accepts only `[A-Za-z0-9_\-.]` in each `/`-separated segment of
 *  an item key, and a credential id is standard base64: its `/` would split
 *  the key into extra segments, and `+`/`=` fail the pattern outright, which
 *  the real backend answers with `422 INVALID_ITEM_KEY`.
 *
 *  The id's bytes are therefore base64url-encoded rather than its characters
 *  remapped: remapping only round-trips an id that is already canonical
 *  base64, and a credential id is whatever the writer chose to key its native
 *  record on. The payload keeps the raw id, because that is what the native
 *  record is stored under. */
export const passkeyItemKey = (credentialId: string): BackupItemKey =>
    `${BACKUP_PASSKEYS_KEY_PREFIX}${toUrlSafeBase64(
        encodeToBase64(new TextEncoder().encode(credentialId)),
    )}`

export const isPasskeyItemKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_PASSKEYS_KEY_PREFIX)

/** Credential id a `passkeys/` key names, or null for any other item. Decodes
 *  back to the raw id every other layer keys on. */
export const passkeyIdFromItemKey = (key: BackupItemKey): string | null => {
    if (!isPasskeyItemKey(key)) return null
    const encoded = key.slice(BACKUP_PASSKEYS_KEY_PREFIX.length)
    try {
        return new TextDecoder().decode(
            decodeFromBase64(fromUrlSafeBase64(encoded)),
        )
    } catch {
        // A key this device did not write. Treating it as "not a passkey key"
        // keeps a foreign item out of the review buckets rather than throwing
        // in the middle of a sync.
        return null
    }
}
