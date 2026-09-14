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
import type {
    BackupId,
    BackupItemKey,
    DeviceId,
    FetchedItem,
    SyncItemState,
} from '../models'
import { canonicalJson, contentHash } from './canonicalize'

export type CollectPayloadsDeps = {
    network: Network
    backupId: BackupId
    deviceId: DeviceId
    encryptionKey: Uint8Array
    decrypt: (
        payload: string,
        ctx: {
            encryptionKey: Uint8Array
            backupId: BackupId
            key: BackupItemKey
        },
    ) => string
}

export const decryptItem = (
    item: FetchedItem,
    deps: CollectPayloadsDeps,
): string | null => {
    try {
        return deps.decrypt(item.payload, {
            encryptionKey: deps.encryptionKey,
            backupId: deps.backupId,
            key: item.key,
        })
    } catch {
        logger.warn('collectPayloads: failed to decrypt', { key: item.key })
        return null
    }
}

const remoteUpdatedAt = (plaintext: string): number => {
    try {
        const v = (JSON.parse(plaintext) as { updatedAt?: unknown }).updatedAt
        return typeof v === 'number' ? v : 0
    } catch {
        return 0
    }
}

/** Last-write-wins: the local edit survives only when it is STRICTLY newer.
 *  A tie goes to the remote (spec §8) — hence `>`, not `>=`. */
export const isLocalNewer = (
    tracked: SyncItemState | undefined,
    plaintext: string,
): boolean =>
    tracked?.isDirty === true &&
    (tracked.localUpdatedAt ?? 0) > remoteUpdatedAt(plaintext)

/** Records that the remote version was seen without adopting its content, so
 *  the local edit still pushes at the right base version. */
export const keepLocalEdit = (
    tracked: SyncItemState,
    item: FetchedItem,
): SyncItemState => ({
    ...tracked,
    knownVer: item.ver,
    baseVer: item.ver,
    lastRemoteHash: item.hash,
})

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

/** Adopts the remote content as this device's own. */
export const adoptRemote = (
    tracked: SyncItemState,
    item: FetchedItem,
    plaintext: string,
): SyncItemState => ({
    ...tracked,
    knownVer: item.ver,
    baseVer: item.ver,
    isDirty: false,
    lastRemoteHash: item.hash,
    localContentHash: contentHashSansUpdatedAt(plaintext),
    localUpdatedAt: null,
})
