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
    logger,
    toError,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { deleteItem, readItems } from '../api'
import {
    parseAccountRecordPayload,
    parseAddressPayload,
    parseContactPayload,
    parseContactRecordPayload,
    parsePasskeyPayload,
    parsePasskeySecretsPayload,
    parseSecretsPayload,
} from '../api/payloadParsers'
import { decryptItemPayload } from '../crypto/itemPayload'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import {
    accountRecordSeedReference,
    cachedRecordSeedReference,
    contactRecordEntries,
    isContactItemKey,
    isContactRecordKey,
    trackedContactId,
    isAccountRecordReadable,
    isAccountItemKey,
    isAccountKey,
    isAccountRecordKey,
    passkeyPartnerKey,
    secretsItemKey,
    BACKUP_ACCOUNT_RECORDS_KEY_PREFIX,
    BACKUP_ACCOUNTS_KEY_PREFIX,
    BACKUP_PASSKEYS_KEY_PREFIX,
    BACKUP_SECRETS_KEY_PREFIX,
    BackupAccountType,
    BackupItemStatus,
    hdPositionOf,
    type AccountRecordPayload,
    type AddressBackupPayload,
    type BackupId,
    type BackupItemKey,
    type ContactBackupPayload,
    type ContactRecordPayload,
    type DeviceId,
    type FetchedItem,
    type SecretsBackupPayload,
    type SyncItemState,
    type SyncState,
} from '../models'
import { buildPulledAccounts, buildPulledContacts } from '../restore'
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
    backupId: BackupId
    deviceId: DeviceId
    encryptionKey: Uint8Array
    hashAddress: ItemKeyHasher
    importAccounts: SyncImportFn
    importContacts: ContactImportFn
    importPasskeys: PasskeyImportFn
    readItems: (
        backupId: BackupId,
        deviceId: DeviceId,
        keys: BackupItemKey[],
    ) => Promise<FetchedItem[]>
    deleteItem: (
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

/** Whether a tracked item names `address`: its own, or any chain's of an
 *  account record. Matched on the cache, never by rebuilding the key. */
const names = (item: SyncItemState, address: string): boolean =>
    item.address === address || item.addresses?.includes(address) === true

const trackedKeysUnder = (
    state: SyncState,
    address: string,
    prefix: string,
): BackupItemKey[] =>
    Object.entries(state.items)
        .filter(([key, item]) => key.startsWith(prefix) && names(item, address))
        .map(([key]) => key)

const isLiveIn =
    (state: SyncState) =>
    (key: BackupItemKey): boolean =>
        state.items[key]?.status === BackupItemStatus.ACTIVE

const liveKeyUnder = (
    state: SyncState,
    address: string,
    prefix: string,
): Nullable<BackupItemKey> =>
    trackedKeysUnder(state, address, prefix).find(isLiveIn(state)) ?? null

/** The record of the account `address` is on, live first. */
const recordKeyFor = (
    state: SyncState,
    address: string,
): Nullable<BackupItemKey> => {
    const keys = trackedKeysUnder(
        state,
        address,
        BACKUP_ACCOUNT_RECORDS_KEY_PREFIX,
    )
    return keys.find(isLiveIn(state)) ?? keys[0] ?? null
}

/** Every address of the account `address` is on, as far as the backup knows:
 *  its record's chains, else the address alone. */
const accountAddressesIn = (state: SyncState, address: string): string[] => {
    const key = recordKeyFor(state, address)
    return (key && state.items[key]?.addresses) || [address]
}

const recordSeedReference = (item: Optional<SyncItemState>): Nullable<string> =>
    cachedRecordSeedReference(item?.record)

const isSeedSecret = (state: SyncState, key: BackupItemKey): boolean =>
    state.items[key]?.accountType === BackupAccountType.hdSeed

/** The account's record, its legacy items and its own secrets. The shared HD
 *  seed counts only where the account's address is the one it is filed
 *  under, as before records. */
const keysFor = (state: SyncState, address: string): BackupItemKey[] => {
    const addresses = accountAddressesIn(state, address)
    return [
        ...new Set([
            ...trackedKeysUnder(
                state,
                address,
                BACKUP_ACCOUNT_RECORDS_KEY_PREFIX,
            ),
            ...addresses.flatMap(each => [
                ...trackedKeysUnder(state, each, BACKUP_ACCOUNTS_KEY_PREFIX),
                ...trackedKeysUnder(state, each, BACKUP_SECRETS_KEY_PREFIX),
            ]),
        ]),
    ]
}

const liveKeysFor = (state: SyncState, address: string): BackupItemKey[] =>
    keysFor(state, address).filter(isLiveIn(state))

/**
 * Forgets what the backup knew about an address so the next reconcile treats
 * its items as brand new. Dropping the tombstone rather than reviving it is
 * what makes the re-upload correct: the server deleted these keys, so they
 * have to go back at version 0. An item the server still holds keeps its
 * version instead, since tracking it at 0 would conflict on every push; that
 * covers a seed another account still uses. A legacy tombstone goes too:
 * reconcile holds back a record whose legacy items were all deleted.
 */
export const markAccountForBackup = (
    state: SyncState,
    address: string,
): SyncState => {
    const items = { ...state.items }
    const recordKey = recordKeyFor(state, address)
    const seedReference = recordKey
        ? recordSeedReference(state.items[recordKey])
        : null
    const seedKeys = seedReference
        ? trackedKeysUnder(state, seedReference, BACKUP_SECRETS_KEY_PREFIX)
        : []
    for (const key of new Set([...keysFor(state, address), ...seedKeys])) {
        const item = items[key] as SyncItemState
        if (item.status === BackupItemStatus.ACTIVE && item.knownVer > 0) {
            items[key] = { ...item, pendingDelete: false, pendingImport: false }
        } else {
            delete items[key]
        }
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
    fetched: Optional<FetchedItem>,
): SyncItemState => ({
    ...item,
    pendingImport: false,
    isDirty: false,
    knownVer: fetched?.ver ?? item.knownVer,
    baseVer: fetched?.ver ?? item.baseVer,
    lastRemoteHash: fetched?.hash ?? item.lastRemoteHash,
})

type CollectedPayloads = {
    records: AccountRecordPayload[]
    addressPayloads: Map<string, AddressBackupPayload>
    secretsPayloads: Map<string, SecretsBackupPayload>
}

const decryptWithDeps = (item: FetchedItem, deps: ReviewActionDeps): string =>
    deps.decrypt(item.payload, {
        encryptionKey: deps.encryptionKey,
        backupId: deps.backupId,
        key: item.key,
    })

const collect = (
    items: FetchedItem[],
    deps: ReviewActionDeps,
    into: CollectedPayloads,
): void => {
    for (const item of items) {
        try {
            const plaintext = decryptWithDeps(item, deps)
            if (isAccountRecordKey(item.key)) {
                into.records.push(parseAccountRecordPayload(plaintext))
            } else if (isAccountItemKey(item.key)) {
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

const seedReferenceOf = (collected: CollectedPayloads): Nullable<string> => {
    for (const record of collected.records) {
        const reference = accountRecordSeedReference(record)
        if (reference) return reference
    }
    for (const payload of collected.addressPayloads.values()) {
        const position = hdPositionOf(payload)
        if (position) return position.seedReference
    }
    return null
}

/** An HD account needs a second read: its key material lives under the seed's
 *  first derived address, not its own, and without it the import has no
 *  parent to derive from. A record restores every chain of the account. */
export const importFromBackup = async ({
    state,
    address,
    deps,
}: {
    state: SyncState
    address: string
    deps: ReviewActionDeps
}): Promise<{ state: SyncState; summary: ImportSummary }> => {
    const liveKeys = liveKeysFor(state, address)
    // A legacy item the record covers is the same account; it is cleared with
    // the record but never read.
    const hasRecord = liveKeys.some(isAccountRecordKey)
    const readKeys = hasRecord
        ? liveKeys.filter(key => !isAccountItemKey(key))
        : liveKeys
    if (readKeys.length === 0) {
        return {
            state,
            summary: {
                imported: 0,
                skippedDuplicate: 0,
                failed: [{ address, reason: 'Not present in the backup' }],
            },
        }
    }

    const fetched = await deps.readItems(deps.backupId, deps.deviceId, readKeys)
    const collected: CollectedPayloads = {
        records: [],
        addressPayloads: new Map(),
        secretsPayloads: new Map(),
    }
    collect(fetched, deps, collected)
    // Importing it would bring nothing back and clear the row; it stays held
    // for the version that can read it.
    if (collected.records.some(record => !isAccountRecordReadable(record))) {
        return {
            state,
            summary: {
                imported: 0,
                skippedDuplicate: 0,
                failed: [{ address, reason: 'Needs a newer version of Pera' }],
            },
        }
    }

    const seedReference = seedReferenceOf(collected)
    if (seedReference) {
        // Hashed, not matched: the seed is filed under an account this device
        // may not hold, so nothing caches that address.
        const seedKey = secretsItemKey(deps.hashAddress(seedReference))
        if (
            !readKeys.includes(seedKey) &&
            state.items[seedKey]?.status === BackupItemStatus.ACTIVE
        ) {
            const seedFetched = await deps.readItems(
                deps.backupId,
                deps.deviceId,
                [seedKey],
            )
            collect(seedFetched, deps, collected)
            fetched.push(...seedFetched)
        }
    }

    const summary = await deps.importAccounts(buildPulledAccounts(collected))

    const byKey = new Map(fetched.map(item => [item.key, item]))
    const items = { ...state.items }
    for (const key of liveKeys) {
        const tracked = items[key]
        if (tracked) items[key] = clearReviewed(tracked, byKey.get(key))
    }
    return { state: { ...state, items }, summary }
}

const otherLiveAccountKeys = (
    state: SyncState,
    ownKeys: readonly BackupItemKey[],
): BackupItemKey[] =>
    Object.entries(state.items)
        .filter(
            ([key, item]) =>
                !ownKeys.includes(key) &&
                isAccountKey(key) &&
                item.status === BackupItemStatus.ACTIVE,
        )
        .map(([key]) => key)

/** Each readable item's seed reference, null for an account with none.
 *  Anything unreadable is simply absent from the result, so callers must treat
 *  a missing key as "unknown", never as "not there". */
const readSeedReferences = async (
    keys: BackupItemKey[],
    deps: ReviewActionDeps,
): Promise<Map<BackupItemKey, Nullable<string>>> => {
    const out = new Map<BackupItemKey, Nullable<string>>()
    if (keys.length === 0) return out

    const fetched = await deps.readItems(deps.backupId, deps.deviceId, keys)
    for (const item of fetched) {
        try {
            const plaintext = decryptWithDeps(item, deps)
            if (!isAccountRecordKey(item.key)) {
                out.set(
                    item.key,
                    hdPositionOf(parseAddressPayload(plaintext))
                        ?.seedReference ?? null,
                )
                continue
            }
            const record = parseAccountRecordPayload(plaintext)
            // A newer client's record may derive from it in a shape this
            // build can't read, so it stays unknown.
            if (isAccountRecordReadable(record))
                out.set(item.key, accountRecordSeedReference(record))
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
 * the seed's first derived address. So the seed only goes once no other
 * account item in the backup still derives from it, and anything unreadable
 * counts as "still derives": never delete key material we cannot prove is
 * unreferenced. An offline read keeps it too; the caller's delete queues a
 * retry for the rest.
 */
const seedKeyToDelete = async (
    state: SyncState,
    ownKeys: readonly BackupItemKey[],
    seedReference: string,
    deps: ReviewActionDeps,
): Promise<Nullable<BackupItemKey>> => {
    // Hashed, not matched: the seed is filed under an account this device may
    // not hold, so nothing caches that address.
    const seedKey = secretsItemKey(deps.hashAddress(seedReference))
    if (!isLiveIn(state)(seedKey)) return null
    const others = otherLiveAccountKeys(state, ownKeys)
    let references: Map<BackupItemKey, Nullable<string>>
    try {
        references = await readSeedReferences(others, deps)
    } catch (error) {
        logger.warn('reviewActions: could not read address records', {
            error: toError(error).message,
        })
        return null
    }
    const stillDerives = others.some(
        key => !references.has(key) || references.get(key) === seedReference,
    )
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
                error: toError(error).message,
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
    const recordKey = recordKeyFor(state, address)
    const keys =
        recordKey && isLiveIn(state)(recordKey)
            ? await recordKeysToDelete(state, recordKey, address, deps)
            : await legacyKeysToDelete(state, address, deps)
    return { state: await deleteKeysFromBackup({ state, keys, deps }), keys }
}

/** The record goes with every legacy item of the account, or a restore would
 *  bring the account back from those. */
const recordKeysToDelete = async (
    state: SyncState,
    recordKey: BackupItemKey,
    address: string,
    deps: ReviewActionDeps,
): Promise<BackupItemKey[]> => {
    const own = liveKeysFor(state, address)
    const seedReference = recordSeedReference(state.items[recordKey])
    const seedKey = seedReference
        ? await seedKeyToDelete(
              state,
              own.filter(isAccountKey),
              seedReference,
              deps,
          )
        : null
    return [
        ...own.filter(key => !isSeedSecret(state, key)),
        ...(seedKey ? [seedKey] : []),
    ]
}

const legacyKeysToDelete = async (
    state: SyncState,
    address: string,
    deps: ReviewActionDeps,
): Promise<BackupItemKey[]> => {
    const addressKey = liveKeyUnder(state, address, BACKUP_ACCOUNTS_KEY_PREFIX)
    if (addressKey === null) return []

    let own: Map<BackupItemKey, Nullable<string>>
    try {
        own = await readSeedReferences([addressKey], deps)
    } catch (error) {
        // Offline: delete the address (which queues a retry) and leave every
        // secret alone rather than guess.
        logger.warn('reviewActions: could not read address records', {
            error: toError(error).message,
        })
        return [addressKey]
    }
    if (!own.has(addressKey)) return [addressKey]

    const seedReference = own.get(addressKey) ?? null
    const secretKey =
        seedReference === null
            ? liveKeyUnder(state, address, BACKUP_SECRETS_KEY_PREFIX)
            : await seedKeyToDelete(state, [addressKey], seedReference, deps)
    return secretKey === null ? [addressKey] : [addressKey, secretKey]
}

/** The record of contact `id`, and the legacy `contacts/` items it was
 *  derived from or holds an address of. A restore would bring the contact back
 *  from any of them. */
const contactKeysFor = (state: SyncState, id: string): BackupItemKey[] => {
    const entries = Object.entries(state.items)
    const addresses = new Set(
        entries
            .filter(
                ([key, item]) =>
                    isContactRecordKey(key) &&
                    trackedContactId(key, item) === id,
            )
            .flatMap(([, item]) => item.addresses ?? []),
    )
    return entries
        .filter(
            ([key, item]) =>
                trackedContactId(key, item) === id ||
                (isContactItemKey(key) &&
                    item.address != null &&
                    addresses.has(item.address)),
        )
        .map(([key]) => key)
}

export const deleteContactFromBackup = async ({
    state,
    id,
    deps,
}: {
    state: SyncState
    id: string
    deps: ReviewActionDeps
}): Promise<BackupDeleteResult> => {
    const keys = contactKeysFor(state, id).filter(isLiveIn(state))

    return { state: await deleteKeysFromBackup({ state, keys, deps }), keys }
}

/** Mirror of `markAccountForBackup`: dropping a dead record's tombstone rather
 *  than reviving it is what makes the re-upload correct, since the server
 *  deleted the key and it has to go back at version 0. A dead legacy item
 *  goes too, since reconcile holds back a record whose legacy items were all
 *  deleted. */
export const markContactForBackup = (
    state: SyncState,
    id: string,
): SyncState => {
    const items = { ...state.items }
    for (const key of contactKeysFor(state, id)) {
        const item = items[key] as SyncItemState
        if (item.status === BackupItemStatus.ACTIVE && item.knownVer > 0) {
            items[key] = { ...item, pendingDelete: false, pendingImport: false }
        } else {
            delete items[key]
        }
    }
    return { ...state, items }
}

/** Keeps the backup's copy of a contact the user is removing from this device.
 *  `name` is stamped here because this device may never have downloaded the
 *  item it pushed, and the review row has nothing else to render. */
export const keepContactInBackup = (
    state: SyncState,
    id: string,
    name: string,
): SyncState => {
    const items = { ...state.items }
    for (const key of contactKeysFor(state, id).filter(isLiveIn(state))) {
        items[key] = {
            ...(items[key] as SyncItemState),
            pendingImport: true,
            isDirty: false,
            pendingDelete: false,
            label: name,
        }
    }
    return { ...state, items }
}

const contactImportFailure = (
    state: SyncState,
    id: string,
    reason: string,
): { state: SyncState; summary: ContactImportSummary } => ({
    state,
    summary: { imported: 0, failed: [{ id, reason }] },
})

/** Re-reads the items rather than trusting the cached `label`, so `label` stays
 *  a pure display concern and imports have one code path. A record is the
 *  whole contact, so a legacy item is read only when no record is live. */
export const importContactFromBackup = async ({
    state,
    id,
    deps,
}: {
    state: SyncState
    id: string
    deps: ReviewActionDeps
}): Promise<{ state: SyncState; summary: ContactImportSummary }> => {
    const liveKeys = contactKeysFor(state, id).filter(isLiveIn(state))
    const hasRecord = liveKeys.some(isContactRecordKey)
    const readKeys = liveKeys.filter(
        key => !hasRecord || isContactRecordKey(key),
    )
    if (readKeys.length === 0)
        return contactImportFailure(state, id, 'Not present in the backup')

    const fetched = await deps.readItems(deps.backupId, deps.deviceId, readKeys)
    if (fetched.length === 0)
        return contactImportFailure(state, id, 'Not present in the backup')

    const records: ContactRecordPayload[] = []
    const legacy: ContactBackupPayload[] = []
    for (const item of fetched) {
        try {
            const plaintext = decryptWithDeps(item, deps)
            if (isContactRecordKey(item.key))
                records.push(parseContactRecordPayload(plaintext))
            else legacy.push(parseContactPayload(plaintext))
        } catch (error) {
            logger.warn('reviewActions: unreadable contact', { key: item.key })
            return contactImportFailure(state, id, toError(error).message)
        }
    }
    if (records.some(record => contactRecordEntries(record).length === 0))
        return contactImportFailure(state, id, 'Needs a newer version of Pera')

    const contacts = buildPulledContacts({ records, legacy })
    const summary = await deps.importContacts(contacts)
    const byKey = new Map(fetched.map(item => [item.key, item]))
    const items = { ...state.items }
    for (const key of liveKeys) {
        items[key] = {
            ...clearReviewed(items[key] as SyncItemState, byKey.get(key)),
            label: contacts[0]?.name ?? items[key]?.label,
        }
    }
    return { state: { ...state, items }, summary }
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
                        reason: toError(error).message,
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
