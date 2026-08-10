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
import type { KeyData } from '@algorandfoundation/keystore-core'
import { MATERIAL_PREFIX, METADATA_PREFIX } from './prefixes'

/**
 * The slice of the canary.14 package this migration stands on. Injected rather
 * than imported so the module carries no native dependency: the keystore
 * package pulls in `react-native-quick-crypto`, which cannot be loaded off
 * device. `singleton.ts` binds the real implementations.
 */
export type KeystoreLayoutMigrationDeps = {
    storage: {
        getAllKeys: () => string[]
        getString: (key: string) => string | undefined
        set: (key: string, value: string) => void
        remove: (key: string) => void
    }
    /** Reads the Keychain master key. canary.13 and canary.14 share the slot. */
    readMasterKey: () => Promise<Uint8Array>
    /** Reads a sealed payload; canary.14's handles canary.13's `{iv,tag,content}`. */
    openData: (key: Uint8Array, payload: string) => Promise<string>
    sealData: (key: Uint8Array, data: string) => Promise<string>
    /** Serializes `Key` metadata the way the canary.14 driver expects in `k/`. */
    encode: (key: KeyData) => string
    decode: (data: string) => KeyData
}

export type KeystoreLayoutMigrationResult = {
    migrated: number
    /** Already-migrated entries, plus leftovers from a run that died mid-record. */
    skipped: number
    /** Left in place, unmigrated — never deleted, so a later run can retry. */
    failed: number
}

/**
 * canary.13 wrote one MMKV entry per key, keyed by the bare key id, holding the
 * whole encrypted `KeyData`. canary.14 splits that across two buckets:
 * `k/<id>` plaintext metadata and `m/<id>` sealed private material. Both the
 * driver and `reconcileKeystore` only ever scan `k/`, so an unmigrated entry is
 * invisible — the wallet renders empty while the bytes sit untouched on disk.
 */
const isLegacyEntry = (key: string): boolean =>
    !key.startsWith(METADATA_PREFIX) && !key.startsWith(MATERIAL_PREFIX)

/** Field names that carry raw key material anywhere in a record. */
const SECRET_FIELDS = new Set(['privateKey', 'seed', 'key'])

/**
 * Strips key material from every depth of a record, not just the top level.
 *
 * canary.13 sealed the *whole* record, so nesting material inside `metadata` was
 * safe at rest — and it does: an HD-derived key carries its parent under
 * `metadata.rootKey`, `privateKey` included. canary.14 keeps `k/` in plaintext,
 * so copying `metadata` verbatim would write an HD wallet's root private key to
 * disk unencrypted. Nothing is lost: each key's own material is sealed under
 * `m/<id>`, so the embedded copy is redundant.
 */
const withoutSecrets = <T>(value: T): T => {
    if (Array.isArray(value)) {
        return value.map(withoutSecrets) as unknown as T
    }
    // Uint8Array is an object but must survive intact (e.g. `publicKey`).
    if (value instanceof Uint8Array || value === null) return value
    if (typeof value !== 'object') return value

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([field]) => !SECRET_FIELDS.has(field))
            .map(([field, nested]) => [field, withoutSecrets(nested)]),
    ) as T
}

/**
 * Reads both new buckets back through the same helpers the engine uses, so a
 * truncated or unreadable write is caught while the canary.13 entry is still on
 * disk. Returning `false` leaves that entry in place for the next launch.
 */
const isMigrationDurable = async (
    deps: KeystoreLayoutMigrationDeps,
    id: string,
    material: Uint8Array | undefined,
    masterKey: Uint8Array,
): Promise<boolean> => {
    const metadata = deps.storage.getString(METADATA_PREFIX + id)
    if (!metadata) return false
    if (deps.decode(metadata).id !== id) return false

    if (!material) return true

    const sealed = deps.storage.getString(MATERIAL_PREFIX + id)
    if (!sealed) return false

    return (await deps.openData(masterKey, sealed)) === base64.encode(material)
}

/**
 * Re-indexes canary.13 keystore records into the canary.14 two-bucket layout.
 *
 * Nothing is re-encrypted: both versions seal against the same Keychain master
 * key (`service: "app-secret"`), share one MMKV instance (`id: "keystore"`), and
 * canary.14's `openData` still reads canary.13's `{iv, tag, content}` payloads.
 * Only the storage keys change.
 *
 * Safe to run on every launch: it is a no-op once no bare-id entries remain, and
 * a record is dropped only after both new buckets are verified readable, so an
 * interrupted run resumes rather than losing material.
 *
 * Must run before `reconcileKeystore` re-seeds the store — the engine's own
 * `ready` hydration sees only `k/` and would otherwise report zero keys.
 */
export const migrateKeystoreLayout = async (
    deps: KeystoreLayoutMigrationDeps,
): Promise<KeystoreLayoutMigrationResult> => {
    const legacyIds = deps.storage.getAllKeys().filter(isLegacyEntry)

    const result: KeystoreLayoutMigrationResult = {
        migrated: 0,
        skipped: 0,
        failed: 0,
    }
    if (legacyIds.length === 0) return result

    // Deferred until there is something to migrate: on a fresh install the
    // Keychain entry does not exist yet and this would throw
    // MasterKeyNotFoundError before the keystore ever creates one.
    const masterKey = await deps.readMasterKey()

    for (const id of legacyIds) {
        try {
            // A previous run wrote the new buckets and died before the cleanup;
            // the canary.13 copy is redundant, not a second key.
            if (deps.storage.getString(METADATA_PREFIX + id)) {
                deps.storage.remove(id)
                result.skipped += 1
                continue
            }

            const raw = deps.storage.getString(id)
            if (!raw) {
                result.skipped += 1
                continue
            }

            const record = deps.decode(await deps.openData(masterKey, raw))
            // `seed` is untyped but real: both versions' `commit` strip it
            // alongside `privateKey`, and both `decode` revivers rebuild it. It
            // must never reach `k/`, which is plaintext. Where a record carries
            // only a seed it *is* the material — canary.13's `importSeed` puts
            // the seed in `privateKey`, so the two never hold different secrets.
            const { privateKey, seed, ...metadata } = record as KeyData & {
                seed?: Uint8Array
            }
            const material = privateKey ?? seed

            if (material) {
                deps.storage.set(
                    MATERIAL_PREFIX + record.id,
                    await deps.sealData(masterKey, base64.encode(material)),
                )
            }
            deps.storage.set(
                METADATA_PREFIX + record.id,
                deps.encode(withoutSecrets(metadata)),
            )

            if (
                !(await isMigrationDurable(
                    deps,
                    record.id,
                    material,
                    masterKey,
                ))
            ) {
                result.failed += 1
                continue
            }

            deps.storage.remove(id)
            result.migrated += 1
        } catch (err) {
            console.error(
                `[provider] keystore layout migration: entry ${id} left unmigrated`,
                err,
            )
            result.failed += 1
        }
    }

    return result
}
