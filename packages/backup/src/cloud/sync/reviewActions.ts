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
    parsePasskeyPayload,
    parsePasskeySecretsPayload,
    parseSecretsPayload,
} from '../api/payloadParsers'
import { decryptItemPayload } from '../crypto/itemPayload'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import {
    isAccountItemKey,
    passkeyPartnerKey,
    secretsItemKey,
    BACKUP_ACCOUNTS_KEY_PREFIX,
    BACKUP_CONTACTS_KEY_PREFIX,
    BACKUP_PASSKEYS_KEY_PREFIX,
    BACKUP_SECRETS_KEY_PREFIX,
    BackupAccountType,
    BackupItemStatus,
    hdPositionOf,
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
import { deleteItemIfPresent } from './pushDirty'
import type {
    ContactImportFn,
    ContactImportSummary,
    ImportSummary,
    PasskeyImportFn,
    PasskeyImportSummary,
    SyncEngineDeps,
    SyncImportFn,
} from './types'

export type ReviewActionDeps = {
    network: Network
    backupId: BackupId
    deviceId: DeviceId
    encryptionKey: Uint8Array
    hashAddress: ItemKeyHasher
    importAccounts: SyncImportFn
    importContacts: ContactImportFn
    importPasskeys: PasskeyImportFn
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
    hashAddress: deps.hashAddress,
    importAccounts: deps.importAccounts,
    importContacts: deps.importContacts,
    importPasskeys: deps.importPasskeys,
    readItems,
    deleteItem,
    decrypt: decryptItemPayload,
})

/** Matched on the cached address, never by rebuilding the key from it. */
const trackedKeysUnder = (
    state: SyncState,
    address: string,
    prefix: string,
): BackupItemKey[] =>
    Object.entries(state.items)
        .filter(
            ([key, item]) => key.startsWith(prefix) && item.address === address,
        )
        .map(([key]) => key)

const isLiveIn =
    (state: SyncState) =>
    (key: BackupItemKey): boolean =>
        state.items[key]?.status === BackupItemStatus.ACTIVE

const liveKeyUnder = (
    state: SyncState,
    address: string,
    prefix: string,
): BackupItemKey | null =>
    trackedKeysUnder(state, address, prefix).find(isLiveIn(state)) ?? null

const keysFor = (state: SyncState, address: string): BackupItemKey[] => [
    ...trackedKeysUnder(state, address, BACKUP_ACCOUNTS_KEY_PREFIX),
    ...trackedKeysUnder(state, address, BACKUP_SECRETS_KEY_PREFIX),
]

const liveKeysFor = (state: SyncState, address: string): BackupItemKey[] =>
    keysFor(state, address).filter(isLiveIn(state))

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
    for (const key of keysFor(state, address)) {
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
        try {
            const plaintext = deps.decrypt(item.payload, {
                encryptionKey: deps.encryptionKey,
                backupId: deps.backupId,
                key: item.key,
            })
            if (isAccountItemKey(item.key)) {
                const payload = parseAddressPayload(plaintext)
                into.addressPayloads.set(payload.address, payload)
            } else {
                const payload = parseSecretsPayload(plaintext)
                into.secretsPayloads.set(payload.address, payload)
            }
        } catch {
            logger.warn('reviewActions: unreadable item', { key: item.key })
        }
    }
}

/** Held HD items at the same seed position as `payload`: the same account on
 *  another chain, which Add brings back together. */
const heldPositionSiblingKeys = async (
    state: SyncState,
    ownKey: BackupItemKey,
    payload: AddressBackupPayload,
    deps: ReviewActionDeps,
): Promise<BackupItemKey[]> => {
    const position = hdPositionOf(payload)
    if (position === null) return []
    const candidates = Object.entries(state.items)
        .filter(
            ([key, item]) =>
                key !== ownKey &&
                isAccountItemKey(key) &&
                item.status === BackupItemStatus.ACTIVE &&
                item.pendingImport === true &&
                (item.accountType === BackupAccountType.hdWallet ||
                    item.accountType === BackupAccountType.hdChain),
        )
        .map(([key]) => key)
    const payloads = await readAddressPayloads(candidates, deps)
    return candidates.filter(key => {
        const other = payloads.get(key)
        const otherPosition = other ? hdPositionOf(other) : null
        return (
            otherPosition !== null &&
            otherPosition.seedReference === position.seedReference &&
            otherPosition.account === position.account &&
            otherPosition.keyIndex === position.keyIndex
        )
    })
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
    const ownKeys = liveKeysFor(state, address)
    if (ownKeys.length === 0) {
        return {
            state,
            summary: {
                imported: 0,
                skippedDuplicate: 0,
                failed: [{ address, reason: 'Not present in the backup' }],
            },
        }
    }

    const ownFetched = await deps.readItems(
        deps.network,
        deps.backupId,
        deps.deviceId,
        ownKeys,
    )
    const collected: CollectedPayloads = {
        addressPayloads: new Map(),
        secretsPayloads: new Map(),
    }
    collect(ownFetched, deps, collected)

    const addressPayload = collected.addressPayloads.get(address)
    const addressKey = ownKeys.find(isAccountItemKey)
    const siblingKeys =
        addressPayload && addressKey
            ? await heldPositionSiblingKeys(
                  state,
                  addressKey,
                  addressPayload,
                  deps,
              )
            : []
    const siblingFetched =
        siblingKeys.length > 0
            ? await deps.readItems(
                  deps.network,
                  deps.backupId,
                  deps.deviceId,
                  siblingKeys,
              )
            : []
    collect(siblingFetched, deps, collected)

    const seedReference = addressPayload
        ? hdPositionOf(addressPayload)?.seedReference
        : undefined
    if (seedReference) {
        // Hashed, not matched: the seed is filed under an account this device
        // may not hold, so nothing caches that address.
        const seedKey = secretsItemKey(deps.hashAddress(seedReference))
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

    const byKey = new Map(
        [...ownFetched, ...siblingFetched].map(item => [item.key, item]),
    )
    const items = { ...state.items }
    for (const key of [...ownKeys, ...siblingKeys]) {
        const tracked = items[key]
        if (tracked) items[key] = clearReviewed(tracked, byKey.get(key))
    }
    return { state: { ...state, items }, summary }
}

const otherLiveAddressKeys = (
    state: SyncState,
    ownKey: BackupItemKey,
): BackupItemKey[] =>
    Object.entries(state.items)
        .filter(
            ([key, item]) =>
                key !== ownKey &&
                isAccountItemKey(key) &&
                item.status === BackupItemStatus.ACTIVE,
        )
        .map(([key]) => key)

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
    addressKey: BackupItemKey,
    address: string,
    deps: ReviewActionDeps,
): Promise<BackupItemKey | null> => {
    const isLive = isLiveIn(state)
    const others = otherLiveAddressKeys(state, addressKey)

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

    const ownSeed = hdPositionOf(own)?.seedReference
    if (ownSeed === undefined) {
        return liveKeyUnder(state, address, BACKUP_SECRETS_KEY_PREFIX)
    }

    // Hashed, not matched: the seed is filed under an account this device may
    // not hold, so nothing caches that address.
    const seedKey = secretsItemKey(deps.hashAddress(ownSeed))
    if (!isLive(seedKey)) return null

    const stillDerives = others.some(key => {
        const payload = payloads.get(key)
        // Unreadable sibling: assume it needs the seed.
        if (!payload) return true
        return hdPositionOf(payload)?.seedReference === ownSeed
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
            await deleteItemIfPresent(deps, key)
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

/** `keys` is not derivable from the address: a shared seed lives under a
 *  sibling's, and one a surviving sibling still derives from is left alone. */
export type BackupDeleteResult = {
    state: SyncState
    keys: BackupItemKey[]
}

export const deleteFromBackup = async ({
    state,
    address,
    deps,
}: {
    state: SyncState
    address: string
    deps: ReviewActionDeps
}): Promise<BackupDeleteResult> => {
    const addressKey = liveKeyUnder(state, address, BACKUP_ACCOUNTS_KEY_PREFIX)
    if (addressKey === null) {
        return { state, keys: [] }
    }

    const keys: BackupItemKey[] = [addressKey]
    const secretKey = await secretKeyToDelete(state, addressKey, address, deps)
    if (secretKey !== null) keys.push(secretKey)

    return { state: await deleteKeysFromBackup({ state, keys, deps }), keys }
}

export const deleteContactFromBackup = async ({
    state,
    address,
    deps,
}: {
    state: SyncState
    address: string
    deps: ReviewActionDeps
}): Promise<BackupDeleteResult> => {
    const key = liveKeyUnder(state, address, BACKUP_CONTACTS_KEY_PREFIX)
    const keys = key === null ? [] : [key]

    return { state: await deleteKeysFromBackup({ state, keys, deps }), keys }
}

/** Mirror of `markAccountForBackup`: dropping the tombstone rather than
 *  reviving it is what makes the re-upload correct, since the server deleted
 *  the key and it has to go back at version 0. */
export const markContactForBackup = (
    state: SyncState,
    address: string,
): SyncState => {
    const items = { ...state.items }
    for (const key of trackedKeysUnder(
        state,
        address,
        BACKUP_CONTACTS_KEY_PREFIX,
    )) {
        delete items[key]
    }
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
    const key = liveKeyUnder(state, address, BACKUP_CONTACTS_KEY_PREFIX)
    if (key === null) return state

    return {
        ...state,
        items: {
            ...state.items,
            [key]: {
                ...(state.items[key] as SyncItemState),
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
    const key = liveKeyUnder(state, address, BACKUP_CONTACTS_KEY_PREFIX)
    if (key === null) return contactNotInBackup(state, address)

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

/** Each tracked record with its secret. The secret is named from the
 *  record's key, never matched on its cached address: a secret this device
 *  never downloaded (held for review, or first seen as a delete) has none. */
const passkeyKeysFor = (
    state: SyncState,
    credentialId: string,
): BackupItemKey[] =>
    trackedKeysUnder(state, credentialId, BACKUP_PASSKEYS_KEY_PREFIX).flatMap(
        key => {
            const secretKey = passkeyPartnerKey(key)
            return secretKey !== null && state.items[secretKey]
                ? [key, secretKey]
                : [key]
        },
    )

/** Mirror of `markContactForBackup`: dropping the tombstone rather than
 *  reviving it is what makes the re-upload correct, since the server deleted
 *  the key and it has to go back at version 0. */
export const markPasskeyForBackup = (
    state: SyncState,
    credentialId: string,
): SyncState => {
    const items = { ...state.items }
    for (const key of passkeyKeysFor(state, credentialId)) {
        delete items[key]
    }
    return { ...state, items }
}

/** Keeps the backup's copy of a credential the user is removing from this
 *  device. `label` is stamped here because this device may never have
 *  downloaded the item it pushed, and the review row has nothing else to
 *  render. */
export const keepPasskeyInBackup = (
    state: SyncState,
    credentialId: string,
    label: string,
): SyncState => {
    const key = liveKeyUnder(state, credentialId, BACKUP_PASSKEYS_KEY_PREFIX)
    if (key === null) return state

    const items = { ...state.items }
    for (const held of passkeyKeysFor(state, credentialId).filter(
        isLiveIn(state),
    )) {
        items[held] = {
            ...(items[held] as SyncItemState),
            pendingImport: true,
            isDirty: false,
            pendingDelete: false,
        }
    }
    items[key] = { ...(items[key] as SyncItemState), label }
    return { ...state, items }
}

export const deletePasskeyFromBackup = async ({
    state,
    credentialId,
    deps,
}: {
    state: SyncState
    credentialId: string
    deps: ReviewActionDeps
}): Promise<BackupDeleteResult> => {
    const keys = passkeyKeysFor(state, credentialId).filter(isLiveIn(state))

    return { state: await deleteKeysFromBackup({ state, keys, deps }), keys }
}

const passkeyNotInBackup = (
    state: SyncState,
    credentialId: string,
): { state: SyncState; summary: PasskeyImportSummary } => ({
    state,
    summary: {
        imported: 0,
        skipped: [],
        failed: [{ credentialId, reason: 'Not present in the backup' }],
    },
})

const decryptWith =
    (deps: ReviewActionDeps) =>
    (item: FetchedItem): string =>
        deps.decrypt(item.payload, {
            encryptionKey: deps.encryptionKey,
            backupId: deps.backupId,
            key: item.key,
        })

/** Re-reads the items rather than trusting the cached `label`, so `label`
 *  stays a pure display concern and writes have one code path. An unreadable
 *  secret is not fatal: the import falls back to the owning seed, or reports
 *  the credential as skipped. */
export const importPasskeyFromBackup = async ({
    state,
    credentialId,
    deps,
}: {
    state: SyncState
    credentialId: string
    deps: ReviewActionDeps
}): Promise<{ state: SyncState; summary: PasskeyImportSummary }> => {
    const key = liveKeyUnder(state, credentialId, BACKUP_PASSKEYS_KEY_PREFIX)
    if (key === null) return passkeyNotInBackup(state, credentialId)
    const partner = passkeyPartnerKey(key)
    const secretKey =
        partner !== null && isLiveIn(state)(partner) ? partner : null

    const fetchedItems = await deps.readItems(
        deps.network,
        deps.backupId,
        deps.deviceId,
        secretKey === null ? [key] : [key, secretKey],
    )
    const byKey = new Map(fetchedItems.map(item => [item.key, item]))
    const fetched = byKey.get(key)
    if (!fetched) return passkeyNotInBackup(state, credentialId)

    let payload
    try {
        payload = parsePasskeyPayload(decryptWith(deps)(fetched))
    } catch (error) {
        logger.warn('reviewActions: unreadable passkey', { key })
        return {
            state,
            summary: {
                imported: 0,
                skipped: [],
                failed: [
                    {
                        credentialId,
                        reason:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    },
                ],
            },
        }
    }

    const fetchedSecret = secretKey === null ? undefined : byKey.get(secretKey)
    let secret = null
    if (fetchedSecret) {
        try {
            secret = parsePasskeySecretsPayload(
                decryptWith(deps)(fetchedSecret),
            )
        } catch {
            logger.warn('reviewActions: unreadable passkey secret', {
                key: secretKey,
            })
        }
    }

    const summary = await deps.importPasskeys([{ payload, secret }])
    const items = {
        ...state.items,
        [key]: {
            ...clearReviewed(state.items[key] as SyncItemState, fetched),
            label: payload.displayName ?? payload.origin,
        },
    }
    if (secretKey !== null) {
        items[secretKey] = clearReviewed(
            state.items[secretKey] as SyncItemState,
            fetchedSecret,
        )
    }
    return { state: { ...state, items }, summary }
}
