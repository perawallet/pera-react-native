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
    sealData,
    serializeKey,
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../types'
import {
    liftSecrets,
    normalizeCanary13Record,
    type Canary13Record,
    type LiftedMaterial,
} from '../canary13'

/**
 * Seals `bytes` under `key` and confirms the write reads back, so a truncated
 * or silently-dropped write is caught before the plaintext it replaces is
 * rewritten. Throws rather than returning a flag: the caller's `catch` leaves
 * the whole record untouched for a later build.
 */
const sealAndVerify = async (
    { storage, subtle }: PeraMigrationContext,
    masterKey: Uint8Array,
    key: string,
    bytes: Uint8Array,
): Promise<void> => {
    const encoded = base64.encode(bytes)
    storage.set(key, await sealData(subtle, masterKey, encoded))

    const written = storage.getString(key)
    if (
        written === undefined ||
        (await openData(subtle, masterKey, written)) !== encoded
    ) {
        throw new Error('the sealed material did not read back')
    }
}

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
        let pending: Promise<Uint8Array> | undefined
        const unlock = () => (pending ??= context.masterKeyForRead())

        for (const id of ids) {
            const raw = storage.getString(METADATA_PREFIX + id)
            if (raw === undefined) continue

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

                // Decided from the plaintext record alone: a canary.19 ed25519
                // record always carries `signAlgorithm`, so its absence is what
                // marks material still in canary.13's raw libsodium encoding.
                // Opening every ed25519 record just to measure it would cost a
                // prompt on stores that need nothing.
                const needsMaterial =
                    record.type === 'ed25519' &&
                    record.metadata?.signAlgorithm === undefined &&
                    hasMaterial

                const opened = needsMaterial
                    ? base64.decode(
                          await openData(
                              subtle,
                              await unlock(),
                              storage.getString(materialKey)!,
                          ),
                      )
                    : undefined

                const { metadata, material } = normalizeCanary13Record({
                    record: stripped,
                    material: opened,
                    hasMaterial,
                })

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
                    await sealAndVerify(
                        context,
                        await unlock(),
                        materialKey,
                        material,
                    )
                }

                for (const entry of lifted) {
                    const key = MATERIAL_PREFIX + entry.id
                    // The record that owns an id is the authority on its
                    // material; an embedded copy may be stale and must never
                    // overwrite it.
                    if (storage.getString(key) !== undefined) continue
                    await sealAndVerify(
                        context,
                        await unlock(),
                        key,
                        entry.bytes,
                    )
                }

                storage.set(METADATA_PREFIX + id, next)
            } catch {
                // No id and no field names: failures are recorded verbatim in
                // the migration report.
                utils.log?.warn(
                    'Could not normalise a keystore record; left untouched',
                    { module: utils.revision.module },
                    utils.revision.module,
                )
            }
        }
    },
}
