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

import { base64 } from '@scure/base'
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
import { hasNestedMaterial, wipeSecrets, type Canary13Record } from '../canary13'
import { createJournal, sealAndVerify, wipeBytes, type SealingDeps } from '../sealing'
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
 * launch and pay for a full decode pass that can never make progress. A record
 * left in `failed` (unreadable material, a foreign `k/`, or a shape `0002`
 * owns) is deliberately NOT in that set: it is worth retrying, so it keeps
 * reporting work until something resolves it.
 */
export const hasStrandedWork = (
    storage: KeychainStorage,
    expectedFlat: ReadonlySet<string> = new Set(),
): boolean =>
    storage
        .getAllKeys()
        .some(key => isFlatCandidate(key) && !expectedFlat.has(key))

/** `id` is always the storage key the record is being written under — never `record.id`, which for a quarantined record is the id it is fleeing. */
const metadataOf = (record: Canary13Record, id: string): string => {
    const { privateKey: _privateKey, seed: _seed, ...rest } = record
    return serializeKey({ ...rest, id })
}

type MaterialState = 'absent' | 'same' | 'different' | 'unreadable'

/**
 * `holdsSameMaterial` (sealing.ts) collapses "different bytes" and "cannot be
 * opened" into one `false` — fine for a plain existence check, wrong here: a
 * corrupt or foreign-master-key `m/<id>` must never be treated as a same-key
 * collision, or the only readable copy of a good key gets quarantined out
 * from under it while the broken blob keeps the live id.
 */
const materialState = async (
    { storage, subtle }: SealingDeps,
    masterKey: Uint8Array,
    key: string,
    bytes: Uint8Array,
): Promise<MaterialState> => {
    const sealed = storage.getString(key)
    if (sealed === undefined) return 'absent'

    let opened: string
    try {
        opened = await openData(subtle, masterKey, sealed)
    } catch {
        return 'unreadable'
    }
    return opened === base64.encode(bytes) ? 'same' : 'different'
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

        // Own material AND something nested (an HD root's derived child never
        // has its own; this is the shape only a re-imported/legacy root
        // combines) — revision `0002` owns lifting nested material, and
        // `metadataOf` only strips the top level. Stripping it here too would
        // create a second place for the same plaintext leak to reappear.
        if (hasNestedMaterial(record)) {
            result.failed.push({
                id,
                reason: 'carries nested material; owned by preflight 0002',
            })
            wipeSecrets(record)
            continue
        }

        const own = (record.privateKey ?? record.seed) as Uint8Array
        const journal = createJournal(storage)

        try {
            const hasMeta =
                storage.getString(METADATA_PREFIX + id) !== undefined
            const state = await materialState(
                deps,
                masterKey,
                MATERIAL_PREFIX + id,
                own,
            )

            if (state === 'unreadable') {
                // Could be a corrupt write or a master key that has since
                // rotated. Either way this is not evidence of a collision:
                // touch nothing, and let a later launch — after the key is
                // reachable again — decide.
                result.failed.push({
                    id,
                    reason: `${MATERIAL_PREFIX}${id} exists but could not be opened`,
                })
                continue
            }

            if (state === 'different') {
                // A different secret already owns this id — the D4 case, where
                // a replacement root was minted while this one was invisible.
                // Both are real keys; keep both.
                const legacyId = `${id}-legacy`
                journal.track(MATERIAL_PREFIX + legacyId)
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
                // The legacy pair is verified and durable; the bare copy is
                // now redundant. Removing it is what makes this converge —
                // left in place, the next launch would re-quarantine into the
                // same `-legacy` id, re-sealing an already-occupied `m/` key.
                storage.remove(id)
                result.quarantined.push({ id, legacyId })
                continue
            }

            if (state === 'same' && hasMeta) {
                storage.remove(id)
                continue
            }

            if (state === 'absent' && hasMeta) {
                // `m/<id>` is missing but `k/<id>` already exists: nothing to
                // compare the material against, so the only proof this is the
                // same record is the metadata itself. A mismatch means some
                // other record owns this id — merging would attach this
                // record's material to a description that isn't its own.
                const existing = storage.getString(METADATA_PREFIX + id)
                if (existing !== metadataOf(record, id)) {
                    result.failed.push({
                        id,
                        reason: `${METADATA_PREFIX}${id} exists but describes a different record`,
                    })
                    continue
                }
            }

            // Nothing owns the id, or an interrupted run left half a pair
            // whose description matches. Complete it.
            journal.track(MATERIAL_PREFIX + id)
            if (state === 'absent') {
                await sealAndVerify(deps, masterKey, MATERIAL_PREFIX + id, own)
            }
            if (!hasMeta) {
                journal.set(METADATA_PREFIX + id, metadataOf(record, id))

                // A silent write failure here would be unrecoverable once the
                // bare copy is gone: read the metadata back and confirm it is
                // there and parses before removing the only other copy of it.
                const writtenMeta = storage.getString(METADATA_PREFIX + id)
                if (writtenMeta === undefined) {
                    throw new Error(
                        `metadata at ${METADATA_PREFIX}${id} did not read back`,
                    )
                }
                try {
                    JSON.parse(writtenMeta)
                } catch {
                    throw new Error(
                        `metadata at ${METADATA_PREFIX}${id} did not deserialize`,
                    )
                }
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
