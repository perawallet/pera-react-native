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
import { parseAddressPayload, parseSecretsPayload } from '../api/payloadParsers'
import { decryptItemPayload } from '../crypto/itemPayload'
import {
    BackupItemStatus,
    DeltaOperation,
    type AddressBackupPayload,
    type BackupId,
    type BackupItemKey,
    type DeltaEntry,
    type DeviceId,
    type FetchedItem,
    type SecretsBackupPayload,
} from '../models'

const ACCOUNTS_PREFIX = 'accounts/'
const SECRETS_PREFIX = 'secrets/'
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
    accounts: PulledAccount[]
    skipped: SkippedItem[]
}

type PullBackupItemsParams = {
    network: Network
    backupId: BackupId
    deviceId: DeviceId
    encryptionKey: Uint8Array
}

const addressFromKey = (key: BackupItemKey): string | null => {
    if (key.startsWith(ACCOUNTS_PREFIX))
        return key.slice(ACCOUNTS_PREFIX.length)
    if (key.startsWith(SECRETS_PREFIX)) return key.slice(SECRETS_PREFIX.length)
    return null
}

const chunk = <T>(items: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size))
    }
    return out
}

/** Keys of the active account/secret items that should be read and restored. */
const selectWantedKeys = (deltas: DeltaEntry[]): BackupItemKey[] =>
    deltas
        .filter(
            d =>
                d.op === DeltaOperation.UPSERT &&
                d.status === BackupItemStatus.ACTIVE &&
                (d.key.startsWith(ACCOUNTS_PREFIX) ||
                    d.key.startsWith(SECRETS_PREFIX)),
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
    skipped: SkippedItem[]
}

const collectItemPayloads = (
    items: FetchedItem[],
    encryptionKey: Uint8Array,
    backupId: BackupId,
): CollectedPayloads => {
    const addressPayloads = new Map<string, AddressBackupPayload>()
    const secretsPayloads = new Map<string, SecretsBackupPayload>()
    const skipped: SkippedItem[] = []

    for (const item of items) {
        const address = addressFromKey(item.key)
        if (!address) {
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
            if (item.key.startsWith(ACCOUNTS_PREFIX)) {
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

    return { addressPayloads, secretsPayloads, skipped }
}

const buildAccounts = (
    addressPayloads: Map<string, AddressBackupPayload>,
    secretsPayloads: Map<string, SecretsBackupPayload>,
): PulledAccount[] =>
    [...addressPayloads.entries()].map(([address, addressPayload]) => ({
        address,
        addressPayload,
        secretsPayload: secretsPayloads.get(address) ?? null,
    }))

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
    const { addressPayloads, secretsPayloads, skipped } = collectItemPayloads(
        items,
        encryptionKey,
        backupId,
    )

    return {
        backupGlobalHash: manifest.backupGlobalHash,
        lastSeq: manifest.lastSeq,
        accounts: buildAccounts(addressPayloads, secretsPayloads),
        skipped,
    }
}
