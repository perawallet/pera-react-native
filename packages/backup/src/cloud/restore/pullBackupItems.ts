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

import type { Network } from '@perawallet/wallet-core-shared'
import { logger } from '@perawallet/wallet-core-shared'
import { fetchDelta, fetchManifest, readItems } from '../api'
import {
    parseAddressPayload,
    parseContactPayload,
    parseSecretsPayload,
} from '../api/payloadParsers'
import { decryptItemPayload } from '../crypto/itemPayload'
import {
    BACKUP_ACCOUNTS_KEY_PREFIX,
    BACKUP_CONTACTS_KEY_PREFIX,
    BACKUP_SECRETS_KEY_PREFIX,
    BackupAccountType,
    BackupItemStatus,
    DeltaOperation,
    isContactItemKey,
    type AddressBackupPayload,
    type BackupId,
    type BackupItemKey,
    type ContactBackupPayload,
    type DeltaEntry,
    type DeviceId,
    type FetchedItem,
    type ManifestItem,
    type SecretsBackupPayload,
} from '../models'

const READ_BATCH_SIZE = 50

export type PulledAccount = {
    address: string
    addressPayload: AddressBackupPayload
    secretsPayload: SecretsBackupPayload | null
}

export type SkippedItem = {
    key: BackupItemKey
    reason: 'decrypt' | 'parse' | 'missing-address'
}

export type PullBackupItemsResult = {
    backupGlobalHash: string
    lastSeq: number
    /** Every key the backup holds and the version it holds it at — including
     *  tombstones and items the restore could not read, which the caller still
     *  has to track or it will offer them to the server as new. */
    manifestItems: Record<BackupItemKey, ManifestItem>
    accounts: PulledAccount[]
    contacts: ContactBackupPayload[]
    skipped: SkippedItem[]
}

type PullBackupItemsParams = {
    network: Network
    backupId: BackupId
    deviceId: DeviceId
    encryptionKey: Uint8Array
}

const addressFromKey = (key: BackupItemKey): string | null => {
    if (key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX))
        return key.slice(BACKUP_ACCOUNTS_KEY_PREFIX.length)
    if (key.startsWith(BACKUP_SECRETS_KEY_PREFIX))
        return key.slice(BACKUP_SECRETS_KEY_PREFIX.length)
    return null
}

const chunk = <T>(items: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size))
    }
    return out
}

/** Keys of the active items that should be read and restored. Contacts are in
 *  here because the restore is their only way home: it seeds `lastSyncedSeq`
 *  from the manifest, so no later delta ever mentions an item that was already
 *  in the backup when the device joined. */
const selectWantedKeys = (deltas: DeltaEntry[]): BackupItemKey[] =>
    deltas
        .filter(
            d =>
                d.op === DeltaOperation.UPSERT &&
                d.status === BackupItemStatus.ACTIVE &&
                (d.key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX) ||
                    d.key.startsWith(BACKUP_SECRETS_KEY_PREFIX) ||
                    d.key.startsWith(BACKUP_CONTACTS_KEY_PREFIX)),
        )
        .map(d => d.key)

const readItemsInBatches = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    keys: BackupItemKey[],
): Promise<FetchedItem[]> => {
    const items: FetchedItem[] = []
    for (const batch of chunk(keys, READ_BATCH_SIZE)) {
        items.push(...(await readItems(network, backupId, deviceId, batch)))
    }
    return items
}

const decryptItem = (
    item: FetchedItem,
    encryptionKey: Uint8Array,
    backupId: BackupId,
): string | null => {
    try {
        return decryptItemPayload(item.payload, {
            encryptionKey,
            backupId,
            key: item.key,
        })
    } catch {
        logger.warn('pullBackupItems: failed to decrypt item', {
            key: item.key,
        })
        return null
    }
}

type CollectedPayloads = {
    addressPayloads: Map<string, AddressBackupPayload>
    secretsPayloads: Map<string, SecretsBackupPayload>
    contacts: ContactBackupPayload[]
    skipped: SkippedItem[]
}

const collectItemPayloads = (
    items: FetchedItem[],
    encryptionKey: Uint8Array,
    backupId: BackupId,
): CollectedPayloads => {
    const addressPayloads = new Map<string, AddressBackupPayload>()
    const secretsPayloads = new Map<string, SecretsBackupPayload>()
    const contacts: ContactBackupPayload[] = []
    const skipped: SkippedItem[] = []

    for (const item of items) {
        // A contact's address is the record, not the routing key, so it is
        // never looked up here; `null` is what selects the contact branch.
        const isContact = isContactItemKey(item.key)
        const address = isContact ? null : addressFromKey(item.key)
        if (!isContact && address === null) {
            logger.warn('pullBackupItems: unexpected item key format', {
                key: item.key,
            })
            skipped.push({ key: item.key, reason: 'missing-address' })
            continue
        }

        const plaintext = decryptItem(item, encryptionKey, backupId)
        if (plaintext === null) {
            skipped.push({ key: item.key, reason: 'decrypt' })
            continue
        }

        try {
            if (address === null) {
                contacts.push(parseContactPayload(plaintext))
            } else if (item.key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX)) {
                addressPayloads.set(address, parseAddressPayload(plaintext))
            } else {
                secretsPayloads.set(address, parseSecretsPayload(plaintext))
            }
        } catch {
            logger.warn('pullBackupItems: failed to parse item', {
                key: item.key,
            })
            skipped.push({ key: item.key, reason: 'parse' })
        }
    }

    return { addressPayloads, secretsPayloads, contacts, skipped }
}

/** Joins address + secrets payloads by address into PulledAccounts. A hdSeed
 *  secret with no matching address payload (its first account was removed) is
 *  surfaced as a standalone hdSeed entry so the seed still restores. */
export const buildPulledAccounts = (
    addressPayloads: Map<string, AddressBackupPayload>,
    secretsPayloads: Map<string, SecretsBackupPayload>,
): PulledAccount[] => {
    const accounts: PulledAccount[] = [...addressPayloads.entries()].map(
        ([address, addressPayload]) => ({
            address,
            addressPayload,
            secretsPayload: secretsPayloads.get(address) ?? null,
        }),
    )
    for (const [address, secretsPayload] of secretsPayloads.entries()) {
        if (
            secretsPayload.type === BackupAccountType.hdSeed &&
            !addressPayloads.has(address)
        ) {
            accounts.push({
                address,
                addressPayload: { type: BackupAccountType.hdSeed, address },
                secretsPayload,
            })
        }
    }
    return accounts
}

export const pullBackupItems = async ({
    network,
    backupId,
    deviceId,
    encryptionKey,
}: PullBackupItemsParams): Promise<PullBackupItemsResult> => {
    const manifest = await fetchManifest(network, backupId, deviceId)
    const deltas = await fetchDelta(network, backupId, deviceId, 0)

    const wantedKeys = selectWantedKeys(deltas)
    const items = await readItemsInBatches(
        network,
        backupId,
        deviceId,
        wantedKeys,
    )
    const { addressPayloads, secretsPayloads, contacts, skipped } =
        collectItemPayloads(items, encryptionKey, backupId)

    return {
        backupGlobalHash: manifest.backupGlobalHash,
        lastSeq: manifest.lastSeq,
        manifestItems: manifest.items,
        accounts: buildPulledAccounts(addressPayloads, secretsPayloads),
        contacts,
        skipped,
    }
}
