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
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../types'
import { wipeBytes } from '../sealing'
import {
    sealNativeCredentialRecord,
    toNativeByteArray,
} from '../nativeCredentialRecord'

/**
 * Re-writes the flat bare-id record the native Android/iOS passkey credential
 * provider reads, for every passkey credential upstream's `adopt-flat-records`
 * (revision `0002` of `@algorandfoundation/react-native-keystore`'s own
 * manifest) has just split into `k/`+`m/`.
 *
 * Neither provider reads a credential from `k/`+`m/`. iOS's only
 * credential-from-keystore path, `allKeystoreCredentials()`, guards on
 * `dataArray(keyData["publicKey"])` **and** `dataArray(keyData["privateKey"])`
 * — `dataArray` only accepts a JSON number array, and a split `k/` record's
 * `publicKey` is `{"$u8": …}` with no `privateKey` field at all, so the guard
 * fails silently. Android's `credentialFromMetadataRecord` sets
 * `privateKey = ""` and re-derives on demand, which cannot reproduce a
 * migrated Pera 6 credential (case-sensitive `userName` matching versus the
 * provider's lowercasing, and a missing `parentKeyId`/`scheme` that pins the
 * wrong derivation scheme). See `packages/passkeys/src/native/README.md`.
 *
 * So upstream's adoption — which runs immediately before this module, as the
 * keystore package's own revision `0002` — silently destroys every migrated
 * credential's provider-visible copy: it decrypts the flat record fine (its
 * `{iv,tag,content}` envelope and base64url-of-JSON-with-number-arrays
 * plaintext are exactly the shapes `adoptLegacyRecords`/`decode` accept), sees
 * a top-level `privateKey` `Uint8Array`, and adopts it — writing `k/`+`m/`
 * and deleting the flat original the provider needs.
 *
 * This is deliberately a full dual-write, not a rename: the split copy stays
 * (the keystore's own reactive store needs it, and Task 7 depends on it being
 * there), and the flat copy comes back beside it. It is not redundant with
 * the split copy — they serve two different readers on two different
 * layouts, and only one of those readers (either provider) can be changed by
 * shipping a new native build, not by this migration.
 *
 * Cheap and side-effect-free when there is nothing to do: the `k/` bucket is
 * scanned and decoded (plaintext, no master key) first, and the master key is
 * touched only if at least one credential is missing its flat copy. A record
 * whose material cannot be reached (no master key, an unreadable seal) is
 * left alone and recorded through `declined` rather than failing the module —
 * that would reject `keystore.ready` and stop the app booting.
 */

const PASSKEY_CREDENTIAL_TYPES: ReadonlySet<string> = new Set([
    'hd-derived-p256',
    'xhd-derived-p256',
])

export const migration: Migration<PeraMigrationContext> = {
    id: 2,
    name: 'rematerialize-passkey-credentials',
    up: async (
        context: PeraMigrationContext,
        utils: MigrationUtils,
    ): Promise<void> => {
        const { storage, subtle } = context

        const pending: { id: string; metadataRaw: string }[] = []
        for (const key of storage.getAllKeys()) {
            if (!key.startsWith(METADATA_PREFIX)) continue
            const id = key.slice(METADATA_PREFIX.length)

            // Already has a flat copy — idempotent no-op, and cheaper than
            // decoding to find out nothing changed.
            if (storage.getString(id) !== undefined) continue

            const metadataRaw = storage.getString(key)
            if (metadataRaw === undefined) continue

            try {
                const record = decode(metadataRaw)
                if (!PASSKEY_CREDENTIAL_TYPES.has(record.type)) continue
            } catch {
                // Not a record this keystore wrote in the plaintext k/ shape.
                continue
            }

            pending.push({ id, metadataRaw })
        }

        if (pending.length === 0) return

        let masterKey: Uint8Array
        try {
            masterKey = await context.masterKeyForRead()
        } catch (error) {
            if (error instanceof MasterKeyNotFoundError) {
                // A credential's k/+m/ pair cannot exist without a master key
                // having sealed its material, so this should not happen in
                // practice — but a vanished master key is "cannot reach the
                // material" the same as any other read failure, not a crash.
                context.declined.record(
                    utils.revision.module,
                    pending.map(({ id }) => id),
                )
                return
            }
            throw error
        }

        utils.secrets.put('keystore-master-key', masterKey)

        const untouched: string[] = []

        await utils.secrets.use('keystore-master-key', async unlocked => {
            for (const { id, metadataRaw } of pending) {
                const materialKey = MATERIAL_PREFIX + id
                const sealed = storage.getString(materialKey)
                if (sealed === undefined) {
                    untouched.push(id)
                    continue
                }

                let privateKey: Uint8Array | undefined
                try {
                    privateKey = base64.decode(
                        await openData(subtle, unlocked, sealed),
                    )

                    const metadata = decode(metadataRaw)
                    const { publicKey, ...rest } =
                        metadata as typeof metadata & {
                            publicKey?: Uint8Array
                        }

                    const flatRecord = {
                        ...rest,
                        ...(publicKey instanceof Uint8Array
                            ? { publicKey: toNativeByteArray(publicKey) }
                            : {}),
                        privateKey: toNativeByteArray(privateKey),
                    }

                    storage.set(
                        id,
                        await sealNativeCredentialRecord(
                            subtle,
                            unlocked,
                            flatRecord,
                        ),
                    )
                } catch (error) {
                    untouched.push(id)
                    // Storage keys, never key material — the only thing that
                    // makes an on-device failure diagnosable.
                    console.warn(
                        `[provider] rematerialize-passkey-credentials: entry ${id} left un-rematerialized: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    )
                } finally {
                    wipeBytes(privateKey)
                }
            }
        })

        utils.secrets.wipe('keystore-master-key')

        context.declined.record(utils.revision.module, untouched)

        if (untouched.length > 0) {
            utils.log?.warn(
                `Left ${untouched.length} passkey credential(s) un-rematerialized`,
                { entries: untouched },
                utils.revision.module,
            )
        }
    },
}
