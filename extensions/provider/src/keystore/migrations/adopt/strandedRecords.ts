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

/**
 * Throws unless `key` currently holds exactly `expected`.
 *
 * A silent MMKV `set` failure is otherwise invisible until the bare copy —
 * the only other place the same data lives — has already been removed.
 * Comparing against the expected bytes (not just confirming the stored value
 * parses) also catches a truncated-but-still-valid-JSON write, which a bare
 * parse check would wave through.
 */
const assertMetadataWritten = (
    storage: KeychainStorage,
    key: string,
    expected: string,
): void => {
    const written = storage.getString(key)
    if (written !== expected) {
        throw new Error(`metadata at ${key} did not read back as written`)
    }
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

                // `-legacy` might already be occupied by a THIRD real key — a
                // prior quarantine, followed by yet another bare record
                // landing on the live id. `sealAndVerify` would overwrite it
                // unconditionally on the success path, where the journal
                // never rolls back, destroying a key nothing else holds. A
                // second collision on one id is rare enough that a human
                // should look at it rather than have this migration invent a
                // `-legacy-2` chain.
                const legacyState = await materialState(
                    deps,
                    masterKey,
                    MATERIAL_PREFIX + legacyId,
                    own,
                )
                if (legacyState !== 'absent' && legacyState !== 'same') {
                    result.failed.push({
                        id,
                        reason: `${MATERIAL_PREFIX}${legacyId} already holds unrelated material`,
                    })
                    continue
                }

                journal.track(MATERIAL_PREFIX + legacyId)
                await sealAndVerify(
                    deps,
                    masterKey,
                    MATERIAL_PREFIX + legacyId,
                    own,
                )
                const legacyMeta = metadataOf(record, legacyId)
                journal.set(METADATA_PREFIX + legacyId, legacyMeta)
                // Same hazard Minor 7 fixed for the adoption path: a silent
                // write failure here must be caught before the bare copy —
                // the only other place `type`/`format`/`metadata` live — is
                // gone.
                assertMetadataWritten(
                    storage,
                    METADATA_PREFIX + legacyId,
                    legacyMeta,
                )
                // The legacy pair is verified and durable; the bare copy is
                // now redundant. Removing it is what makes this converge —
                // left in place, the next launch would re-quarantine into the
                // same `-legacy` id, re-sealing an already-occupied `m/` key.
                storage.remove(id)
                result.quarantined.push({ id, legacyId })
                continue
            }

            if ((state === 'same' || state === 'absent') && hasMeta) {
                // Whether `m/<id>` is already present (a stale bare copy
                // trailing a prior adoption) or still missing (nothing to
                // compare the material against), the only proof `k/<id>`
                // describes THIS record is the metadata itself. `hasMeta` is
                // only an existence check — a garbage, truncated or foreign
                // `k/<id>` still satisfies it, and deleting the bare record
                // on that basis would drop the only other copy of
                // `type`/`format`/`metadata.bip44Path`.
                const existing = storage.getString(METADATA_PREFIX + id)
                if (existing !== metadataOf(record, id)) {
                    result.failed.push({
                        id,
                        reason: `${METADATA_PREFIX}${id} exists but describes a different record`,
                    })
                    continue
                }

                if (state === 'same') {
                    storage.remove(id)
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
                const meta = metadataOf(record, id)
                journal.set(METADATA_PREFIX + id, meta)
                assertMetadataWritten(storage, METADATA_PREFIX + id, meta)
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
