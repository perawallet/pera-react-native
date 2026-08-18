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
import {
    hasNestedMaterial,
    wipeSecrets,
    type Canary13Record,
} from '../canary13'
import {
    createJournal,
    sealAndVerify,
    wipeBytes,
    type SealingDeps,
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

type AdoptNestedOnlyArgs = {
    deps: AdoptionDeps
    masterKey: Uint8Array
    id: string
    record: Canary13Record
    result: AdoptionResult
}

/**
 * An HD-derived child (canary.13's `deriveFromSeed` shape) carries no material
 * of its own — only a copy of its parent's private key, nested under
 * `metadata.rootKey`. That copy is redundant once the parent is adopted (the
 * live driver derives children from the parent on demand), but if the parent
 * never survived, it is the LAST copy of the wallet's root: reconstructing
 * `m/<rootId>` from it here is the difference between a recovered wallet and
 * an unrecoverable one.
 */
const adoptNestedOnly = async ({
    deps,
    masterKey,
    id,
    record,
    result,
}: AdoptNestedOnlyArgs): Promise<void> => {
    const { storage } = deps
    const journal = createJournal(storage)
    const nested = (record.metadata as { rootKey?: Canary13Record } | undefined)
        ?.rootKey

    try {
        const rootId = nested?.id
        const rootMaterial = nested?.privateKey
        let parentId = rootId

        // A nested carrier with no `id` of its own can't be attributed to any
        // `m/` bucket — leave the parent side untouched and fall through to
        // adopting the child's own metadata under whatever `parentKeyId` it
        // already carries.
        if (typeof rootId === 'string' && rootMaterial instanceof Uint8Array) {
            const parentKey = MATERIAL_PREFIX + rootId
            const parentState = await materialState(
                deps,
                masterKey,
                parentKey,
                rootMaterial,
            )

            if (parentState === 'unreadable') {
                // Same rule as the material branch: an unopenable m/<id> is
                // never evidence either way. Touch nothing.
                result.failed.push({
                    id,
                    reason: `${parentKey} exists but could not be opened`,
                })
                return
            }

            if (parentState !== 'same') {
                const legacyId = `${rootId}-legacy`
                const legacyKey = MATERIAL_PREFIX + legacyId
                const legacyState = await materialState(
                    deps,
                    masterKey,
                    legacyKey,
                    rootMaterial,
                )

                if (legacyState === 'unreadable') {
                    result.failed.push({
                        id,
                        reason: `${legacyKey} exists but could not be opened`,
                    })
                    return
                }

                if (legacyState === 'same') {
                    // The parent was quarantined by an earlier pass (D4); the
                    // nested copy matches the quarantined copy, so repoint
                    // this child at it rather than the impostor now holding
                    // the live id.
                    parentId = legacyId
                } else if (
                    parentState === 'absent' &&
                    legacyState === 'absent'
                ) {
                    // Neither the live id nor a quarantined copy holds this
                    // root: the nested copy is the last surviving copy.
                    // Reconstructing it is the only way this wallet's root
                    // key is not permanently lost.
                    const expectedRootMeta = metadataOf(
                        nested as Canary13Record,
                        rootId,
                    )
                    const existingRootMeta = storage.getString(
                        METADATA_PREFIX + rootId,
                    )
                    if (
                        existingRootMeta !== undefined &&
                        existingRootMeta !== expectedRootMeta
                    ) {
                        // A `k/<rootId>` already describes something else —
                        // reconstructing over it could point a live signer at
                        // the wrong key. Leave it for a human.
                        result.failed.push({
                            id,
                            reason: `${METADATA_PREFIX}${rootId} exists but describes a different record`,
                        })
                        return
                    }

                    journal.track(parentKey)
                    await sealAndVerify(
                        deps,
                        masterKey,
                        parentKey,
                        rootMaterial,
                    )
                    journal.set(METADATA_PREFIX + rootId, expectedRootMeta)
                    assertMetadataWritten(
                        storage,
                        METADATA_PREFIX + rootId,
                        expectedRootMeta,
                    )
                    result.reconstructed.push(rootId)
                } else {
                    // A different key already occupies both the live and
                    // legacy slots (or the legacy slot holds yet another
                    // stranger). A wrong guess here signs with the wrong
                    // root, so this is left for a human rather than resolved
                    // automatically.
                    result.failed.push({
                        id,
                        reason: `${parentKey} holds unrelated material and no matching legacy copy exists`,
                    })
                    return
                }
            }
        }

        const { rootKey: _rootKey, ...metadata } = (record.metadata ??
            {}) as Record<string, unknown>
        const candidate = {
            ...record,
            id,
            metadata: {
                ...metadata,
                parentKeyId: parentId ?? metadata.parentKeyId,
                storage: 'none',
            },
        } as Canary13Record

        if (hasNestedMaterial(candidate)) {
            // Defends the same invariant the material branch defends: only
            // `metadata.rootKey` is a known nested carrier. Anything else
            // found here is a shape this pass does not understand, and
            // guessing would risk writing plaintext key material to `k/`.
            result.failed.push({
                id,
                reason: 'carries nested material beyond metadata.rootKey; owned by preflight 0002',
            })
            return
        }

        const childMeta = serializeKey(candidate)
        journal.set(METADATA_PREFIX + id, childMeta)
        assertMetadataWritten(storage, METADATA_PREFIX + id, childMeta)
        storage.remove(id)
        result.adopted.push(id)
    } catch (error) {
        journal.rollback()
        result.failed.push({ id, reason: safeErrorMessage(error) })
        safeWarn(
            `[provider] adopt-stranded: ${id} left flat: ${safeErrorMessage(error)}`,
        )
    } finally {
        wipeSecrets(record)
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

    const opened: { id: string; record: Canary13Record }[] = []

    for (const id of candidates) {
        const sealed = storage.getString(id)
        if (sealed === undefined) continue

        try {
            opened.push({
                id,
                record: decode(
                    await openData(deps.subtle, masterKey, sealed),
                ) as Canary13Record,
            })
        } catch {
            // Another process's record, or the iOS provider's unpadded payload.
            result.leftFlat.push(id)
        }
    }

    // Material-bearing records are adopted first so a nested-only child can be
    // compared against a parent that has already landed in `m/`.
    const ordered = [
        ...opened.filter(entry => classifyRecord(entry.record) === 'material'),
        ...opened.filter(entry => classifyRecord(entry.record) !== 'material'),
    ]

    for (const { id, record } of ordered) {
        const kind = classifyRecord(record)

        if (kind === 'nested-only') {
            await adoptNestedOnly({ deps, masterKey, id, record, result })
            continue
        }

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
