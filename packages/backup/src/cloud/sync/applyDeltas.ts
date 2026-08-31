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
import { parseAddressPayload, parseSecretsPayload } from '../api/payloadParsers'
import {
    BackupItemStatus,
    DeltaOperation,
    type BackupId,
    type BackupItemKey,
    type DeltaEntry,
    type DeviceId,
    type FetchedItem,
    type SyncItemState,
    type SyncState,
} from '../models'
import { buildPulledAccounts } from '../restore'
import { canonicalJson, contentHash } from './canonicalize'
import type { SyncImportFn } from './types'

const ACCOUNTS_PREFIX = 'accounts/'
const SECRETS_PREFIX = 'secrets/'

export type ApplyDeltasDeps = {
    network: Network
    backupId: BackupId
    deviceId: DeviceId
    encryptionKey: Uint8Array
    importAccounts: SyncImportFn
    readItems: (
        network: Network,
        backupId: BackupId,
        deviceId: DeviceId,
        keys: BackupItemKey[],
    ) => Promise<FetchedItem[]>
    decrypt: (
        payload: string,
        ctx: {
            encryptionKey: Uint8Array
            backupId: BackupId
            key: BackupItemKey
        },
    ) => string
}

const addressOf = (key: BackupItemKey): string | null =>
    key.startsWith(ACCOUNTS_PREFIX)
        ? key.slice(ACCOUNTS_PREFIX.length)
        : key.startsWith(SECRETS_PREFIX)
          ? key.slice(SECRETS_PREFIX.length)
          : null

const remoteUpdatedAt = (plaintext: string): number => {
    try {
        const v = (JSON.parse(plaintext) as { updatedAt?: unknown }).updatedAt
        return typeof v === 'number' ? v : 0
    } catch {
        return 0
    }
}

const contentHashSansUpdatedAt = (plaintext: string): string => {
    try {
        const { updatedAt: _drop, ...rest } = JSON.parse(plaintext) as Record<
            string,
            unknown
        >
        return contentHash(canonicalJson(rest))
    } catch {
        return contentHash(plaintext)
    }
}

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
                lastRemoteHash: d.hash,
            }
            continue
        }
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
        }
        if (d.status !== BackupItemStatus.ACTIVE) continue
        if (
            !(
                d.key.startsWith(ACCOUNTS_PREFIX) ||
                d.key.startsWith(SECRETS_PREFIX)
            )
        )
            continue
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

    const addressPayloads = new Map<
        string,
        ReturnType<typeof parseAddressPayload>
    >()
    const secretsPayloads = new Map<
        string,
        ReturnType<typeof parseSecretsPayload>
    >()

    for (const item of fetched) {
        const address = addressOf(item.key)
        if (!address) continue
        let plaintext: string
        try {
            plaintext = deps.decrypt(item.payload, {
                encryptionKey: deps.encryptionKey,
                backupId: deps.backupId,
                key: item.key,
            })
        } catch {
            logger.warn('applyDeltas: failed to decrypt', { key: item.key })
            continue
        }

        const existing = items[item.key]
        const isAddress = item.key.startsWith(ACCOUNTS_PREFIX)
        // Last-write-wins: keep local only if the local edit is STRICTLY newer.
        // On a tie (equal timestamps) remote wins (spec §8) — hence `>`, not `>=`.
        if (
            isAddress &&
            existing?.isDirty &&
            (existing.localUpdatedAt ?? 0) > remoteUpdatedAt(plaintext)
        ) {
            items[item.key] = {
                ...existing,
                knownVer: item.ver,
                baseVer: item.ver,
                lastRemoteHash: item.hash,
            }
            continue
        }

        try {
            if (isAddress)
                addressPayloads.set(address, parseAddressPayload(plaintext))
            else secretsPayloads.set(address, parseSecretsPayload(plaintext))
        } catch {
            logger.warn('applyDeltas: failed to parse', { key: item.key })
            continue
        }
        items[item.key] = {
            ...(items[item.key] as SyncItemState),
            knownVer: item.ver,
            baseVer: item.ver,
            isDirty: false,
            lastRemoteHash: item.hash,
            localContentHash: contentHashSansUpdatedAt(plaintext),
            localUpdatedAt: null,
        }
    }

    // Join address+secrets and surface orphan hdSeed secrets as standalone
    // entries — shared with the full-restore path so the incremental/realtime
    // sync path restores HD seeds whose first account was removed.
    const toImport = buildPulledAccounts(addressPayloads, secretsPayloads)
    if (toImport.length > 0) await deps.importAccounts(toImport)

    return { ...state, items, lastSyncedSeq }
}
