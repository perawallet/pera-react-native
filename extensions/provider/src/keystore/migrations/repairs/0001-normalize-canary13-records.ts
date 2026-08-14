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
    MATERIAL_PREFIX,
    METADATA_PREFIX,
    decode,
    openData,
    serializeKey,
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../types'
import {
    liftSecrets,
    normalizeCanary13Record,
    type Canary13Record,
    type LiftedMaterial,
} from '../canary13'
import {
    createJournal,
    holdsSameMaterial,
    placeSecrets,
    sealAndVerify,
    wipeBytes,
} from '../sealing'

/**
 * Rewrites already-split `k/<id>` records from canary.13's vocabulary into the
 * one canary.19 reads.
 *
 * Re-indexing the storage keys — upstream's `adopt-flat-records`, which runs
 * immediately before this module — is not enough. `sign` dispatches on `type`
 * and reads `metadata.signAlgorithm`, `format` and, for XHD children,
 * `metadata.bip44Path`. A record that keeps canary.13's spelling decodes fine
 * and then throws inside the host `importKey`: a wallet that shows a balance it
 * cannot spend.
 *
 * It also lifts any key material still nested inside a plaintext `k/` record.
 * Preflight revision `0002` normally beats upstream's adoption to those, so
 * this is a backstop for a record that adoption reached first because the
 * preflight pass could not complete — the bytes are sealed under the id that
 * owns them, never dropped.
 *
 * The master key is read lazily and at most once, only for a record that
 * actually needs material touched, so a store needing nothing but renames
 * raises no biometric prompt at launch. A record whose material cannot be
 * reached — no master key on a fresh install, an unreadable seal — is left
 * exactly as it was for a later build to retry, rather than failing the module
 * and rejecting `keystore.ready`.
 */
export const migration: Migration<PeraMigrationContext> = {
    id: 1,
    name: 'normalize-canary13-records',
    up: async (
        context: PeraMigrationContext,
        utils: MigrationUtils,
    ): Promise<void> => {
        const { storage, subtle } = context
        const ids = storage
            .getAllKeys()
            .filter(key => key.startsWith(METADATA_PREFIX))
            .map(key => key.slice(METADATA_PREFIX.length))

        // Memoised so a store full of canary.13 records costs one Keychain read
        // and one prompt, and so a rejection is not retried once per record.
        // The scratch takes ownership on first read, so the plaintext master
        // key is zeroed when the runner settles even if this revision throws.
        let pending: Promise<Uint8Array> | undefined
        const unlock = () =>
            (pending ??= context.masterKeyForRead().then(key => {
                utils.secrets.put('keystore-master-key', key)
                return key
            }))

        const untouched: string[] = []

        for (const id of ids) {
            const raw = storage.getString(METADATA_PREFIX + id)
            if (raw === undefined) continue

            const journal = createJournal(storage)
            const opened: (Uint8Array | undefined)[] = []

            try {
                let record: Canary13Record
                try {
                    record = decode(raw) as Canary13Record
                } catch {
                    // Not a record this keystore wrote. Rewriting it would be
                    // guesswork; leaving it costs nothing.
                    continue
                }

                const materialKey = MATERIAL_PREFIX + id
                const hasMaterial = storage.getString(materialKey) !== undefined

                const lifted: LiftedMaterial[] = []
                const stripped = liftSecrets(
                    record,
                    record.id ?? id,
                    lifted,
                ) as Canary13Record
                for (const entry of lifted) opened.push(entry.bytes)

                // Decided from the plaintext record alone: a canary.19 ed25519
                // record always carries `signAlgorithm`, so its absence is what
                // marks material still in canary.13's raw libsodium encoding.
                // Opening every ed25519 record just to measure it would cost a
                // prompt on stores that need nothing.
                const needsMaterial =
                    record.type === 'ed25519' &&
                    record.metadata?.signAlgorithm === undefined &&
                    hasMaterial

                const current = needsMaterial
                    ? base64.decode(
                          await openData(
                              subtle,
                              await unlock(),
                              storage.getString(materialKey)!,
                          ),
                      )
                    : undefined
                opened.push(current)

                const { metadata, material } = normalizeCanary13Record({
                    record: stripped,
                    material: current,
                    hasMaterial,
                })
                opened.push(material)

                const next = serializeKey(metadata)
                if (
                    lifted.length === 0 &&
                    material === undefined &&
                    next === serializeKey(record)
                ) {
                    continue
                }

                // Material first, and verified, so `k/` never comes to describe
                // bytes that did not land. The plaintext copy is only dropped
                // once its sealed replacement is proven readable.
                if (material) {
                    journal.track(materialKey)
                    await sealAndVerify(
                        context,
                        await unlock(),
                        materialKey,
                        material,
                    )
                }

                // Two different secrets resolving to one bucket cannot both be
                // sealed, and this is checked before the first write so the
                // second is never silently dropped.
                const placements = placeSecrets(lifted)
                let placeable = placements !== undefined

                for (const [owner, bytes] of placements ?? []) {
                    const key = MATERIAL_PREFIX + owner
                    if (storage.getString(key) === undefined) {
                        journal.track(key)
                        await sealAndVerify(context, await unlock(), key, bytes)
                        continue
                    }

                    // The bucket is taken. For another record's id that is
                    // correct and lossless: that record owns its key and its
                    // material is on disk, so the embedded copy is redundant.
                    if (owner !== (record.id ?? id)) continue

                    // For this record's own id it is not. A carrier with no
                    // `id` of its own inherits this one, so stripping it from
                    // `k/` while `m/` holds *different* bytes would destroy a
                    // secret nothing else has. Only drop it when it is provably
                    // the same material already sealed there.
                    if (
                        !(await holdsSameMaterial(
                            context,
                            await unlock(),
                            key,
                            bytes,
                        ))
                    ) {
                        placeable = false
                        break
                    }
                }

                if (!placeable) {
                    journal.rollback()
                    untouched.push(id)
                    console.warn(
                        `[provider] normalize-canary13-records: entry ${id} left untouched; a nested secret has nowhere to be sealed`,
                    )
                    continue
                }

                journal.set(METADATA_PREFIX + id, next)
            } catch (error) {
                // `remove` would not undo this: a half-written `m/` entry that
                // survives is read as authoritative by the next run, which
                // would then strip the plaintext copy and leave the key
                // nowhere. Restore every key this record touched instead.
                journal.rollback()
                untouched.push(id)
                // Storage keys, not key material — the identifiers
                // `migrateKeystoreLayout` already logs, and the only thing
                // that makes an on-device failure diagnosable.
                console.warn(
                    `[provider] normalize-canary13-records: entry ${id} left untouched: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                )
            } finally {
                for (const bytes of opened) wipeBytes(bytes)
            }
        }

        utils.secrets.wipe('keystore-master-key')

        if (untouched.length > 0) {
            utils.log?.warn(
                `Left ${untouched.length} keystore record(s) un-normalised`,
                { entries: untouched },
                utils.revision.module,
            )
        }
    },
}
