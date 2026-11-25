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

import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    isAccountKey,
    isSecretsItemKey,
    isAccountRecordKey,
    isContactRecordKey,
    isPasskeyItemKey,
} from './itemKeys'
import {
    accountRecordEntries,
    accountRecordSeedReference,
    cachedRecordOverview,
    isNewerAccountRecord,
    type CachedRecordChain,
} from './accountRecord'
import { trackedContactId } from './contactRecord'
import {
    accountRecordPayloadSchema,
    BackupAccountType,
    type BackupItemKind,
} from './payloads'
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
    type: Nullable<BackupItemKind>
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
    syncState: Nullable<SyncState>,
    localIds: readonly string[],
    idOf: (key: BackupItemKey, item: SyncItemState) => Nullable<string>,
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

type TrackedItems = readonly [BackupItemKey, SyncItemState][]

const liveSecretAddressesOf = (items: TrackedItems): ReadonlySet<string> =>
    new Set(
        items.flatMap(([key, item]) =>
            isSecretsItemKey(key) &&
            isLiveInBackup(item) &&
            item.address != null
                ? [item.address]
                : [],
        ),
    )

const isSecretFreeType = (type: SyncItemState['accountType']): boolean =>
    type === BackupAccountType.watch ||
    type === BackupAccountType.hardware ||
    type === BackupAccountType.multisig

const accountRecordCoverage = (
    item: SyncItemState,
    liveSecretAddresses: ReadonlySet<string>,
): 'with-secret' | 'secret-free' | 'newer' | 'incomplete' => {
    // This build can't read a newer record nor write over it, so it trusts the
    // newer client that wrote it; restoring from it still needs that client.
    if (isNewerAccountRecord(item.record)) return 'newer'
    const parsed = accountRecordPayloadSchema.safeParse(item.record)
    if (!parsed.success) return 'incomplete'
    const entries = accountRecordEntries(parsed.data, () => true)
    if (entries.length === 0 || entries.length !== parsed.data.chains.length) {
        return 'incomplete'
    }
    if (entries.every(({ payload }) => isSecretFreeType(payload.type))) {
        return 'secret-free'
    }

    // An HD child's secret is filed under its seed's first derived address.
    const seedReference = accountRecordSeedReference(parsed.data)
    const owners =
        seedReference === null ? addressesOfItem(item) : [seedReference]
    return owners.some(address => liveSecretAddresses.has(address))
        ? 'with-secret'
        : 'incomplete'
}

const visibleAccountItems = (items: TrackedItems): TrackedItems => {
    const live = items.filter(
        ([key, item]) =>
            isAccountKey(key) && item.address != null && isLiveInBackup(item),
    )
    const recordAddresses = new Set(
        live
            .filter(([key]) => isAccountRecordKey(key))
            .flatMap(([, item]) => addressesOfItem(item)),
    )
    // A live record supersedes its legacy address items.
    return live.filter(
        ([key, item]) =>
            isAccountRecordKey(key) ||
            !recordAddresses.has(item.address as string),
    )
}

/** A legacy item doesn't cache an HD child's seed reference, so only the
 *  child's record can cover it. */
const isAccountItemBackedUp = (
    key: BackupItemKey,
    item: SyncItemState,
    liveSecretAddresses: ReadonlySet<string>,
): boolean =>
    item.pendingImport !== true &&
    (isAccountRecordKey(key)
        ? accountRecordCoverage(item, liveSecretAddresses) !== 'incomplete'
        : isSecretFreeType(item.accountType) ||
          liveSecretAddresses.has(item.address as string))

/** The buckets name a local account by its primary address. */
export const deriveBackupAccountReview = (
    syncState: Nullable<SyncState>,
    localAccounts: readonly (readonly string[])[],
): BackupAccountReview => {
    const items = Object.entries(syncState?.items ?? {})
    const shown = visibleAccountItems(items)
    const liveSecretAddresses = liveSecretAddressesOf(items)
    const covered = new Set(
        shown
            .filter(([key, item]) =>
                isAccountItemBackedUp(key, item, liveSecretAddresses),
            )
            .flatMap(([, item]) => addressesOfItem(item)),
    )
    const local = new Set(localAccounts.flat())
    const primaries = localAccounts.flatMap(([primary]) =>
        primary === undefined ? [] : [primary],
    )
    return {
        backedUp: new Set(primaries.filter(address => covered.has(address))),
        notBackedUp: primaries.filter(address => !covered.has(address)),
        availableFromBackup: shown
            .filter(
                ([, item]) =>
                    item.pendingImport === true &&
                    !addressesOfItem(item).some(address => local.has(address)),
            )
            .map(([, item]) => ({
                address: item.address as string,
                type: item.accountType ?? null,
                ...cachedRecordOverview(item.record),
            })),
    }
}

/** Accounts the backup holds that only a newer version of the app can
 *  restore. This device keeps them as they are and never writes over them. */
export const countNewerAccountRecords = (
    syncState: Nullable<SyncState>,
): number =>
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
    syncState: Nullable<SyncState>,
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
    syncState: Nullable<SyncState>,
    localCredentialIds: readonly string[],
): BackupPasskeyReview =>
    deriveReview(
        syncState,
        localCredentialIds,
        (key, item) => (isPasskeyItemKey(key) ? (item.address ?? null) : null),
        (credentialId, item) => ({ credentialId, label: item.label ?? '' }),
    )

const isAddressLiveUnder = (
    syncState: Nullable<SyncState>,
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
    syncState: Nullable<SyncState>,
    address: string,
): boolean => {
    const items = Object.entries(syncState?.items ?? {})
    const liveSecretAddresses = liveSecretAddressesOf(items)
    return visibleAccountItems(items).some(
        ([key, item]) =>
            addressesOfItem(item).includes(address) &&
            isAccountItemBackedUp(key, item, liveSecretAddresses),
    )
}

/** Whether the backup holds any of the address's items, restorable or not, so
 *  removal still offers to delete a record whose secret is gone. */
export const isAddressInBackup = (
    syncState: Nullable<SyncState>,
    address: string,
): boolean =>
    isAddressLiveUnder(
        syncState,
        address,
        key => isAccountKey(key) || isSecretsItemKey(key),
    )

/**
 * Whether the latest sync succeeded and the backup holds a live record naming
 * every address in `addresses`, plus the live secret that record restores
 * from. A record with no secret to restore from reads false.
 * Fails closed: an empty list, a missing or unreadable record, or a secret
 * with no cached address all read false.
 */
export const isAccountRestorableFromLatestSync = (
    syncState: Nullable<SyncState>,
    addresses: readonly string[],
): boolean => {
    if (syncState?.lastSyncResult !== 'SUCCESS' || addresses.length === 0) {
        return false
    }

    const items = Object.entries(syncState.items)
    const liveSecretAddresses = liveSecretAddressesOf(items)
    return items.some(
        ([key, item]) =>
            isAccountRecordKey(key) &&
            isLiveInBackup(item) &&
            item.pendingImport !== true &&
            addresses.every(address =>
                addressesOfItem(item).includes(address),
            ) &&
            accountRecordCoverage(item, liveSecretAddresses) === 'with-secret',
    )
}

export const isContactBackedUp = (
    syncState: Nullable<SyncState>,
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
    syncState: Nullable<SyncState>,
    credentialId: string,
): boolean => isAddressLiveUnder(syncState, credentialId, isPasskeyItemKey)

export const areKeysDeletedFromBackup = (
    syncState: Nullable<SyncState>,
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
