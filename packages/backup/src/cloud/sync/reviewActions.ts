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
import { deleteItem, readItems } from '../api'
import {
    parseAddressPayload,
    parseContactPayload,
    parseSecretsPayload,
} from '../api/payloadParsers'
import { decryptItemPayload } from '../crypto/itemPayload'
import {
    accountItemKey,
    contactItemKey,
    isAccountItemKey,
    secretsItemKey,
    BACKUP_ACCOUNTS_KEY_PREFIX,
    BACKUP_SECRETS_KEY_PREFIX,
    BackupAccountType,
    BackupItemStatus,
    type AddressBackupPayload,
    type BackupId,
    type BackupItemKey,
    type DeviceId,
    type FetchedItem,
    type SecretsBackupPayload,
    type SyncItemState,
    type SyncState,
} from '../models'
import { buildPulledAccounts } from '../restore'
import type {
    ContactImportFn,
    ContactImportSummary,
    ImportSummary,
    SyncEngineDeps,
    SyncImportFn,
} from './types'

export type ReviewActionDeps = {
    network: Network
    backupId: BackupId
    deviceId: DeviceId
    encryptionKey: Uint8Array
    importAccounts: SyncImportFn
    importContacts: ContactImportFn
    readItems: (
        network: Network,
        backupId: BackupId,
        deviceId: DeviceId,
        keys: BackupItemKey[],
    ) => Promise<FetchedItem[]>
    deleteItem: (
        network: Network,
        backupId: BackupId,
        deviceId: DeviceId,
        key: BackupItemKey,
    ) => Promise<unknown>
    decrypt: (
        payload: string,
        ctx: {
            encryptionKey: Uint8Array
            backupId: BackupId
            key: BackupItemKey
        },
    ) => string
}

export const reviewActionDeps = (deps: SyncEngineDeps): ReviewActionDeps => ({
    network: deps.network,
    backupId: deps.backupId,
    deviceId: deps.deviceId,
    encryptionKey: deps.encryptionKey,
    importAccounts: deps.importAccounts,
    importContacts: deps.importContacts,
    readItems,
    deleteItem,
    decrypt: decryptItemPayload,
})

/** Keys the backup currently holds for one address, in read order. */
const liveKeysFor = (state: SyncState, address: string): BackupItemKey[] =>
    [accountItemKey(address), secretsItemKey(address)].filter(
        key => state.items[key]?.status === BackupItemStatus.ACTIVE,
    )

/**
 * Forgets what the backup knew about an address so the next reconcile treats
 * its items as brand new. Dropping the tombstone rather than reviving it is
 * what makes the re-upload correct: the server deleted these keys, so they
 * have to go back at version 0.
 */
export const markAccountForBackup = (
    state: SyncState,
    address: string,
): SyncState => {
    const items = { ...state.items }
    for (const key of [accountItemKey(address), secretsItemKey(address)]) {
        delete items[key]
    }
    return { ...state, items }
}

/**
 * Keeps the backup's copy of an address the user is removing from this device.
 * `pendingImport` is what puts it in the review screen's "available from
 * backup" bucket; without it, an address the backup holds but the device does
 * not falls out of both buckets and the user has no way back to it.
 */
export const keepAccountInBackup = (
    state: SyncState,
    address: string,
): SyncState => {
    const items = { ...state.items }
    for (const key of liveKeysFor(state, address)) {
        items[key] = {
            ...(items[key] as SyncItemState),
            pendingImport: true,
            isDirty: false,
            pendingDelete: false,
        }
    }
    return { ...state, items }
}

const clearReviewed = (
    item: SyncItemState,
    fetched: FetchedItem | undefined,
): SyncItemState => ({
    ...item,
    pendingImport: false,
    isDirty: false,
    knownVer: fetched?.ver ?? item.knownVer,
    baseVer: fetched?.ver ?? item.baseVer,
    lastRemoteHash: fetched?.hash ?? item.lastRemoteHash,
})

type CollectedPayloads = {
    addressPayloads: Map<string, AddressBackupPayload>
    secretsPayloads: Map<string, SecretsBackupPayload>
}

const collect = (
    items: FetchedItem[],
    deps: ReviewActionDeps,
    into: CollectedPayloads,
): void => {
    for (const item of items) {
        const isAddress = item.key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX)
        const address = item.key.slice(
            (isAddress ? BACKUP_ACCOUNTS_KEY_PREFIX : BACKUP_SECRETS_KEY_PREFIX)
                .length,
        )
        try {
            const plaintext = deps.decrypt(item.payload, {
                encryptionKey: deps.encryptionKey,
                backupId: deps.backupId,
                key: item.key,
            })
            if (isAddress)
                into.addressPayloads.set(
                    address,
                    parseAddressPayload(plaintext),
                )
            else
                into.secretsPayloads.set(
                    address,
                    parseSecretsPayload(plaintext),
                )
        } catch {
            logger.warn('reviewActions: unreadable item', { key: item.key })
        }
    }
}

/** An HD child needs a second read: its key material lives under the seed's
 *  first derived address, not its own, and without it the import has no parent
 *  to derive from. */
export const importFromBackup = async ({
    state,
    address,
    deps,
}: {
    state: SyncState
    address: string
    deps: ReviewActionDeps
}): Promise<{ state: SyncState; summary: ImportSummary }> => {
    const keys = liveKeysFor(state, address)
    if (keys.length === 0) {
        return {
            state,
            summary: {
                imported: 0,
                skippedDuplicate: 0,
                failed: [{ address, reason: 'Not present in the backup' }],
            },
        }
    }

    const fetched = await deps.readItems(
        deps.network,
        deps.backupId,
        deps.deviceId,
        keys,
    )
    const collected: CollectedPayloads = {
        addressPayloads: new Map(),
        secretsPayloads: new Map(),
    }
    collect(fetched, deps, collected)

    const addressPayload = collected.addressPayloads.get(address)
    if (addressPayload?.type === BackupAccountType.hdWallet) {
        const seedKey = secretsItemKey(addressPayload.seedFirstDerivedAddress)
        if (state.items[seedKey]?.status === BackupItemStatus.ACTIVE) {
            collect(
                await deps.readItems(
                    deps.network,
                    deps.backupId,
                    deps.deviceId,
                    [seedKey],
                ),
                deps,
                collected,
            )
        }
    }

    const summary = await deps.importAccounts(
        buildPulledAccounts(
            collected.addressPayloads,
            collected.secretsPayloads,
        ),
    )

    const byKey = new Map(fetched.map(item => [item.key, item]))
    const items = { ...state.items }
    for (const key of keys) {
        const tracked = items[key]
        if (tracked) items[key] = clearReviewed(tracked, byKey.get(key))
    }
    return { state: { ...state, items }, summary }
}

const otherLiveAddressKeys = (
    state: SyncState,
    address: string,
): BackupItemKey[] => {
    const own = accountItemKey(address)
    return Object.entries(state.items)
        .filter(
            ([key, item]) =>
                key !== own &&
                isAccountItemKey(key) &&
                item.status === BackupItemStatus.ACTIVE,
        )
        .map(([key]) => key)
}

/** Anything unreadable is simply absent from the result, so callers must treat
 *  a missing key as "unknown", never as "not there". */
const readAddressPayloads = async (
    keys: BackupItemKey[],
    deps: ReviewActionDeps,
): Promise<Map<BackupItemKey, AddressBackupPayload>> => {
    const out = new Map<BackupItemKey, AddressBackupPayload>()
    if (keys.length === 0) return out

    const fetched = await deps.readItems(
        deps.network,
        deps.backupId,
        deps.deviceId,
        keys,
    )
    for (const item of fetched) {
        try {
            out.set(
                item.key,
                parseAddressPayload(
                    deps.decrypt(item.payload, {
                        encryptionKey: deps.encryptionKey,
                        backupId: deps.backupId,
                        key: item.key,
                    }),
                ),
            )
        } catch {
            logger.warn('reviewActions: unreadable address record', {
                key: item.key,
            })
        }
    }
    return out
}

/**
 * An HD account's secret is the seed every sibling derives from, stored under
 * the seed's first derived address — itself an ordinary account. So the seed
 * only goes once no address record in the backup still derives from it, and
 * anything unreadable counts as "still derives": never delete key material we
 * cannot prove is unreferenced.
 */
const secretKeyToDelete = async (
    state: SyncState,
    address: string,
    deps: ReviewActionDeps,
): Promise<BackupItemKey | null> => {
    const ownSecret = secretsItemKey(address)
    const isLive = (key: BackupItemKey): boolean =>
        state.items[key]?.status === BackupItemStatus.ACTIVE

    const addressKey = accountItemKey(address)
    const others = otherLiveAddressKeys(state, address)

    let payloads: Map<BackupItemKey, AddressBackupPayload>
    try {
        payloads = await readAddressPayloads([addressKey, ...others], deps)
    } catch (error) {
        // Offline: delete the address (which queues a retry) and leave every
        // secret alone rather than guess.
        logger.warn('reviewActions: could not read address records', {
            error: error instanceof Error ? error.message : String(error),
        })
        return null
    }

    const own = payloads.get(addressKey)
    if (!own) return null

    if (own.type !== BackupAccountType.hdWallet) {
        return isLive(ownSecret) ? ownSecret : null
    }

    const seedKey = secretsItemKey(own.seedFirstDerivedAddress)
    if (!isLive(seedKey)) return null

    const stillDerives = others.some(key => {
        const payload = payloads.get(key)
        // Unreadable sibling: assume it needs the seed.
        if (!payload) return true
        return (
            payload.type === BackupAccountType.hdWallet &&
            payload.seedFirstDerivedAddress === own.seedFirstDerivedAddress
        )
    })
    return stillDerives ? null : seedKey
}

/** The local tombstone stays, so a later re-upload from elsewhere comes back to
 *  review rather than importing itself. */
const deleteKeysFromBackup = async ({
    state,
    keys,
    deps,
}: {
    state: SyncState
    keys: BackupItemKey[]
    deps: ReviewActionDeps
}): Promise<SyncState> => {
    const items = { ...state.items }
    for (const key of keys) {
        // Marked before the request, so a failure leaves a retry pushDirty can
        // finish rather than a delete the user asked for and never got.
        items[key] = { ...(items[key] as SyncItemState), pendingDelete: true }
        try {
            await deps.deleteItem(
                deps.network,
                deps.backupId,
                deps.deviceId,
                key,
            )
        } catch (error) {
            logger.warn('reviewActions: delete failed, queued for retry', {
                key,
                error: error instanceof Error ? error.message : String(error),
            })
            continue
        }
        items[key] = {
            ...(items[key] as SyncItemState),
            status: BackupItemStatus.IGNORED,
            isDirty: false,
            pendingDelete: false,
            pendingImport: false,
            localContentHash: null,
            localUpdatedAt: null,
        }
    }
    return { ...state, items }
}

export const deleteFromBackup = async ({
    state,
    address,
    deps,
}: {
    state: SyncState
    address: string
    deps: ReviewActionDeps
}): Promise<SyncState> => {
    const keys: BackupItemKey[] = []
    const addressKey = accountItemKey(address)
    if (state.items[addressKey]?.status === BackupItemStatus.ACTIVE) {
        keys.push(addressKey)
    }
    const secretKey = await secretKeyToDelete(state, address, deps)
    if (secretKey !== null) keys.push(secretKey)

    return deleteKeysFromBackup({ state, keys, deps })
}

export const deleteContactFromBackup = async ({
    state,
    address,
    deps,
}: {
    state: SyncState
    address: string
    deps: ReviewActionDeps
}): Promise<SyncState> => {
    const key = contactItemKey(address)
    const keys =
        state.items[key]?.status === BackupItemStatus.ACTIVE ? [key] : []

    return deleteKeysFromBackup({ state, keys, deps })
}

/** Mirror of `markAccountForBackup`: dropping the tombstone rather than
 *  reviving it is what makes the re-upload correct, since the server deleted
 *  the key and it has to go back at version 0. */
export const markContactForBackup = (
    state: SyncState,
    address: string,
): SyncState => {
    const items = { ...state.items }
    delete items[contactItemKey(address)]
    return { ...state, items }
}

/** Keeps the backup's copy of a contact the user is removing from this device.
 *  `name` is stamped here because this device may never have downloaded the
 *  item it pushed, and the review row has nothing else to render. */
export const keepContactInBackup = (
    state: SyncState,
    address: string,
    name: string,
): SyncState => {
    const key = contactItemKey(address)
    const tracked = state.items[key]
    if (!tracked || tracked.status !== BackupItemStatus.ACTIVE) return state

    return {
        ...state,
        items: {
            ...state.items,
            [key]: {
                ...tracked,
                pendingImport: true,
                isDirty: false,
                pendingDelete: false,
                label: name,
            },
        },
    }
}

const contactNotInBackup = (
    state: SyncState,
    address: string,
): { state: SyncState; summary: ContactImportSummary } => ({
    state,
    summary: {
        imported: 0,
        failed: [{ address, reason: 'Not present in the backup' }],
    },
})

/** Re-reads the item rather than trusting the cached `label`, so `label` stays
 *  a pure display concern and imports have one code path. */
export const importContactFromBackup = async ({
    state,
    address,
    deps,
}: {
    state: SyncState
    address: string
    deps: ReviewActionDeps
}): Promise<{ state: SyncState; summary: ContactImportSummary }> => {
    const key = contactItemKey(address)
    if (state.items[key]?.status !== BackupItemStatus.ACTIVE) {
        return contactNotInBackup(state, address)
    }

    const [fetched] = await deps.readItems(
        deps.network,
        deps.backupId,
        deps.deviceId,
        [key],
    )
    if (!fetched) return contactNotInBackup(state, address)

    let payload
    try {
        payload = parseContactPayload(
            deps.decrypt(fetched.payload, {
                encryptionKey: deps.encryptionKey,
                backupId: deps.backupId,
                key,
            }),
        )
    } catch (error) {
        logger.warn('reviewActions: unreadable contact', { key })
        return {
            state,
            summary: {
                imported: 0,
                failed: [
                    {
                        address,
                        reason:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    },
                ],
            },
        }
    }

    const summary = await deps.importContacts([payload])
    return {
        state: {
            ...state,
            items: {
                ...state.items,
                [key]: {
                    ...clearReviewed(
                        state.items[key] as SyncItemState,
                        fetched,
                    ),
                    label: payload.name,
                },
            },
        },
        summary,
    }
}
