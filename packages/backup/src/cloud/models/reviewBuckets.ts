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
    isAccountKey,
    isAccountRecordKey,
    isContactRecordKey,
    isPasskeyItemKey,
} from './itemKeys'
import {
    cachedRecordOverview,
    isNewerAccountRecord,
    type CachedRecordChain,
} from './accountRecord'
import { trackedContactId } from './contactRecord'
import type { BackupItemKind } from './payloads'
import type { SyncItemState, SyncState } from './syncState'
import { BackupItemStatus, type BackupItemKey } from './types'

/** Accounts are named by address, contacts by id, passkeys by credential id. */
type ReviewBuckets<TAvailable> = {
    backedUp: Set<string>
    notBackedUp: string[]
    /** Items live in the backup that this device deliberately deleted; each
     *  awaits an Add or a delete-from-cloud. */
    availableFromBackup: TAvailable[]
}

export type BackupAccountReview = ReviewBuckets<{
    address: string
    type: BackupItemKind | null
    /** A record only a newer version of the app can restore. */
    needsUpdate: boolean
    /** Empty for an item written before records, which names no chain. */
    chains: CachedRecordChain[]
}>

export type BackupContactReview = ReviewBuckets<{
    id: string
    address: string
    name: string
}>

export type BackupPasskeyReview = ReviewBuckets<{
    credentialId: string
    label: string
}>

/** Whether the backup holds this item, from the device's point of view. The
 *  single definition — `knownVer` is the upload test, because reconcile marks a
 *  new local account ACTIVE before it has ever been sent, so status alone would
 *  show an account the server has never seen as backed up. */
export const isLiveInBackup = (item: SyncItemState): boolean =>
    item.status === BackupItemStatus.ACTIVE &&
    item.knownVer > 0 &&
    item.pendingDelete !== true

/** `idOf` names an item of this kind, and returns null for any other. */
const deriveReview = <TAvailable>(
    syncState: SyncState | null,
    localIds: readonly string[],
    idOf: (key: BackupItemKey, item: SyncItemState) => string | null,
    toAvailable: (id: string, item: SyncItemState) => TAvailable,
): ReviewBuckets<TAvailable> => {
    const backedUp = new Set<string>()
    const held: [string, SyncItemState][] = []

    for (const [key, item] of Object.entries(syncState?.items ?? {})) {
        // Skipped rather than guessed: a wrong id puts a stranger's row in a
        // list the user acts on.
        const id = idOf(key, item)
        if (id == null || !isLiveInBackup(item)) continue

        if (item.pendingImport === true) held.push([id, item])
        else backedUp.add(id)
    }

    const local = new Set(localIds)
    return {
        // An item held both locally and in the backup is not awaiting review,
        // whatever the sync state still says.
        backedUp: new Set([...backedUp].filter(id => local.has(id))),
        notBackedUp: localIds.filter(id => !backedUp.has(id)),
        availableFromBackup: held
            .filter(([id]) => !local.has(id))
            .map(([id, item]) => toAvailable(id, item)),
    }
}

/** Every address an item answers to: an account record's every chain. */
const addressesOfItem = (item: SyncItemState): string[] =>
    item.addresses ?? (item.address == null ? [] : [item.address])

/**
 * Reads records and legacy items of one kind. A legacy item a record covers is
 * that entity as written before records, so the record speaks for it.
 *
 * `localRecords` holds each entity's addresses, primary first; the buckets
 * name an entity by its primary, and a row from the backup by its record's.
 */
const deriveRecordReview = <TAvailable>(
    syncState: SyncState | null,
    localRecords: readonly (readonly string[])[],
    isKey: (key: BackupItemKey) => boolean,
    isRecordKey: (key: BackupItemKey) => boolean,
    toAvailable: (item: SyncItemState) => TAvailable,
): ReviewBuckets<TAvailable> => {
    const live = Object.entries(syncState?.items ?? {}).filter(
        ([key, item]) =>
            isKey(key) && item.address != null && isLiveInBackup(item),
    )
    const recordAddresses = new Set(
        live
            .filter(([key]) => isRecordKey(key))
            .flatMap(([, item]) => addressesOfItem(item)),
    )
    const shown = live
        .filter(
            ([key, item]) =>
                isRecordKey(key) ||
                !recordAddresses.has(item.address as string),
        )
        .map(([, item]) => item)

    const covered = new Set(
        shown
            .filter(item => item.pendingImport !== true)
            .flatMap(addressesOfItem),
    )
    const local = new Set(localRecords.flat())
    const primaries = localRecords.flatMap(([primary]) =>
        primary === undefined ? [] : [primary],
    )
    return {
        backedUp: new Set(primaries.filter(address => covered.has(address))),
        notBackedUp: primaries.filter(address => !covered.has(address)),
        availableFromBackup: shown
            .filter(
                item =>
                    item.pendingImport === true &&
                    !addressesOfItem(item).some(address => local.has(address)),
            )
            .map(toAvailable),
    }
}

/** Reads account records and legacy address items only: a secret-bearing
 *  account also stores key material under the same item type, so counting every
 *  ACCOUNT item would double it. */
export const deriveBackupAccountReview = (
    syncState: SyncState | null,
    localAccounts: readonly (readonly string[])[],
): BackupAccountReview =>
    deriveRecordReview(
        syncState,
        localAccounts,
        isAccountKey,
        isAccountRecordKey,
        item => ({
            address: item.address as string,
            type: item.accountType ?? null,
            ...cachedRecordOverview(item.record),
        }),
    )

/** Accounts the backup holds that only a newer version of the app can
 *  restore. This device keeps them as they are and never writes over them. */
export const countNewerAccountRecords = (syncState: SyncState | null): number =>
    Object.entries(syncState?.items ?? {}).filter(
        ([key, item]) =>
            isAccountRecordKey(key) &&
            isLiveInBackup(item) &&
            isNewerAccountRecord(item.record),
    ).length

/**
 * Contacts are named by id: two may share an address. A legacy item a live
 * record covers, by address or by id, is that contact as written before
 * records, so the record speaks for it. `name` comes from the cached label
 * rather than the payload: a contact only the backup holds would otherwise
 * render as a bare address, and the name is the whole record.
 */
export const deriveBackupContactReview = (
    syncState: SyncState | null,
    localContactIds: readonly string[],
): BackupContactReview => {
    const records = Object.entries(syncState?.items ?? {}).filter(
        ([key, item]) => isContactRecordKey(key) && isLiveInBackup(item),
    )
    const recordAddresses = new Set(
        records.flatMap(([, item]) => addressesOfItem(item)),
    )
    const recordIds = new Set(
        records.map(([key, item]) => trackedContactId(key, item)),
    )
    return deriveReview(
        syncState,
        localContactIds,
        (key, item) => {
            const id = trackedContactId(key, item)
            const isCoveredLegacy =
                !isContactRecordKey(key) &&
                (recordAddresses.has(item.address as string) ||
                    recordIds.has(id))
            return isCoveredLegacy ? null : id
        },
        (id, item) => ({
            id,
            address: item.address as string,
            name: item.label ?? '',
        }),
    )
}

/** `label` comes from the cached display name for the same reason a contact's
 *  does: a credential only the backup holds would otherwise render as a bare
 *  credential id. */
export const deriveBackupPasskeyReview = (
    syncState: SyncState | null,
    localCredentialIds: readonly string[],
): BackupPasskeyReview =>
    deriveReview(
        syncState,
        localCredentialIds,
        (key, item) => (isPasskeyItemKey(key) ? (item.address ?? null) : null),
        (credentialId, item) => ({ credentialId, label: item.label ?? '' }),
    )

const isAddressLiveUnder = (
    syncState: SyncState | null,
    address: string,
    isOwnKey: (key: BackupItemKey) => boolean,
): boolean =>
    Object.entries(syncState?.items ?? {}).some(
        ([key, item]) =>
            addressesOfItem(item).includes(address) &&
            isOwnKey(key) &&
            isLiveInBackup(item) &&
            item.pendingImport !== true,
    )

/** For callers that already hold the account: `deriveBackupAccountReview`
 *  intersects with the wallet's addresses, which such a caller satisfies by
 *  construction. */
export const isAddressBackedUp = (
    syncState: SyncState | null,
    address: string,
): boolean => isAddressLiveUnder(syncState, address, isAccountKey)

export const isContactBackedUp = (
    syncState: SyncState | null,
    id: string,
): boolean =>
    Object.entries(syncState?.items ?? {}).some(
        ([key, item]) =>
            trackedContactId(key, item) === id &&
            isLiveInBackup(item) &&
            item.pendingImport !== true,
    )

/** The credential id rides in `item.address`, the same local-only field an
 *  account's address uses: the key itself is a hash and cannot be read back. */
export const isPasskeyBackedUp = (
    syncState: SyncState | null,
    credentialId: string,
): boolean => isAddressLiveUnder(syncState, credentialId, isPasskeyItemKey)

export const areKeysDeletedFromBackup = (
    syncState: SyncState | null,
    keys: readonly BackupItemKey[],
): boolean =>
    keys.every(key => {
        const item = syncState?.items[key]
        return (
            item == null ||
            (item.status !== BackupItemStatus.ACTIVE &&
                item.pendingDelete !== true)
        )
    })
