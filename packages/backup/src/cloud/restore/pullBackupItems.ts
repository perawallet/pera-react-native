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
import { fetchManifest, readItems } from '../api'
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
    isContactItemKey,
    type AddressBackupPayload,
    type BackupId,
    type BackupItemKey,
    type ContactBackupPayload,
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
    reason: 'decrypt' | 'parse'
}

export type PullBackupItemsResult = {
    backupGlobalHash: string
    lastSeq: number
    /** Every key the backup holds and the version it holds it at — including
     *  tombstones and items the restore could not read, which the caller still
     *  has to track or it will offer them to the server as new. */
    manifestItems: Record<BackupItemKey, ManifestItem>
    /** The address each read item was filed under. This pull is the only place
     *  a restore can learn it: the key is an HMAC of the address. */
    addressByKey: Record<BackupItemKey, string>
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

const chunk = <T>(items: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size))
    }
    return out
}

/** Keys of the active items that should be read and restored. Read from the
 *  manifest and never from a `from_seq=0` delta: once changelog retention has
 *  pruned anything, seq 0 is itself out of the window and the delta call fails
 *  permanently — which would make every restore of a busy backup fail with it.
 *
 *  Contacts are in here because the restore is their only way home: it seeds
 *  `lastSyncedSeq` from the manifest, so no later delta ever mentions an item
 *  that was already in the backup when the device joined. */
const selectWantedKeys = (
    manifestItems: Record<BackupItemKey, ManifestItem>,
): BackupItemKey[] =>
    Object.entries(manifestItems)
        .filter(
            ([key, item]) =>
                item.status === BackupItemStatus.ACTIVE &&
                (key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX) ||
                    key.startsWith(BACKUP_SECRETS_KEY_PREFIX) ||
                    key.startsWith(BACKUP_CONTACTS_KEY_PREFIX)),
        )
        .map(([key]) => key)

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
    addressByKey: Record<BackupItemKey, string>
    skipped: SkippedItem[]
}

type ParsedItemPayload =
    | { kind: 'address'; payload: AddressBackupPayload }
    | { kind: 'secrets'; payload: SecretsBackupPayload }
    | { kind: 'contact'; payload: ContactBackupPayload }

/** The prefixes are deliberately in the clear, so they still say which of the
 *  three shapes a payload is; everything after the prefix is a hash. */
const parseItemPayload = (
    key: BackupItemKey,
    plaintext: string,
): ParsedItemPayload => {
    if (isContactItemKey(key))
        return { kind: 'contact', payload: parseContactPayload(plaintext) }
    if (key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX))
        return { kind: 'address', payload: parseAddressPayload(plaintext) }
    return { kind: 'secrets', payload: parseSecretsPayload(plaintext) }
}

/** Both maps are keyed on the payload's own address: the item key is an HMAC
 *  of it and cannot be inverted, while an account's address record and its
 *  secrets record repeat the same address, so they still join. */
const collectItemPayloads = (
    items: FetchedItem[],
    encryptionKey: Uint8Array,
    backupId: BackupId,
): CollectedPayloads => {
    const addressPayloads = new Map<string, AddressBackupPayload>()
    const secretsPayloads = new Map<string, SecretsBackupPayload>()
    const contacts: ContactBackupPayload[] = []
    const addressByKey: Record<BackupItemKey, string> = {}
    const skipped: SkippedItem[] = []

    for (const item of items) {
        const plaintext = decryptItem(item, encryptionKey, backupId)
        if (plaintext === null) {
            skipped.push({ key: item.key, reason: 'decrypt' })
            continue
        }

        let parsed: ParsedItemPayload
        try {
            parsed = parseItemPayload(item.key, plaintext)
        } catch {
            logger.warn('pullBackupItems: failed to parse item', {
                key: item.key,
            })
            skipped.push({ key: item.key, reason: 'parse' })
            continue
        }

        const { address } = parsed.payload
        addressByKey[item.key] = address
        if (parsed.kind === 'contact') contacts.push(parsed.payload)
        else if (parsed.kind === 'address')
            addressPayloads.set(address, parsed.payload)
        else secretsPayloads.set(address, parsed.payload)
    }

    return { addressPayloads, secretsPayloads, contacts, addressByKey, skipped }
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
    for (const secretsPayload of secretsPayloads.values()) {
        const { address } = secretsPayload
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

    const wantedKeys = selectWantedKeys(manifest.items)
    const items = await readItemsInBatches(
        network,
        backupId,
        deviceId,
        wantedKeys,
    )
    const {
        addressPayloads,
        secretsPayloads,
        contacts,
        addressByKey,
        skipped,
    } = collectItemPayloads(items, encryptionKey, backupId)

    return {
        backupGlobalHash: manifest.backupGlobalHash,
        lastSeq: manifest.lastSeq,
        manifestItems: manifest.items,
        addressByKey,
        accounts: buildPulledAccounts(addressPayloads, secretsPayloads),
        contacts,
        skipped,
    }
}
