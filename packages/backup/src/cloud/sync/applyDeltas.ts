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
import type { CollectPayloadsDeps } from './collectPayloads'
import type { ContactImportFn, SyncImportFn } from './types'

export type ApplyDeltasDeps = CollectPayloadsDeps & {
    importAccounts: SyncImportFn
    importContacts: ContactImportFn
    readItems: (
        network: Network,
        backupId: BackupId,
        deviceId: DeviceId,
        keys: BackupItemKey[],
    ) => Promise<FetchedItem[]>
}

const isAccountFamilyKey = (key: BackupItemKey): boolean =>
    key.startsWith(BACKUP_ACCOUNTS_KEY_PREFIX) ||
    key.startsWith(BACKUP_SECRETS_KEY_PREFIX)

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
        const isContactKey = isContactItemKey(d.key)
        const isKnownKey = isAccountFamilyKey(d.key) || isContactKey
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
        // A held account is never downloaded; a held contact is, because the
        // cached name is the whole record and the review row has to show it.
        if (pendingImport && !isContactKey) continue
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

    if (accounts.length > 0) await deps.importAccounts(accounts)
    if (contacts.length > 0) await deps.importContacts(contacts)

    return { ...state, items, lastSyncedSeq }
}
