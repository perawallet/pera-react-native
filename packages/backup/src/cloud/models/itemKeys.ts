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

export const contactItemKey = (hash: ItemKeyHash): BackupItemKey =>
    `${BACKUP_CONTACTS_KEY_PREFIX}${hash}`

export const isContactItemKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_CONTACTS_KEY_PREFIX)

export const BACKUP_PASSKEYS_KEY_PREFIX = 'passkeys/'

/** Keyed by the hash of the credential id for the same reason an account is
 *  keyed by the hash of its address: the server learns the item type from the
 *  prefix and nothing else. */
export const passkeyItemKey = (hash: ItemKeyHash): BackupItemKey =>
    `${BACKUP_PASSKEYS_KEY_PREFIX}${hash}`

export const isPasskeyItemKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_PASSKEYS_KEY_PREFIX)

const HASHED_SEGMENT = /^[0-9a-f]{64}$/

/** An item written before keys were hashed. Such a backup is re-created rather
 *  than migrated: a re-key would leave the old addresses in the server's
 *  changelog anyway. */
export const isLegacyItemKey = (key: BackupItemKey): boolean =>
    !HASHED_SEGMENT.test(key.slice(key.indexOf('/') + 1))
