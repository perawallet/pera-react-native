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
 * A candidate that carries nested material without any of its own is
 * deliberately left flat rather than adopted here: writing its metadata into
 * plaintext `k/` without lifting that nested secret first would leak it. That
 * combination is out of scope for this revision (tracked via `declined`, not
 * silently dropped) — unlike `0002`'s narrowing, which reasons only about the
 * plaintext-leak hazard, this one is also an availability gap: nothing in this
 * branch adopts that combination today.
 */
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
            if (error instanceof MasterKeyNotFoundError) return
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

                    if (hasNestedMaterial(record)) {
                        untouched.push(storageKey)
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
