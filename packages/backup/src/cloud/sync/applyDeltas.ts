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
import {
    BACKUP_ACCOUNTS_KEY_PREFIX,
    BACKUP_SECRETS_KEY_PREFIX,
    BackupItemStatus,
    DeltaOperation,
    isContactItemKey,
    isPasskeyItemKey,
    type BackupId,
    type BackupItemKey,
    type DeltaEntry,
    type DeviceId,
    type FetchedItem,
    type SyncItemState,
    type SyncState,
} from '../models'
import { collectAccountPayloads } from './collectAccountPayloads'
import { collectContactPayloads } from './collectContactPayloads'
import { collectPasskeyPayloads } from './collectPasskeyPayloads'
import type { CollectPayloadsDeps } from './collectPayloads'
import type { ContactImportFn, PasskeyImportFn, SyncImportFn } from './types'

export type ApplyDeltasDeps = CollectPayloadsDeps & {
    importAccounts: SyncImportFn
    importContacts: ContactImportFn
    importPasskeys: PasskeyImportFn
    readItems: (
        network: Network,
        backupId: BackupId,
        deviceId: DeviceId,
        keys: BackupItemKey[],
    ) => Promise<FetchedItem[]>
}

const isSecretsKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_SECRETS_KEY_PREFIX)

const isAccountFamilyKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX) || isSecretsKey(key)

export const applyDeltas = async ({
    state,
    deltas,
    deps,
}: {
    state: SyncState
    deltas: DeltaEntry[]
    deps: ApplyDeltasDeps
}): Promise<SyncState> => {
    const items: Record<string, SyncItemState> = { ...state.items }
    let lastSyncedSeq = state.lastSyncedSeq

    const ordered = [...deltas].sort((a, b) => a.seq - b.seq)
    const downloadKeys: BackupItemKey[] = []
    for (const d of ordered) {
        lastSyncedSeq = Math.max(lastSyncedSeq, d.seq)
        const existing = items[d.key]
        if (d.op === DeltaOperation.DELETE) {
            items[d.key] = {
                ...(existing ?? {
                    type: d.type,
                    knownVer: d.ver,
                    baseVer: d.ver,
                    localContentHash: null,
                    localUpdatedAt: null,
                }),
                type: d.type,
                knownVer: d.ver,
                status: BackupItemStatus.IGNORED,
                isDirty: false,
                pendingDelete: false,
                pendingImport: false,
                lastRemoteHash: d.hash,
            }
            continue
        }
        const isKnownKey =
            isAccountFamilyKey(d.key) ||
            isContactItemKey(d.key) ||
            isPasskeyItemKey(d.key)
        // The user deleted this here and another device has since backed it up
        // again. Re-importing would undo that deletion behind their back, so
        // hold it for review instead.
        const pendingImport =
            isKnownKey &&
            d.status === BackupItemStatus.ACTIVE &&
            (existing?.pendingImport === true ||
                existing?.status === BackupItemStatus.IGNORED)

        items[d.key] = {
            ...(existing ?? {
                type: d.type,
                baseVer: d.ver,
                isDirty: false,
                localContentHash: null,
                localUpdatedAt: null,
            }),
            type: d.type,
            knownVer: d.ver,
            status: d.status,
            lastRemoteHash: d.hash,
            isDirty: existing?.isDirty ?? false,
            baseVer: existing?.baseVer ?? d.ver,
            localContentHash: existing?.localContentHash ?? null,
            localUpdatedAt: existing?.localUpdatedAt ?? null,
            pendingImport,
        }
        if (d.status !== BackupItemStatus.ACTIVE) continue
        if (!isKnownKey) continue
        // A held item's own record is still downloaded, because its cached
        // address is what puts the row on the review screen. Only the secret
        // stays untouched until the user adds the account back.
        if (pendingImport && isSecretsKey(d.key)) continue
        const hashChanged =
            !existing ||
            existing.lastRemoteHash !== d.hash ||
            existing.localContentHash == null
        if (hashChanged) downloadKeys.push(d.key)
    }

    if (downloadKeys.length === 0) return { ...state, items, lastSyncedSeq }

    const fetched = await deps.readItems(
        deps.network,
        deps.backupId,
        deps.deviceId,
        downloadKeys,
    )

    const accounts = collectAccountPayloads({
        fetched: fetched.filter(item => isAccountFamilyKey(item.key)),
        items,
        deps,
    })
    const contacts = collectContactPayloads({
        fetched: fetched.filter(item => isContactItemKey(item.key)),
        items,
        deps,
    })
    const passkeys = collectPasskeyPayloads({
        fetched: fetched.filter(item => isPasskeyItemKey(item.key)),
        items,
        deps,
    })

    if (accounts.length > 0) await deps.importAccounts(accounts)
    if (contacts.length > 0) await deps.importContacts(contacts)
    if (passkeys.length > 0) await deps.importPasskeys(passkeys)

    return { ...state, items, lastSyncedSeq }
}
