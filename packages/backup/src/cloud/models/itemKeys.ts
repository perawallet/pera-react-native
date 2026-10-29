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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { ItemKeyHash } from '../crypto/itemKeyHash'
import type { BackupItemKey } from './types'

export const BACKUP_ACCOUNTS_KEY_PREFIX = 'accounts/'
export const BACKUP_SECRETS_KEY_PREFIX = 'secrets/'
export const BACKUP_CONTACTS_KEY_PREFIX = 'contacts/'

/** The hash, not the address: the server must never learn which wallets a
 *  backup holds, so the prefix is all a key still reveals. */
export const accountItemKey = (hash: ItemKeyHash): BackupItemKey =>
    `${BACKUP_ACCOUNTS_KEY_PREFIX}${hash}`

export const secretsItemKey = (hash: ItemKeyHash): BackupItemKey =>
    `${BACKUP_SECRETS_KEY_PREFIX}${hash}`

/** An address record and its key material are both BackupItemType.ACCOUNT on
 *  the wire, so only the key prefix tells them apart. */
export const isAccountItemKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX)

/** One account across every chain, replacing the per-address `accounts/` items
 *  for writing. A prefix of its own because clients that predate it skip an
 *  unknown prefix outright, where an unknown `accounts/` payload would be one
 *  they track and re-push. Still BackupItemType.ACCOUNT on the wire: older
 *  clients reject the whole manifest on an item type they don't know. */
export const BACKUP_ACCOUNT_RECORDS_KEY_PREFIX = 'account-records/'

/** Hashes the account's identity (`accountIdentityOf`), not one of its
 *  addresses, so the key holds still as chains come and go. */
export const accountRecordItemKey = (hash: ItemKeyHash): BackupItemKey =>
    `${BACKUP_ACCOUNT_RECORDS_KEY_PREFIX}${hash}`

export const isAccountRecordKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_ACCOUNT_RECORDS_KEY_PREFIX)

/** Either shape of an account's non-secret item. */
export const isAccountKey = (key: BackupItemKey): boolean =>
    isAccountItemKey(key) || isAccountRecordKey(key)

export const contactItemKey = (hash: ItemKeyHash): BackupItemKey =>
    `${BACKUP_CONTACTS_KEY_PREFIX}${hash}`

/** The legacy single-address shape, which this build reads but never writes. */
export const isContactItemKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_CONTACTS_KEY_PREFIX)

/** One contact across every chain family, replacing the per-address
 *  `contacts/` items for writing. A prefix of its own for the reason account
 *  records have one, and still BackupItemType.CONTACT on the wire. */
export const BACKUP_CONTACT_RECORDS_KEY_PREFIX = 'contact-records/'

/** Hashes the contact's `id`, not an address, so the key holds still as
 *  addresses come and go. */
export const contactRecordItemKey = (hash: ItemKeyHash): BackupItemKey =>
    `${BACKUP_CONTACT_RECORDS_KEY_PREFIX}${hash}`

export const isContactRecordKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_CONTACT_RECORDS_KEY_PREFIX)

/** Either shape of a contact's item. */
export const isContactKey = (key: BackupItemKey): boolean =>
    isContactItemKey(key) || isContactRecordKey(key)

export const BACKUP_PASSKEYS_KEY_PREFIX = 'passkeys/'

/** Keyed by the hash of the credential id for the same reason an account is
 *  keyed by the hash of its address: the server learns the item type from the
 *  prefix and nothing else. */
export const passkeyItemKey = (hash: ItemKeyHash): BackupItemKey =>
    `${BACKUP_PASSKEYS_KEY_PREFIX}${hash}`

export const isPasskeyItemKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_PASSKEYS_KEY_PREFIX)

export const BACKUP_PASSKEY_SECRETS_KEY_PREFIX = 'passkey-secrets/'

/** A credential's private key, apart from its `passkeys/` record so that a
 *  record downloaded only to label a review row never carries key material.
 *  Both halves hash the same credential id, so either key names the other. */
export const passkeySecretsItemKey = (hash: ItemKeyHash): BackupItemKey =>
    `${BACKUP_PASSKEY_SECRETS_KEY_PREFIX}${hash}`

export const isPasskeySecretsItemKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_PASSKEY_SECRETS_KEY_PREFIX)

export const passkeyPartnerKey = (
    key: BackupItemKey,
): Nullable<BackupItemKey> => {
    if (isPasskeyItemKey(key))
        return `${BACKUP_PASSKEY_SECRETS_KEY_PREFIX}${key.slice(BACKUP_PASSKEYS_KEY_PREFIX.length)}`
    if (isPasskeySecretsItemKey(key))
        return `${BACKUP_PASSKEYS_KEY_PREFIX}${key.slice(BACKUP_PASSKEY_SECRETS_KEY_PREFIX.length)}`
    return null
}

export const BACKUP_SETTINGS_KEY_PREFIX = 'settings/'

/** The single settings item is still keyed by a hash, of a fixed id rather
 *  than an address: an unhashed segment reads as a legacy key, and a legacy
 *  key makes sync refuse the whole backup. */
export const SETTINGS_ITEM_ID = 'app-settings'

export const settingsItemKey = (hash: ItemKeyHash): BackupItemKey =>
    `${BACKUP_SETTINGS_KEY_PREFIX}${hash}`

export const isSettingsItemKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_SETTINGS_KEY_PREFIX)

const HASHED_SEGMENT = /^[0-9a-f]{64}$/

/** An item written before keys were hashed. Such a backup is re-created rather
 *  than migrated: a re-key would leave the old addresses in the server's
 *  changelog anyway. */
export const isLegacyItemKey = (key: BackupItemKey): boolean =>
    !HASHED_SEGMENT.test(key.slice(key.indexOf('/') + 1))
