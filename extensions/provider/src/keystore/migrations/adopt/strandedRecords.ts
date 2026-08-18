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
    MasterKeyNotFoundError,
    MATERIAL_PREFIX,
    METADATA_PREFIX,
    decode,
    openData,
    serializeKey,
    type KeychainStorage,
} from '@algorandfoundation/react-native-keystore'
import { safeErrorMessage, safeWarn } from '../safeLog'
import { wipeSecrets, type Canary13Record } from '../canary13'
import {
    createJournal,
    holdsSameMaterial,
    sealAndVerify,
    wipeBytes,
} from '../sealing'
import { classifyRecord, isFlatCandidate } from './classify'

export type AdoptionDeps = {
    storage: KeychainStorage
    subtle: SubtleCrypto
    masterKeyForRead: () => Promise<Uint8Array>
}

export type AdoptionResult = {
    adopted: string[]
    reconstructed: string[]
    quarantined: { id: string; legacyId: string }[]
    restored: string[]
    leftFlat: string[]
    failed: { id: string; reason: string }[]
}

export const emptyAdoptionResult = (): AdoptionResult => ({
    adopted: [],
    reconstructed: [],
    quarantined: [],
    restored: [],
    leftFlat: [],
    failed: [],
})

/**
 * Cheap enough to run on every launch: no crypto, no master-key read.
 *
 * `expectedFlat` is the durable note of ids a previous pass decided belong at
 * their bare id forever — passkey credentials, and payloads this build cannot
 * decode. Without it every device holding a passkey would report work on every
 * launch and pay for a full decode pass that can never make progress.
 */
export const hasStrandedWork = (
    storage: KeychainStorage,
    expectedFlat: ReadonlySet<string> = new Set(),
): boolean =>
    storage
        .getAllKeys()
        .some(key => isFlatCandidate(key) && !expectedFlat.has(key))

const metadataOf = (record: Canary13Record, id: string): string => {
    const { privateKey: _privateKey, seed: _seed, ...rest } = record
    return serializeKey({ ...rest, id: record.id ?? id })
}

export const adoptStrandedRecords = async (
    deps: AdoptionDeps,
): Promise<AdoptionResult> => {
    const { storage } = deps
    const result = emptyAdoptionResult()

    const candidates = storage.getAllKeys().filter(isFlatCandidate)
    if (candidates.length === 0) return result

    let masterKey: Uint8Array
    try {
        masterKey = await deps.masterKeyForRead()
    } catch (error) {
        // A fresh install has no master key and nothing to migrate; anything
        // else is transient, and the boot-time guard retries next launch.
        if (!(error instanceof MasterKeyNotFoundError)) {
            result.failed.push({
                id: '*',
                reason: safeErrorMessage(error),
            })
        }
        return result
    }

    for (const id of candidates) {
        const sealed = storage.getString(id)
        if (sealed === undefined) continue

        let record: Canary13Record
        try {
            record = decode(
                await openData(deps.subtle, masterKey, sealed),
            ) as Canary13Record
        } catch {
            // Another process's record, or the iOS provider's unpadded payload.
            result.leftFlat.push(id)
            continue
        }

        const kind = classifyRecord(record)
        if (kind !== 'material') {
            result.leftFlat.push(id)
            wipeSecrets(record)
            continue
        }

        const own = (record.privateKey ?? record.seed) as Uint8Array
        const journal = createJournal(storage)

        try {
            const hasMeta =
                storage.getString(METADATA_PREFIX + id) !== undefined
            const hasMaterial =
                storage.getString(MATERIAL_PREFIX + id) !== undefined
            const sameMaterial =
                hasMaterial &&
                (await holdsSameMaterial(
                    deps,
                    masterKey,
                    MATERIAL_PREFIX + id,
                    own,
                ))

            if (hasMaterial && !sameMaterial) {
                // A different secret already owns this id — the D4 case, where
                // a replacement root was minted while this one was invisible.
                // Both are real keys; keep both.
                const legacyId = `${id}-legacy`
                await sealAndVerify(
                    deps,
                    masterKey,
                    MATERIAL_PREFIX + legacyId,
                    own,
                )
                journal.set(
                    METADATA_PREFIX + legacyId,
                    metadataOf(record, legacyId),
                )
                result.quarantined.push({ id, legacyId })
                continue
            }

            if (hasMeta && sameMaterial) {
                storage.remove(id)
                continue
            }

            // Nothing owns the id, or an interrupted run left half a pair.
            journal.track(MATERIAL_PREFIX + id)
            if (!hasMaterial) {
                await sealAndVerify(deps, masterKey, MATERIAL_PREFIX + id, own)
            }
            if (!hasMeta) {
                journal.set(METADATA_PREFIX + id, metadataOf(record, id))
            }
            storage.remove(id)
            result.adopted.push(id)
        } catch (error) {
            journal.rollback()
            result.failed.push({ id, reason: safeErrorMessage(error) })
            safeWarn(
                `[provider] adopt-stranded: ${id} left flat: ${safeErrorMessage(error)}`,
            )
        } finally {
            wipeBytes(own)
            wipeSecrets(record)
        }
    }

    return result
}
