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
    sealData,
    serializeKey,
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../types'
import {
    hasNestedMaterial,
    liftSecrets,
    type Canary13Record,
    type LiftedMaterial,
} from '../canary13'

/**
 * The storage key `@algorandfoundation/provider-migrations` serialises its
 * revision map under. Excluded by the same literal upstream's `isFlatCandidate`
 * uses: a ledger pointed at this keystore's MMKV instance must never be opened
 * as a record, and the scan must not raise a prompt on its account.
 */
const MIGRATIONS_LEDGER_KEY = '@algorandfoundation/provider-migrations'

const isFlatCandidate = (key: string): boolean =>
    !key.startsWith(MATERIAL_PREFIX) &&
    !key.startsWith(METADATA_PREFIX) &&
    key !== MIGRATIONS_LEDGER_KEY

/**
 * Writes the split pair for one record and drops the flat copy, returning
 * `false` if anything failed to read back.
 *
 * Copy, verify, delete: the flat record is the only copy of this material until
 * both new buckets are confirmed readable, so it is removed last and only on
 * success. On failure the buckets this call introduced are rolled back — a
 * stray `k/<id>` would otherwise be a metadata record whose material never
 * landed, and the driver only scans `k/`.
 */
const adopt = async (
    { storage, subtle }: PeraMigrationContext,
    masterKey: Uint8Array,
    storageKey: string,
    record: Canary13Record,
    own: Uint8Array,
): Promise<boolean> => {
    const ownerId = record.id ?? storageKey

    const lifted: LiftedMaterial[] = []
    const stripped = liftSecrets(record, ownerId, lifted) as Canary13Record

    const materialKey = MATERIAL_PREFIX + storageKey
    const metadataKey = METADATA_PREFIX + storageKey
    const hadMaterial = storage.getString(materialKey) !== undefined

    try {
        storage.set(
            materialKey,
            await sealData(subtle, masterKey, base64.encode(own)),
        )

        // Material lifted out of nested carriers is re-protected under the id
        // that owns it rather than dropped. An id already holding sealed
        // material keeps it: that record is the authority on its own key, and
        // an embedded copy may be stale.
        for (const entry of lifted) {
            const key = MATERIAL_PREFIX + entry.id
            if (key === materialKey) continue
            if (storage.getString(key) !== undefined) continue
            storage.set(
                key,
                await sealData(subtle, masterKey, base64.encode(entry.bytes)),
            )
        }

        storage.set(
            metadataKey,
            serializeKey({ ...stripped, id: ownerId } as Canary13Record),
        )

        const writtenMetadata = storage.getString(metadataKey)
        const writtenMaterial = storage.getString(materialKey)
        if (
            writtenMetadata === undefined ||
            decode(writtenMetadata).id !== ownerId ||
            writtenMaterial === undefined ||
            (await openData(subtle, masterKey, writtenMaterial)) !==
                base64.encode(own)
        ) {
            throw new Error('the split pair did not read back')
        }
    } catch {
        storage.remove(metadataKey)
        if (!hadMaterial) storage.remove(materialKey)
        return false
    }

    storage.remove(storageKey)
    return true
}

/**
 * Adopts, ahead of upstream, every flat canary.13 record that would otherwise
 * have private key bytes written to disk in the clear.
 *
 * Upstream's `adoptLegacyRecords` destructures a flat record as
 * `const { privateKey, seed, ...meta } = keyData` and writes
 * `serializeKey(meta)` into the **plaintext** `k/` bucket. It strips only
 * *top-level* material. An HD-derived record carries its parent under
 * `metadata.rootKey`, `privateKey` included — sealed and safe while canary.13
 * sealed the whole record, unencrypted the moment that metadata is copied
 * verbatim into `k/`.
 *
 * That is why this cannot be a repair running after adoption: by then the
 * plaintext has already hit MMKV, and MMKV does not securely erase. If a later
 * revision fails or the app is killed, the bytes stay there.
 *
 * Only the both-top-level-**and**-nested record is at risk, and only it is
 * taken here. A record whose material is only top level is stripped correctly
 * by upstream. One whose material is only nested is reported by upstream as
 * carrying no material and left flat, so nothing of it reaches `k/` at all.
 * Narrowing to the hazard keeps this revision's blast radius to the records
 * that need it.
 *
 * MMKV keys are scanned before the master key is touched, so a device with
 * nothing to adopt raises no biometric prompt at launch. A missing master key
 * is a fresh install rather than a failure — exactly upstream's reading.
 */
export const migration: Migration<PeraMigrationContext> = {
    id: 2,
    name: 'lift-nested-material',
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
            if (error instanceof MasterKeyNotFoundError) return
            throw error
        }

        for (const storageKey of candidates) {
            const sealed = storage.getString(storageKey)
            if (sealed === undefined) continue

            let record: Canary13Record
            try {
                record = decode(
                    await openData(subtle, masterKey, sealed),
                ) as Canary13Record
            } catch {
                // Another process's record, or not a record at all. Upstream's
                // adoption pass reports it; failing the module here would
                // reject `keystore.ready` and stop the app booting.
                continue
            }

            // Matches upstream's own material test exactly. A record it would
            // report as carrying no material is left flat by it, so nothing of
            // it ever reaches the plaintext bucket.
            const own = record.privateKey ?? record.seed
            if (!(own instanceof Uint8Array)) continue
            if (!hasNestedMaterial(record)) continue

            if (!(await adopt(context, masterKey, storageKey, record, own))) {
                // No id, no field names, no byte counts: failures are recorded
                // verbatim in the migration report.
                utils.log?.warn(
                    'Could not lift nested material from a flat record; left untouched for upstream adoption',
                    { module: utils.revision.module },
                    utils.revision.module,
                )
            }
        }
    },
}
