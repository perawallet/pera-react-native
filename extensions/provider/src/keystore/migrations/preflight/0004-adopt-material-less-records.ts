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

import type {
    Migration,
    MigrationUtils,
} from '@algorandfoundation/provider-migrations'
import {
    MasterKeyNotFoundError,
    MATERIAL_PREFIX,
    METADATA_PREFIX,
    decode,
    openData,
    serializeKey,
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../types'
import { safeErrorMessage, safeWarn } from '../safeLog'
import {
    hasNestedMaterial,
    normalizeCanary13Record,
    recognizedNestedShape,
    wipeSecrets,
    type Canary13Record,
} from '../canary13'
import { LAYOUT_VERSION_KEY } from './0003-remove-layout-version-stamp'

/** See `0002-lift-nested-material.ts` — same literal, same reason. */
const MIGRATIONS_LEDGER_KEY = '@algorandfoundation/provider-migrations'

const isFlatCandidate = (key: string): boolean =>
    !key.startsWith(MATERIAL_PREFIX) &&
    !key.startsWith(METADATA_PREFIX) &&
    key !== MIGRATIONS_LEDGER_KEY &&
    key !== LAYOUT_VERSION_KEY

/**
 * Adopts flat canary.13 records that carry **no material at all** — neither a
 * top-level `privateKey`/`seed` nor anything nested — into a bare `k/<id>`
 * entry with no `m/<id>` written.
 *
 * Nothing else does this. Upstream's `adoptLegacyRecords` requires a top-level
 * `Uint8Array` (`legacy.js`: `if (!(material instanceof Uint8Array)) { skipped
 * ... }`); revision `0002` only takes a record that carries material *both* at
 * the top level and nested. Every HD-derived child — `keystore-core`'s
 * `deriveFromSeed`/`deriveDomainKey` write them with `metadata.storage:
 * "none"`, no private key of their own, ever — falls through both, and so does
 * a plain watch-only key. Left unadopted, an entire HD wallet's derived
 * accounts stay at their bare id, invisible to `listMeta()`, while the wallet
 * renders them gone with the bytes still on disk.
 *
 * A candidate that carries only nested material — an HD-derived child holding
 * its parent's key under `metadata.rootKey`, none of its own — is adopted as a
 * metadata-only `k/` entry by {@link adoptNestedOnlyChild}: the nested copy is
 * dropped (canary.19 re-derives the child from the parent on demand), never
 * copied into plaintext `k/`. Anything whose nested shape is unrecognised, or
 * whose parent root has not survived to carry the material, is left flat and
 * reported instead.
 */

/**
 * Adopts a nested-only HD-derived child into a metadata-only `k/<id>` entry.
 *
 * Returns `false` (leave the bare record flat) unless the record is exactly the
 * recognised rootKey nesting AND the parent root still exists — at its bare id
 * (this pass runs before upstream's adoption) or already split into `k/`+`m/`.
 * When the parent is gone the nested copy may be the wallet's last root, so
 * dropping it would be unrecoverable.
 */
const adoptNestedOnlyChild = (
    storage: PeraMigrationContext['storage'],
    storageKey: string,
    record: Canary13Record,
): boolean => {
    const shape = recognizedNestedShape(record)
    if (shape === undefined) return false

    // The driver reads a record back at `k/<storageKey>`; an id that disagrees
    // cannot be split coherently under either — the same guard the flat path
    // below applies.
    if (record.id !== undefined && record.id !== storageKey) return false

    // Only drop the nested copy when the parent still holds MATERIAL: its bare
    // canary.13 record (sealed, material-bearing — this pass runs before
    // upstream adopts it), or an already-adopted `m/<rootId>`. A `k/<rootId>`
    // alone is metadata without material and is NOT proof: a root always
    // carries material, so a lone `k/` means a half-written or unrelated
    // record, and dropping the child's copy then could lose the last root.
    const { rootId } = shape
    const parentHasMaterial =
        storage.getString(rootId) !== undefined ||
        storage.getString(MATERIAL_PREFIX + rootId) !== undefined
    if (!parentHasMaterial) return false

    // Drop `metadata.rootKey` wholesale — the parent carries that material — and
    // normalise to canary.19 vocabulary (`derivationPath` → `bip44Path`,
    // `storage: 'none'`). No `m/` is written: the child has no material of its
    // own.
    const { rootKey: _rootKey, ...rest } = (record.metadata ?? {}) as Record<
        string,
        unknown
    >
    const { metadata } = normalizeCanary13Record({
        record: {
            ...record,
            id: storageKey,
            metadata: {
                ...rest,
                parentKeyId: (rest.parentKeyId as string) ?? rootId,
                storage: 'none',
            },
        } as Canary13Record,
        hasMaterial: false,
    })

    storage.set(METADATA_PREFIX + storageKey, serializeKey(metadata))
    storage.remove(storageKey)
    return true
}

export const migration: Migration<PeraMigrationContext> = {
    id: 4,
    name: 'adopt-material-less-records',
    up: async (
        context: PeraMigrationContext,
        utils: MigrationUtils,
    ): Promise<void> => {
        const { storage, subtle } = context
        const candidates = storage.getAllKeys().filter(isFlatCandidate)
        if (candidates.length === 0) return

        let masterKey: Uint8Array
        try {
            masterKey = await context.masterKeyForRead()
        } catch (error) {
            // Upstream reads a falsey Keychain result the same way
            // (`legacy.js:87-88`): its revision returns, resolves and is
            // ledgered too, so nothing adopts behind us. Parity is what makes
            // resolving safe — not a guarantee that nothing was ever sealed
            // (`crypto.js:27-29`: falsey can also mean a failed read).
            if (error instanceof MasterKeyNotFoundError) return
            // DO NOT turn this into a decline — see `0002`. Unlike the
            // per-record failure path below (one record, deterministic), this
            // is every candidate at once and usually transient. Throwing keeps
            // the revision unledgered (`apply.js:125`) so it retries next
            // launch; declining ledgers it, and upstream skips these targets
            // for carrying no material (`legacy.js:104-109`), so nothing ever
            // adopts them and the accounts stay invisible to `listMeta()`.
            throw error
        }

        utils.secrets.put('keystore-master-key', masterKey)

        const untouched: string[] = []

        await utils.secrets.use('keystore-master-key', async unlocked => {
            for (const storageKey of candidates) {
                const sealed = storage.getString(storageKey)
                if (sealed === undefined) continue

                let record: Canary13Record | undefined
                try {
                    record = decode(
                        await openData(subtle, unlocked, sealed),
                    ) as Canary13Record
                } catch {
                    // Another process's record, or not a record at all. The
                    // iOS credential provider's envelope opens fine — it is
                    // its plaintext payload that is unpadded base64url, so it
                    // is `decode` that throws, not `openData`.
                    continue
                }

                try {
                    const own = record.privateKey ?? record.seed
                    // Adopted elsewhere: upstream (top-level material) or
                    // `0002` (top-level and nested together).
                    if (own instanceof Uint8Array) continue

                    // A biometric-wrapped passkey credential carries its key
                    // under `privateKeyEnc` (`{iv, data}`), not a top-level
                    // `Uint8Array`, so without this it looks material-less and
                    // gets moved into `k/` — killing it, since the native
                    // Android/iOS credential providers only ever read a passkey
                    // at its bare id. Leave it there.
                    if (
                        (record as { privateKeyEnc?: unknown })
                            .privateKeyEnc !== undefined
                    ) {
                        continue
                    }

                    if (hasNestedMaterial(record)) {
                        if (
                            !adoptNestedOnlyChild(storage, storageKey, record)
                        ) {
                            untouched.push(storageKey)
                        }
                        continue
                    }

                    // Mirrors `0002`'s guard: the driver reads a record back
                    // at `k/<storageKey>`, so an id that disagrees with the
                    // storage key cannot be split coherently under either.
                    if (record.id !== undefined && record.id !== storageKey) {
                        untouched.push(storageKey)
                        continue
                    }

                    // canary.13 did not always restate `id`; the driver reads
                    // a record back at `k/<storageKey>`, so it has to be there
                    // on the way in.
                    storage.set(
                        METADATA_PREFIX + storageKey,
                        serializeKey({ ...record, id: storageKey }),
                    )
                    storage.remove(storageKey)
                } catch (error) {
                    // A write that failed must not fail the whole module —
                    // that would reject `keystore.ready` and stop the app
                    // booting over one record. Left flat for a later run.
                    untouched.push(storageKey)
                    safeWarn(
                        `[provider] adopt-material-less-records: entry ${storageKey} left flat: ${safeErrorMessage(error)}`,
                    )
                } finally {
                    wipeSecrets(record)
                }
            }
        })

        utils.secrets.wipe('keystore-master-key')

        context.declined.record(utils.revision.module, untouched)

        if (untouched.length > 0) {
            utils.log?.warn(
                `Left ${untouched.length} flat record(s) unadopted`,
                { entries: untouched },
                utils.revision.module,
            )
        }
    },
}
