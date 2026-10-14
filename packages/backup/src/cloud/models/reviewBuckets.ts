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
    isContactKey,
    isContactRecordKey,
    isPasskeyItemKey,
} from './itemKeys'
import { isNewerAccountRecord } from './accountRecord'
import type { BackupItemKind } from './payloads'
import type { SyncItemState, SyncState } from './syncState'
import { BackupItemStatus, type BackupItemKey } from './types'

type ReviewBuckets<TAvailable> = {
    backedUp: Set<string>
    notBackedUp: string[]
    /** Addresses live in the backup that this device deliberately deleted;
     *  each awaits an Add or a delete-from-cloud. */
    availableFromBackup: TAvailable[]
}

export type BackupAccountReview = ReviewBuckets<{
    address: string
    type: BackupItemKind | null
    /** A record only a newer version of the app can restore. */
    needsUpdate: boolean
}>

export type BackupContactReview = ReviewBuckets<{
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

const deriveReview = <TAvailable>(
    syncState: SyncState | null,
    localAddresses: readonly string[],
    isOwnKey: (key: BackupItemKey) => boolean,
    toAvailable: (address: string, item: SyncItemState) => TAvailable,
): ReviewBuckets<TAvailable> => {
    const backedUp = new Set<string>()
    const held: [string, SyncItemState][] = []

    for (const [key, item] of Object.entries(syncState?.items ?? {})) {
        // Skipped rather than guessed: a wrong address puts a stranger's row
        // in a list the user acts on.
        const address = item.address
        if (!isOwnKey(key) || address == null || !isLiveInBackup(item)) continue

        if (item.pendingImport === true) held.push([address, item])
        else backedUp.add(address)
    }

    const local = new Set(localAddresses)
    return {
        // An address held both locally and in the backup is not awaiting
        // review, whatever the sync state still says.
        backedUp: new Set([...backedUp].filter(address => local.has(address))),
        notBackedUp: localAddresses.filter(address => !backedUp.has(address)),
        availableFromBackup: held
            .filter(([address]) => !local.has(address))
            .map(([address, item]) => toAvailable(address, item)),
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
            needsUpdate: isNewerAccountRecord(item.record),
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

/** `name` comes from the cached label rather than the payload: a contact only
 *  the backup holds would otherwise render as a bare address, and the name is
 *  the whole record. */
export const deriveBackupContactReview = (
    syncState: SyncState | null,
    localContacts: readonly (readonly string[])[],
): BackupContactReview =>
    deriveRecordReview(
        syncState,
        localContacts,
        isContactKey,
        isContactRecordKey,
        item => ({ address: item.address as string, name: item.label ?? '' }),
    )

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
        isPasskeyItemKey,
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
    address: string,
): boolean => isAddressLiveUnder(syncState, address, isContactKey)

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
