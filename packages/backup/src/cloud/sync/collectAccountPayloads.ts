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

import { logger } from '@perawallet/wallet-core-shared'
import { parseAddressPayload, parseSecretsPayload } from '../api/payloadParsers'
import {
    BACKUP_ACCOUNTS_KEY_PREFIX,
    BACKUP_SECRETS_KEY_PREFIX,
    type AddressBackupPayload,
    type BackupItemKey,
    type FetchedItem,
    type SecretsBackupPayload,
    type SyncItemState,
} from '../models'
import { buildPulledAccounts, type PulledAccount } from '../restore'
import {
    adoptRemote,
    decryptItem,
    isLocalNewer,
    keepLocalEdit,
    type CollectPayloadsDeps,
} from './collectPayloads'

const addressOf = (key: BackupItemKey): string | null =>
    key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX)
        ? key.slice(BACKUP_ACCOUNTS_KEY_PREFIX.length)
        : key.startsWith(BACKUP_SECRETS_KEY_PREFIX)
          ? key.slice(BACKUP_SECRETS_KEY_PREFIX.length)
          : null

/** `items` is mutated in place: each readable item's version/hash bookkeeping
 *  is written back under its own key. */
export const collectAccountPayloads = ({
    fetched,
    items,
    deps,
}: {
    fetched: FetchedItem[]
    items: Record<BackupItemKey, SyncItemState>
    deps: CollectPayloadsDeps
}): PulledAccount[] => {
    const addressPayloads = new Map<string, AddressBackupPayload>()
    const secretsPayloads = new Map<string, SecretsBackupPayload>()

    for (const item of fetched) {
        const address = addressOf(item.key)
        if (!address) continue

        const plaintext = decryptItem(item, deps)
        if (plaintext === null) continue

        const existing = items[item.key]
        const isAddress = item.key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX)
        // Only the address record carries an editable name; a secret is
        // immutable, so there is no local edit for it to win.
        if (isAddress && existing && isLocalNewer(existing, plaintext)) {
            items[item.key] = keepLocalEdit(existing, item)
            continue
        }

        try {
            if (isAddress)
                addressPayloads.set(address, parseAddressPayload(plaintext))
            else secretsPayloads.set(address, parseSecretsPayload(plaintext))
        } catch {
            logger.warn('collectAccountPayloads: failed to parse', {
                key: item.key,
            })
            continue
        }
        items[item.key] = adoptRemote(
            items[item.key] as SyncItemState,
            item,
            plaintext,
        )
    }

    // Join address+secrets and surface orphan hdSeed secrets as standalone
    // entries — shared with the full-restore path so the incremental/realtime
    // sync path restores HD seeds whose first account was removed.
    return buildPulledAccounts(addressPayloads, secretsPayloads)
}
