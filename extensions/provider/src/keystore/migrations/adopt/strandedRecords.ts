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
    liftSecrets,
    normalizeCanary13Record,
    SECRET_FIELDS,
    wipeSecrets,
    type Canary13Record,
    type LiftedMaterial,
} from '../canary13'
import {
    createJournal,
    sealAndVerify,
    wipeBytes,
    type SealingDeps,
} from '../sealing'
import {
    sealNativeCredentialRecord,
    toNativeByteArray,
} from '../nativeCredentialRecord'
import { classifyRecord, isFlatCandidate, PASSKEY_TYPES } from './classify'

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
    /**
     * `k/<id>` entries `looksLikeWrappedPasskey` flagged (top-level
     * `privateKeyEnc`) that `restoreWrappedPasskeys` declined to touch —
     * wrong type, or a shape it doesn't recognise. Separate from `leftFlat`
     * because the two live at different storage keys (`leftFlat` ids are
     * bare, these are still under `METADATA_PREFIX`), which matters when
     * `hasStrandedWork`'s caller turns either list into a durable note.
     */
    declinedWrapped: string[]
    failed: { id: string; reason: string }[]
}

export const emptyAdoptionResult = (): AdoptionResult => ({
    adopted: [],
    reconstructed: [],
    quarantined: [],
    restored: [],
    leftFlat: [],
    declinedWrapped: [],
    failed: [],
})

/**
 * Deliberately loose — a raw substring match, not a decode. Precision is
 * `restoreWrappedPasskeys`'s job via `classifyRecord`; this only decides
 * whether a `k/<id>` entry is worth treating as a `0004`-moved credential.
 *
 * Shared by `hasStrandedWork` and `mayHoldWrappedPasskey` so the two can't
 * drift apart — this plan has already shipped one bug from exactly that.
 */
const looksLikeWrappedPasskey = (
    storage: KeychainStorage,
    key: string,
): boolean =>
    key.startsWith(METADATA_PREFIX) &&
    (storage.getString(key) ?? '').includes('privateKeyEnc')

/**
 * Non-cryptographic fingerprint of a stored value: length plus a 32-bit
 * rolling hash, both computable without a master-key read. Not collision-
 * resistant and not meant to be — its only job is telling "still the exact
 * bytes a previous pass looked at" from "something wrote here since",
 * cheaply enough to run on every launch.
 */
export const fingerprintFlatValue = (value: string): string => {
    let hash = 0
    for (let i = 0; i < value.length; i++) {
        hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0
    }
    return `${value.length}:${(hash >>> 0).toString(16)}`
}

/**
 * The durable note of decisions a previous pass made that don't need
 * revisiting — keyed by STORAGE KEY (a bare id for a `leftFlat` decision, a
 * `METADATA_PREFIX`-prefixed key for a `declinedWrapped` one), the value
 * being {@link fingerprintFlatValue} of whatever bytes justified the decision
 * at the time.
 *
 * Keyed by storage key rather than bare id specifically because the same id
 * CAN appear in both lists at once — a bare passkey plus an unrelated
 * `k/<id>` that happens to carry `privateKeyEnc` — and keying by bare id
 * would let one decision's fingerprint silently overwrite the other's,
 * permanently breaking the overwritten lookup.
 *
 * A fingerprint, not a bare presence flag: a decision made about THESE bytes
 * does not mean the same key is still settled once something else writes
 * over it (the Android credential provider writes concurrently, and a record
 * caught mid-write must heal once the writer finishes, not be abandoned
 * forever — see `hasStrandedWork`'s use of this below).
 */
export type ExpectedFlat = ReadonlyMap<string, string>

/**
 * `noted` is `expectedFlat.get(<the storage key just read>)` — never a bare
 * id for the metadata branch — for the launch guard's actual, not derived,
 * cost characteristics.
 */
const isStillNoted = (
    currentValue: string,
    noted: string | undefined,
): boolean =>
    noted !== undefined && fingerprintFlatValue(currentValue) === noted

/**
 * Cheap enough to run on every launch: one `getAllKeys()`, no crypto, no
 * master-key read. It DOES read every metadata (`k/`) value via `getString`
 * to sniff for a moved passkey (see below) — still no crypto and no master
 * key, but not free the way a pure key-prefix scan would be.
 *
 * `expectedFlat` is the durable note of ids a previous pass decided don't
 * need revisiting — passkey credentials, payloads this build cannot decode,
 * and `k/` entries that looked like a moved passkey but weren't. Without it
 * every device holding one of these would report work on every launch and
 * pay for a full decode pass (or, for the wrapped-passkey sniff, a
 * master-key read) that can never make progress. A record left in `failed`
 * (unreadable material, a foreign `k/`, or a shape `0002` owns) is
 * deliberately NOT in that set: it is worth retrying, so it keeps reporting
 * work until something resolves it.
 *
 * Also covers the wrapped-passkey damage `restoreWrappedPasskeys` fixes: a
 * `0004`-moved credential has no bare id at all, so the flat scan above sees
 * nothing on a device whose ONLY stranded work is a moved passkey. This is
 * the same loose substring sniff `mayHoldWrappedPasskey` uses below, inlined
 * rather than called separately so the whole check stays one `getAllKeys()`
 * call — a second call here would double the per-launch cost this function
 * exists to keep near zero.
 */
export const hasStrandedWork = (
    storage: KeychainStorage,
    expectedFlat: ExpectedFlat = new Map(),
): boolean => {
    const keys = storage.getAllKeys()

    return keys.some(key => {
        if (isFlatCandidate(key)) {
            const noted = expectedFlat.get(key)
            if (noted === undefined) return true
            const current = storage.getString(key)
            return current === undefined || !isStillNoted(current, noted)
        }

        if (!key.startsWith(METADATA_PREFIX)) return false

        const raw = storage.getString(key)
        if (raw === undefined || !raw.includes('privateKeyEnc')) return false

        // Looked up by the full `k/<id>` key, never the bare id — the note's
        // key namespace matches storage location, not identity, so a bare
        // passkey and this `k/` entry can be noted independently even when
        // they share an id.
        return !isStillNoted(raw, expectedFlat.get(key))
    })
}

/**
 * `id` is always the storage key the record is being written under — never
 * `record.id`, which for a quarantined record is the id it is fleeing.
 *
 * Strips every field in `SECRET_FIELDS`, not just `privateKey`/`seed` — a
 * top-level `key: Uint8Array` is just as real a carrier (`canary13.ts`'s own
 * `SECRET_FIELDS` set says so) and every caller of this function writes
 * straight into the plaintext `k/` bucket.
 *
 * Stripping `key` specifically is defensive rather than reachable today: the
 * material branch now refuses any record with more than one populated
 * `SECRET_FIELDS` name before it ever reaches here, and a record with `key`
 * as its ONLY secret field classifies as `material-less` and is left flat.
 * Left in so this function stays correct on its own — and so nobody
 * "simplifies" it back to `privateKey`/`seed` only — if either caller's
 * gating ever changes.
 */
const withoutOwnSecrets = (record: Canary13Record): Record<string, unknown> => {
    const rest: Record<string, unknown> = {}
    for (const [field, value] of Object.entries(
        record as unknown as Record<string, unknown>,
    )) {
        if (!SECRET_FIELDS.has(field)) rest[field] = value
    }
    return rest
}

const metadataOf = (record: Canary13Record, id: string): string =>
    serializeKey({
        ...withoutOwnSecrets(record),
        id,
    } as unknown as Canary13Record)

/**
 * The record's own top-level `SECRET_FIELDS` names that actually hold
 * something.
 *
 * `null` is excluded deliberately. `carriesSecretName` reports nothing under a
 * `null` and `metadataOf` strips the name either way, so a `seed: null`
 * alongside a real `privateKey` carries nothing that could be lost — counting
 * it would refuse an adoptable record forever and leave the user unable to
 * sign.
 */
const populatedSecretFields = (record: Canary13Record): string[] =>
    [...SECRET_FIELDS].filter(field => {
        const value = (record as unknown as Record<string, unknown>)[field]
        return value !== undefined && value !== null
    })

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

/**
 * True when a `SECRET_FIELDS` NAME appears anywhere below `value`, whatever it
 * holds.
 *
 * `hasNestedMaterial` cannot stand in: it tests for a `Uint8Array`, and the
 * whole hazard here is the container shape (`key: { d: bytes }`) that both it
 * and `liftSecrets` walk straight past.
 */
const carriesSecretName = (value: unknown): boolean => {
    if (value instanceof Uint8Array || value === null) return false
    if (Array.isArray(value)) return value.some(carriesSecretName)
    if (typeof value !== 'object') return false

    return Object.entries(value as Record<string, unknown>).some(
        ([field, child]) =>
            SECRET_FIELDS.has(field) || carriesSecretName(child),
    )
}

/**
 * `journal.rollback()` issues its own `storage.set`/`storage.remove` calls, so
 * it can throw — from inside the `catch` that was already handling a failure.
 * That throw escapes `adoptStrandedRecords` and rejects `0005.up`, which
 * rejects `migrations.ready` → `keystore.ready`: the app fails to boot, every
 * launch. Whatever the rollback did restore is worth keeping, and the caller
 * records the record in `failed` either way.
 */
const safeRollback = (
    journal: ReturnType<typeof createJournal>,
    id: string,
): void => {
    try {
        journal.rollback()
    } catch (error) {
        safeWarn(
            `[provider] adopt-stranded: ${id} rollback failed: ${safeErrorMessage(error)}`,
        )
    }
}

/**
 * Every refusal that uses this leaves the record exactly where it is.
 *
 * The shapes concerned are ones preflight `0002` was designed for, and earlier
 * wording named it as their owner — but `0002` is ledgered on every device that
 * ran 7.0.4 (the population this pass exists to repair) and a ledgered revision
 * never runs again. Naming it as the owner reads as "already someone else's
 * job"; clearing one of these actually needs a NEW revision, or this pass
 * widened. The refusal itself is unchanged and still correct.
 */
const refusedPendingNewRevision = (reason: string): string =>
    `${reason}; needs a new revision (preflight 0002, which owns this shape, is already ledgered on every 7.0.4 device)`

type AdoptNestedOnlyArgs = {
    deps: AdoptionDeps
    masterKey: Uint8Array
    id: string
    record: Canary13Record
    result: AdoptionResult
}

type NestedShape = { rootId: string; rootMaterial: Uint8Array }

/**
 * The only nested shape this pass understands: `metadata.rootKey` present,
 * carrying exactly one secret — its own `privateKey` — and nothing else in the
 * whole record carries a secret anywhere outside that one field.
 *
 * Deliberately narrow. `liftSecrets` (shared with preflight `0002`, the
 * designed owner of arbitrary nested material) finds EVERY secret in the
 * record regardless of field name or depth, so this can't be fooled by
 * material sitting at `rootKey.seed`/`rootKey.key` instead of
 * `rootKey.privateKey`, a second nested carrier elsewhere, or a `rootKey`
 * missing its own `id`. Anything but the exact recognised shape returns
 * `undefined`, and the caller refuses the record rather than guess — refusing
 * costs nothing (the bare record survives untouched), guessing wrong here can
 * discard the wallet's only remaining root key.
 */
const recognizedNestedShape = (
    record: Canary13Record,
): NestedShape | undefined => {
    const lifted: LiftedMaterial[] = []
    liftSecrets(record, record.id, lifted)
    if (lifted.length !== 1) return undefined

    const [only] = lifted
    if (typeof only.id !== 'string') return undefined

    const nested = (record.metadata as { rootKey?: Canary13Record } | undefined)
        ?.rootKey
    if (nested === undefined) return undefined
    if (nested.id !== only.id) return undefined
    if (nested.privateKey !== only.bytes) return undefined

    return { rootId: only.id, rootMaterial: only.bytes }
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
    // A root reconstructed below is re-encoded plaintext key material that
    // lives outside `record`, so `wipeSecrets(record)` cannot reach it.
    let rootReEncoded: Uint8Array | undefined

    try {
        const shape = recognizedNestedShape(record)
        if (shape === undefined) {
            result.failed.push({
                id,
                reason: refusedPendingNewRevision(
                    'nested material is not the recognised rootKey shape',
                ),
            })
            return
        }

        const { rootId, rootMaterial } = shape
        const nested = (record.metadata as { rootKey?: Canary13Record })
            .rootKey as Canary13Record

        // `rootKey.privateKey` is the ONLY secret this branch ever places in
        // a bucket. The record's own top-level `SECRET_FIELDS` names are
        // stripped by `metadataOf`, and `metadata.rootKey` is dropped
        // wholesale from the child's write — so anything else living under a
        // secret name, at the top level or anywhere below `rootKey`, is
        // written nowhere and then deleted along with the bare copy.
        //
        // Gate on PRESENCE BY NAME, exactly as the material branch does.
        // `liftSecrets` walks past a `SECRET_FIELDS` name holding a container
        // rather than a bare `Uint8Array`, so the shape check above cannot
        // see one, while `metadataOf` strips it regardless; matching
        // `metadataOf`'s own test is what stops the two branches drifting
        // apart again.
        const { privateKey: _placed, ...restOfRootKey } =
            nested as unknown as Record<string, unknown>
        const strayOwnFields = populatedSecretFields(record)
        if (strayOwnFields.length > 0 || carriesSecretName(restOfRootKey)) {
            result.failed.push({
                id,
                reason: refusedPendingNewRevision(
                    `carries secret field(s) this pass cannot place (${[...strayOwnFields, ...(carriesSecretName(restOfRootKey) ? ['rootKey'] : [])].join(', ')})`,
                ),
            })
            return
        }

        // Same normalisation the material branch applies, for the same reason:
        // a root reconstructed below in canary.13's vocabulary is a root
        // `deriveFromSeed` refuses to derive from. Computed before the
        // comparisons so the parent's `m/` is measured against the bytes this
        // pass would actually write there, not the pre-normalisation copy.
        const normalizedRoot = normalizeCanary13Record({
            record: nested,
            material: rootMaterial,
            hasMaterial: true,
        })
        rootReEncoded = normalizedRoot.material
        const rootPlaced = rootReEncoded ?? rootMaterial

        let parentId: string = rootId
        const rootJournal = createJournal(storage)

        try {
            const parentKey = MATERIAL_PREFIX + rootId
            const parentState = await materialState(
                deps,
                masterKey,
                parentKey,
                rootPlaced,
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
                    rootPlaced,
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
                        normalizedRoot.metadata,
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

                    rootJournal.track(parentKey)
                    await sealAndVerify(deps, masterKey, parentKey, rootPlaced)
                    rootJournal.set(METADATA_PREFIX + rootId, expectedRootMeta)
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
        } catch (error) {
            safeRollback(rootJournal, id)
            result.failed.push({ id, reason: safeErrorMessage(error) })
            safeWarn(
                `[provider] adopt-stranded: ${id} left flat: ${safeErrorMessage(error)}`,
            )
            return
        }

        // The parent side is already settled — matched, repointed, or
        // durably reconstructed and proven with its own readback — before the
        // child's own metadata is touched. A failure below rolls back only
        // this child write: a root recovered above is worth keeping even if
        // this particular child can't be adopted alongside it.
        const childJournal = createJournal(storage)
        try {
            const { rootKey: _rootKey, ...metadata } = (record.metadata ??
                {}) as Record<string, unknown>
            const recordForMeta = {
                ...record,
                metadata: {
                    ...metadata,
                    parentKeyId: parentId,
                    storage: 'none',
                },
            } as Canary13Record

            // `hd-derived-ed25519` is one of the types `normalizeCanary13Record`
            // rewrites (`path` → parsed `bip44Path`, `derivation` →
            // `derivationType`); without it `sign` derives from `undefined`
            // segments.
            const childMeta = metadataOf(
                normalizeCanary13Record({
                    record: recordForMeta,
                    hasMaterial: false,
                }).metadata,
                id,
            )
            childJournal.set(METADATA_PREFIX + id, childMeta)
            assertMetadataWritten(storage, METADATA_PREFIX + id, childMeta)
            storage.remove(id)
            result.adopted.push(id)
        } catch (error) {
            safeRollback(childJournal, id)
            result.failed.push({ id, reason: safeErrorMessage(error) })
            safeWarn(
                `[provider] adopt-stranded: ${id} left flat: ${safeErrorMessage(error)}`,
            )
        }
    } finally {
        wipeSecrets(record)
        wipeBytes(rootReEncoded)
    }
}

type AdoptMaterialLessArgs = {
    deps: AdoptionDeps
    id: string
    record: Canary13Record
    result: AdoptionResult
}

/**
 * The classification table's "no material at all → `k/` only" row.
 *
 * These used to be lumped in with the passkeys into `leftFlat`, which is worse
 * than doing nothing: `leftFlat` ids become the durable expected-flat note, so
 * `hasStrandedWork` is suppressed for them forever and the guard built to
 * retry exactly this residue — a record preflight `0004` failed on, the only
 * one a ledgered 7.0.4 device can still hold — never looks at it again.
 *
 * Synchronous and master-key-free: there is nothing to seal, so no `m/` entry
 * is written and no Keychain prompt is raised.
 */
const adoptMaterialLess = ({
    deps,
    id,
    record,
    result,
}: AdoptMaterialLessArgs): void => {
    const { storage } = deps
    const journal = createJournal(storage)

    try {
        // `classifyRecord` tests for a `Uint8Array`, so a `SECRET_FIELDS` name
        // holding a container (`key: { d: bytes }`) classifies as material-less
        // while `metadataOf` still strips it — the bytes would be written
        // nowhere and then deleted with the bare copy. Same presence-by-name
        // gate the other two branches use.
        const strayFields = populatedSecretFields(record)
        if (
            strayFields.length > 0 ||
            carriesSecretName(withoutOwnSecrets(record))
        ) {
            result.failed.push({
                id,
                reason: refusedPendingNewRevision(
                    `carries secret field(s) this pass cannot place (${strayFields.join(', ') || 'nested'})`,
                ),
            })
            return
        }

        if (storage.getString(MATERIAL_PREFIX + id) !== undefined) {
            // A record carrying no material has no business owning an `m/`
            // entry. Something this pass does not understand holds this id.
            result.failed.push({
                id,
                reason: `${MATERIAL_PREFIX}${id} holds material for a record that carries none`,
            })
            return
        }

        const meta = metadataOf(
            normalizeCanary13Record({ record, hasMaterial: false }).metadata,
            id,
        )
        const existing = storage.getString(METADATA_PREFIX + id)
        if (existing !== undefined && existing !== meta) {
            // Same rule as the material branch: an existing `k/<id>` is only
            // proof this record is already adopted if it describes THIS
            // record. Anything else and the bare copy stays.
            result.failed.push({
                id,
                reason: `${METADATA_PREFIX}${id} exists but describes a different record`,
            })
            return
        }

        if (existing === undefined) {
            journal.set(METADATA_PREFIX + id, meta)
            assertMetadataWritten(storage, METADATA_PREFIX + id, meta)
        }
        storage.remove(id)
        result.adopted.push(id)
    } catch (error) {
        safeRollback(journal, id)
        result.failed.push({ id, reason: safeErrorMessage(error) })
        safeWarn(
            `[provider] adopt-stranded: ${id} left flat: ${safeErrorMessage(error)}`,
        )
    } finally {
        wipeSecrets(record)
    }
}

/**
 * Cheap, no-crypto sniff mirroring `isFlatCandidate`'s cost: whether ANY `k/`
 * record might be a `0004`-moved wrapped passkey, so the master-key
 * short-circuit below can't skip restoration on a device whose only stranded
 * work is a credential sitting in `k/` (there are no bare candidates for that
 * device, so `isFlatCandidate` alone sees nothing to do).
 *
 * Deliberately loose — a raw substring match, not a decode. Precision is
 * `restoreWrappedPasskeys`'s job via `classifyRecord`; this only decides
 * whether it's worth resolving the master key at all.
 */
const mayHoldWrappedPasskey = (storage: KeychainStorage): boolean =>
    storage.getAllKeys().some(key => looksLikeWrappedPasskey(storage, key))

/** Local, like `0002-rematerialize-passkey-credentials.ts`'s own copy — a length+`.every` compare is cheap enough not to share a util for. */
const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
    a.length === b.length && a.every((byte, index) => byte === b[index])

/**
 * `0004` classified a biometric-wrapped credential as material-less — its
 * material lives under `privateKeyEnc` as `{iv, data}`, not a `Uint8Array` —
 * so it wrote `k/<id>` and removed the bare id the native credential
 * providers read from. Both providers, and the app, lose the credential.
 *
 * The wrapped material survives intact inside the plaintext `k/` record, so
 * this reverses `0004`'s write. It is NOT `sealData`+`JSON.stringify`: the
 * native providers' decrypt branch requires an `{iv, tag, content}` envelope
 * (`sealData` emits `{iv, content}`, tag folded into content, which
 * `nativeProviderRecord.ts`'s own `isNativeProviderRecordPayload` says
 * outright "was never a credential record"), and byte fields must cross as
 * JSON number arrays, never `JSON.stringify`'s `{"0":4,"1":4,…}` and never
 * `decode`'s own `{$u8}` form. `sealNativeCredentialRecord`/
 * `toNativeByteArray` (`../nativeCredentialRecord`) are the writers the
 * sibling un-adopt path (`repairs/0002-rematerialize-passkey-credentials.ts`)
 * already uses for exactly this contract — reused here rather than
 * reinvented.
 *
 * Two separate phases, mirroring `0002`: write-and-verify the bare copy
 * first: seal it, read it back through the keystore's own `decode`+`openData`
 * (the same envelope shape `sealNativeCredentialRecord` produces), and
 * confirm `publicKey` round-trips byte-for-byte before trusting the write.
 * Only once that is proven does phase two remove `k/<id>` — a SEPARATE step
 * whose own failure must never roll back the now-proven-good flat write
 * (`0002`'s rule: destroying it would leave nothing readable at all). The
 * write-and-verify's own failure DOES roll back, via `journal`, to whatever
 * `id` held before this attempt — `undefined` on a first attempt, or a
 * still-good flat copy an earlier run already wrote and verified before being
 * killed before it could remove `k/` (the resume case, see below).
 *
 * Detection layers three checks, matching `0002`'s own gate:
 * `classifyRecord(record) === 'wrapped-passkey'` (the pipeline's existing
 * top-level `privateKeyEnc` presence check), `PASSKEY_TYPES.has(record.type)`
 * (same set `0002` uses), and — because `classifyRecord` gives
 * `privateKeyEnc` precedence over material, so a record carrying BOTH would
 * otherwise still classify as `wrapped-passkey` — a refusal if any top-level
 * `SECRET_FIELDS` name is also present. This pass can only place wrapped
 * material; dragging real material along inside `...rest` unconverted would
 * corrupt it silently. `wipeSecrets(record)` runs in a `finally` around every
 * branch reached past that point (matching `adoptNestedOnly`'s own pattern),
 * so a refused dual-secret record still gets its real key bytes zeroed rather
 * than left resident in the heap.
 *
 * "Bare `id` already holds a record alongside `k/<id>`" is not refused: it is
 * `0002`'s documented RESUME state — a run killed between the flat write and
 * the `k/` removal. Refusing would mean a permanent `failed` entry AND a
 * Keychain/biometric read on every subsequent boot, since `k/<id>` staying
 * put keeps `mayHoldWrappedPasskey` true forever. Instead this reprocesses
 * unconditionally, exactly as `0002` does: `journal.track(id)` captures
 * whatever was there (including a still-good resumed copy) before the write,
 * so a failure below restores it rather than destroying it.
 */
const restoreWrappedPasskeys = async (
    deps: AdoptionDeps,
    masterKey: Uint8Array,
    result: AdoptionResult,
): Promise<void> => {
    const { storage } = deps

    for (const key of storage.getAllKeys()) {
        if (!key.startsWith(METADATA_PREFIX)) continue

        const raw = storage.getString(key)
        if (raw === undefined || !raw.includes('privateKeyEnc')) continue

        const id = key.slice(METADATA_PREFIX.length)

        let record: Canary13Record
        try {
            record = decode(raw) as Canary13Record
        } catch (error) {
            result.failed.push({ id, reason: safeErrorMessage(error) })
            continue
        }

        const type = typeof record.type === 'string' ? record.type : ''
        if (
            !PASSKEY_TYPES.has(type) ||
            classifyRecord(record) !== 'wrapped-passkey'
        ) {
            // The loose `privateKeyEnc` substring sniff (`looksLikeWrappedPasskey`)
            // fired but this isn't actually a 0004-moved credential. Record it
            // so `expectedFlat` can suppress the sniff on this id — without
            // this, `hasStrandedWork` would call for a Keychain-capable
            // master-key read on every subsequent launch, forever, for a
            // record that can never resolve.
            result.declinedWrapped.push(id)
            wipeSecrets(record)
            continue
        }

        try {
            const presentSecretFields = populatedSecretFields(record)
            if (presentSecretFields.length > 0) {
                result.failed.push({
                    id,
                    reason: `carries privateKeyEnc alongside top-level secret field(s) (${presentSecretFields.join(', ')}); this pass cannot place both`,
                })
                continue
            }

            if (storage.getString(MATERIAL_PREFIX + id) !== undefined) {
                // A passkey credential never has material of its own in
                // `m/` — this shape says something else this pass doesn't
                // understand is going on. Leave it for a human rather than
                // guess.
                result.failed.push({
                    id,
                    reason: `${MATERIAL_PREFIX}${id} unexpectedly holds material for a passkey credential`,
                })
                continue
            }

            const journal = createJournal(storage)
            let verified = false
            try {
                // `id` is always the storage key being written under, never
                // `record.id` — for a `0004`-moved credential the two should
                // agree, but this pass doesn't trust that a migration with
                // this exact bug also got the id right everywhere else.
                const {
                    id: _staleId,
                    publicKey,
                    ...rest
                } = record as unknown as Canary13Record & {
                    publicKey?: Uint8Array
                }
                // Throws (caught below) when `publicKey` is missing or not a
                // `Uint8Array` — declined exactly as an explicit guard would,
                // same as `0002`'s equivalent field.
                const nativePublicKey = toNativeByteArray(
                    publicKey as Uint8Array,
                )
                const nativeRecord = { ...rest, id, publicKey: nativePublicKey }

                journal.track(id)
                storage.set(
                    id,
                    await sealNativeCredentialRecord(
                        deps.subtle,
                        masterKey,
                        nativeRecord,
                    ),
                )

                const writtenRaw = storage.getString(id)
                const reopened =
                    writtenRaw === undefined
                        ? undefined
                        : (decode(
                              await openData(
                                  deps.subtle,
                                  masterKey,
                                  writtenRaw,
                              ),
                          ) as { publicKey?: Uint8Array })
                if (
                    reopened === undefined ||
                    !(reopened.publicKey instanceof Uint8Array) ||
                    !bytesEqual(reopened.publicKey, publicKey as Uint8Array)
                ) {
                    throw new Error(
                        `restored record at ${id} did not read back as written`,
                    )
                }
                verified = true
            } catch (error) {
                safeRollback(journal, id)
                result.failed.push({ id, reason: safeErrorMessage(error) })
                safeWarn(
                    `[provider] adopt-stranded: ${id} left flat: ${safeErrorMessage(error)}`,
                )
            }
            if (!verified) continue

            // Reached only once the flat copy is provably readable. A
            // failure removing `k/<id>` from here on must never roll back
            // the write above — that copy is already proven correct, and
            // destroying it would leave nothing readable at all (0002's
            // rule).
            try {
                storage.remove(key)
                result.restored.push(id)
            } catch (error) {
                result.failed.push({
                    id,
                    reason: `restored but left with an orphaned ${key}: ${safeErrorMessage(error)}`,
                })
                safeWarn(
                    `[provider] adopt-stranded: ${id} restored but ${key} removal failed: ${safeErrorMessage(error)}`,
                )
            }
        } finally {
            wipeSecrets(record)
        }
    }
}

export const adoptStrandedRecords = async (
    deps: AdoptionDeps,
): Promise<AdoptionResult> => {
    const { storage } = deps
    const result = emptyAdoptionResult()

    const hasFlatWork = storage.getAllKeys().some(isFlatCandidate)
    if (!hasFlatWork && !mayHoldWrappedPasskey(storage)) return result

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

    // Must run before candidates are enumerated below: a credential `0004`
    // moved into `k/` is invisible to the loop until it's back at its bare
    // id.
    await restoreWrappedPasskeys(deps, masterKey, result)

    const candidates = storage.getAllKeys().filter(isFlatCandidate)
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

        if (kind === 'material-less') {
            adoptMaterialLess({ deps, id, record, result })
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
                reason: refusedPendingNewRevision('carries nested material'),
            })
            wipeSecrets(record)
            continue
        }

        // Same doctrine as the nested-only branch's shape check: `own` below
        // can only seal ONE of `privateKey`/`seed`/`key` into `m/<id>`. A
        // record carrying a second populated `SECRET_FIELDS` entry (legacy
        // `privateKey`+`seed`, or a `key` alongside either) would have that
        // second secret silently dropped once `metadataOf` strips every
        // `SECRET_FIELDS` name from `k/<id>` and the bare copy — the only
        // other place it lived — is removed. Refuse instead: the bare record
        // survives with everything still in it.
        //
        // Gate on PRESENCE BY NAME, not `instanceof Uint8Array` — `metadataOf`
        // strips by name too, so a field the gate doesn't recognise as a
        // secret (e.g. `key` holding a wrapped/nested container instead of a
        // bare array) would still get stripped from `k/<id>` and then lost
        // when the bare copy is removed. Matching `metadataOf`'s own test is
        // what keeps the two from drifting apart again.
        const presentSecretFields = populatedSecretFields(record)
        if (presentSecretFields.length > 1) {
            result.failed.push({
                id,
                reason: `carries more than one populated secret field (${presentSecretFields.join(', ')}); only one can be sealed`,
            })
            wipeSecrets(record)
            continue
        }

        // The nested-only branch's own `carriesSecretName(restOfRootKey)`
        // gate, applied symmetrically here. `hasNestedMaterial` above tests
        // for a `Uint8Array`, so a secret NAME holding a container
        // (`metadata.x.key = { d: bytes }`) walks past it and gets serialised
        // straight into the plaintext `k/` bucket.
        if (carriesSecretName(withoutOwnSecrets(record))) {
            result.failed.push({
                id,
                reason: refusedPendingNewRevision(
                    'carries a container-shaped secret below its top level',
                ),
            })
            wipeSecrets(record)
            continue
        }

        const own = (record.privateKey ?? record.seed) as Uint8Array
        // Normalised BEFORE anything is compared or written. `repairs/0001`,
        // the only other caller, lives in a separately ledgered module that is
        // already applied on every device that ran 7.0.4 — precisely the
        // population this pass repairs — so nothing downstream will rewrite
        // what is written here. Left in canary.13's vocabulary the records
        // become visible and stay unusable: `deriveFromSeed` rejects a parent
        // not typed `hd-root-key`, and an ed25519 child holding raw libsodium
        // bytes with no `signAlgorithm` throws inside the host `importKey`.
        // The boot guard adopts records long after every revision is ledgered,
        // so this cannot be another revision either. Re-normalising is a
        // no-op: every rewrite is gated on the canary.13 spelling still being
        // there, so `repairs/0001` running afterwards on a fresh-ledger device
        // changes nothing.
        const { metadata: normalized, material: reEncoded } =
            normalizeCanary13Record({
                record,
                material: own,
                hasMaterial: true,
            })
        // The bytes this pass would actually seal. Comparing `own` instead
        // would read an already-normalised `m/<id>` as a different key and
        // quarantine the record out from under itself on the next launch.
        const placed = reEncoded ?? own
        const journal = createJournal(storage)

        try {
            const hasMeta =
                storage.getString(METADATA_PREFIX + id) !== undefined
            const state = await materialState(
                deps,
                masterKey,
                MATERIAL_PREFIX + id,
                placed,
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
                    placed,
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
                    placed,
                )
                const legacyMeta = metadataOf(normalized, legacyId)
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
                if (existing !== metadataOf(normalized, id)) {
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
                await sealAndVerify(
                    deps,
                    masterKey,
                    MATERIAL_PREFIX + id,
                    placed,
                )
            }
            if (!hasMeta) {
                const meta = metadataOf(normalized, id)
                journal.set(METADATA_PREFIX + id, meta)
                assertMetadataWritten(storage, METADATA_PREFIX + id, meta)
            }
            storage.remove(id)
            result.adopted.push(id)
        } catch (error) {
            safeRollback(journal, id)
            result.failed.push({ id, reason: safeErrorMessage(error) })
            safeWarn(
                `[provider] adopt-stranded: ${id} left flat: ${safeErrorMessage(error)}`,
            )
        } finally {
            wipeBytes(own)
            // Re-encoded material is a NEW array outside `record`, so
            // `wipeSecrets` cannot reach it.
            wipeBytes(reEncoded)
            wipeSecrets(record)
        }
    }

    return result
}
