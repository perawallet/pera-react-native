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
import {
    hasNestedMaterial,
    liftSecrets,
    type Canary13Record,
    type LiftedMaterial,
} from '../canary13'
import {
    createJournal,
    placeSecrets,
    sealAndVerify,
    wipeBytes,
} from '../sealing'

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
 * `adopted` took the record; `declined` left it whole and flat by choice;
 * `failed` tried and rolled back. Only `adopted` removes anything.
 */
type AdoptOutcome = {
    outcome: 'adopted' | 'declined' | 'failed'
    reason?: string
}

/**
 * Writes the split pair for one record and drops the flat copy.
 *
 * Copy, verify, delete: the flat record is the only copy of this material until
 * every bucket is confirmed readable, so it is removed last and only on
 * success. On failure the journal restores every key this call touched to its
 * previous value — `remove` alone would not do, because a half-written `m/`
 * entry that survives is read as authoritative by the next run, which would
 * then strip the plaintext copy and leave the key nowhere.
 */
const adopt = async (
    context: PeraMigrationContext,
    masterKey: Uint8Array,
    id: string,
    record: Canary13Record,
    own: Uint8Array,
): Promise<AdoptOutcome> => {
    const { storage } = context

    const lifted: LiftedMaterial[] = []
    const stripped = liftSecrets(record, id, lifted) as Canary13Record

    const placements = placeSecrets(lifted, [[id, own]])
    if (placements === undefined) {
        return {
            outcome: 'declined',
            reason: 'two different secrets resolve to one material bucket',
        }
    }

    const journal = createJournal(storage)

    try {
        for (const [owner, bytes] of placements) {
            const key = MATERIAL_PREFIX + owner
            // An id already holding sealed material keeps it: that record is
            // the authority on its own key, its material is on disk either way,
            // and the embedded copy may be stale.
            if (owner !== id && storage.getString(key) !== undefined) continue

            journal.track(key)
            await sealAndVerify(context, masterKey, key, bytes)
        }

        const metadataKey = METADATA_PREFIX + id
        // `id` is restated rather than inherited, matching upstream's
        // `metaRecord = { ...meta, id: keyData.id ?? id }`: a record that never
        // carried an `id` field still needs one, because the driver reads it
        // back by it.
        journal.set(metadataKey, serializeKey({ ...stripped, id }))

        const written = storage.getString(metadataKey)
        if (written === undefined || decode(written).id !== id) {
            throw new Error('metadata did not read back')
        }
    } catch (error) {
        journal.rollback()
        return {
            outcome: 'failed',
            reason: error instanceof Error ? error.message : String(error),
        }
    } finally {
        // Lifted arrays are references into the decrypted record. The caller
        // wipes `own`; everything pulled out of the nesting is wiped here,
        // sealed or not.
        for (const entry of lifted) wipeBytes(entry.bytes)
    }

    storage.remove(id)
    return { outcome: 'adopted' }
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

        // The run-scoped scratch owns the plaintext master key from here, so it
        // is zeroed when the runner settles even if this revision throws.
        utils.secrets.put('keystore-master-key', masterKey)

        const untouched: string[] = []

        await utils.secrets.use('keystore-master-key', async unlocked => {
            for (const storageKey of candidates) {
                const sealed = storage.getString(storageKey)
                if (sealed === undefined) continue

                let record: Canary13Record
                try {
                    record = decode(
                        await openData(subtle, unlocked, sealed),
                    ) as Canary13Record
                } catch {
                    // Another process's record, or not a record at all.
                    // Upstream's adoption pass reports it; failing the module
                    // here would reject `keystore.ready` and stop the app
                    // booting.
                    continue
                }

                const own = record.privateKey ?? record.seed
                try {
                    // Matches upstream's own material test exactly. A record it
                    // would report as carrying no material is left flat by it,
                    // so nothing of it ever reaches the plaintext bucket.
                    if (!(own instanceof Uint8Array)) continue
                    if (!hasNestedMaterial(record)) continue

                    // The driver reads a record back at `k/<record.id>`, so a
                    // record whose id disagrees with its storage key cannot be
                    // split coherently under either. Unseen in practice, and
                    // leaving it flat costs nothing.
                    if (record.id !== undefined && record.id !== storageKey) {
                        untouched.push(storageKey)
                        continue
                    }

                    const { outcome, reason } = await adopt(
                        context,
                        unlocked,
                        storageKey,
                        record,
                        own,
                    )

                    if (outcome !== 'adopted') {
                        untouched.push(storageKey)
                        // Storage keys, not key material — the same identifiers
                        // `migrateKeystoreLayout` already logs, and the only
                        // thing that makes an on-device failure diagnosable.
                        console.warn(
                            `[provider] lift-nested-material: entry ${storageKey} left flat (${outcome}): ${reason}`,
                        )
                    }
                } finally {
                    // The decrypted record is finished with either way; its
                    // material must not outlive it in the heap.
                    wipeBytes(own instanceof Uint8Array ? own : undefined)
                }
            }
        })

        utils.secrets.wipe('keystore-master-key')

        if (untouched.length > 0) {
            utils.log?.warn(
                `Left ${untouched.length} flat record(s) unlifted; upstream adoption will handle them`,
                { entries: untouched },
                utils.revision.module,
            )
        }
    },
}
