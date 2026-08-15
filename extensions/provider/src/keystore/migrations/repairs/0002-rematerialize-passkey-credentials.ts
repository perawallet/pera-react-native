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
 * manifest) has just split into `k/`+`m/`, then removes that split pair.
 *
 * Neither provider reads a credential from `k/`+`m/`. iOS's only
 * credential-from-keystore path, `allKeystoreCredentials()`, guards on
 * `dataArray(keyData["publicKey"])` **and** `dataArray(keyData["privateKey"])`
 * — `dataArray` only accepts a JSON number array, and a split `k/` record's
 * `publicKey` is `{"$u8": …}` with no `privateKey` field at all, so the guard
 * fails silently. Android's `CredentialRepository.getCredential` is worse than
 * silent: it tries the split layout *first* and returns on a hit before ever
 * reading the bare id, so a surviving `k/` record — even beside a freshly
 * rematerialized flat one — wins the race, `credentialFromMetadataRecord`
 * returns `privateKey = ""`, and `getKeyPair` falls through to
 * `createDomainKeyPair`: re-derivation, which cannot reproduce a migrated
 * Pera 6 credential (case-sensitive `userName` matching versus the provider's
 * lowercasing, and a missing `parentKeyId`/`scheme` that pins the wrong
 * derivation scheme). See `packages/passkeys/src/native/README.md`.
 *
 * So upstream's adoption — which runs immediately before this module, as the
 * keystore package's own revision `0002` — silently destroys every migrated
 * credential's provider-visible copy: it decrypts the flat record fine (its
 * `{iv,tag,content}` envelope and base64url-of-JSON-with-number-arrays
 * plaintext are exactly the shapes `adoptLegacyRecords`/`decode` accept), sees
 * a top-level `privateKey` `Uint8Array`, and adopts it — writing `k/`+`m/`
 * and deleting the flat original the provider needs.
 *
 * This is an **un-adopt**, not a dual-write: a dual-write (rematerialize the
 * flat copy, leave `k/`+`m/` beside it) fixes iOS but not Android, because
 * Android's split-first lookup shadows the flat copy it can't read from.
 * Removing `k/`+`m/` once the flat copy is proven readable also dissolves two
 * dependent symptoms of the split surviving: Android's `getAllCredentials()`
 * listing the same credential twice (it appends from both branches with no
 * dedup by `credentialId`), and `deleteCredential` only ever removing bare-id
 * candidates, so a deleted credential reappears from its orphaned `k/`+`m/`
 * pair. This restores exactly the pre-branch layout shipped Pera 7 works on
 * today — the keystore's own reactive store never needs a passkey credential
 * in `k/`+`m/` (unlike the derivation parent, which stays there; see the
 * README). The `k/`+`m/` **layout** doesn't need to survive, but its
 * **content** does: upstream's own `migrateLegacyPasskeys` stamps
 * `metadata.migration` onto a legacy credential's `k/` record moments before
 * this module deletes it, and that flag is Task 8's entire signal for
 * surfacing "needs migration" in the passkeys UI. The `...rest` spread below
 * carries `metadata` (and anything else unrecognised) into the flat record
 * unmodified, so the flag rides along by construction — pinned by a test, not
 * merely assumed.
 *
 * Copy, verify, delete — never the reverse, and the delete is a **second,
 * separate** step from the write-and-verify: once verification passes, a
 * failure removing `k/`+`m/` must never roll back the flat write, because
 * that copy is already proven correct and destroying it would leave nothing
 * readable at all (the rollback that undoes a bad *write* must not also catch
 * a bad *removal*). A write that lands as garbage is worse than one that
 * never lands: the next run's resume gate (`is k/ still there?`) would still
 * reprocess it, but the previous (better) flat copy is gone in the meantime.
 * So a failed verification rolls the flat write back and leaves `k/`+`m/`
 * exactly as adoption left them, recorded via `declined` — a durable note, not
 * a retry: nothing in this codebase currently reads the declined sentinel
 * (Task 4 already deferred that), so a declined credential's `k/` shadow is
 * permanent until that follow-up lands, not merely until "a later pass."
 *
 * Cheap and side-effect-free when there is nothing to do: the `k/` bucket is
 * scanned and decoded (plaintext, no master key) first, and the master key is
 * touched only if at least one credential is pending. A record whose material
 * cannot be reached (no master key, an unreadable seal, a failed
 * verification) is left alone and recorded through `declined` rather than
 * failing the module — that would reject `keystore.ready` and stop the app
 * booting.
 */

const PASSKEY_CREDENTIAL_TYPES: ReadonlySet<string> = new Set([
    'hd-derived-p256',
    'xhd-derived-p256',
])

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
    a.length === b.length && a.every((byte, index) => byte === b[index])

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

            // "Done" is the absence of k/, not the presence of a flat copy:
            // a launch killed between the flat write and the k/+m/ removals
            // leaves both a flat record AND k/ behind, and the work is not
            // finished until k/ is gone (Android's split-first lookup means a
            // surviving k/ still shadows a correct flat copy beside it). So a
            // record with a pre-existing flat copy is deliberately
            // reprocessed here, not skipped.
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
                const metadataKey = METADATA_PREFIX + id
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

                    const sealedFlat = await sealNativeCredentialRecord(
                        subtle,
                        unlocked,
                        flatRecord,
                    )
                    storage.set(id, sealedFlat)

                    // Read the write back through the provider's own
                    // envelope+decode before trusting it enough to delete the
                    // only other copy of this credential's material. Both key
                    // fields, not just the private one — iOS's
                    // allKeystoreCredentials() guards on dataArray(publicKey)
                    // AND dataArray(privateKey), so a mangled publicKey is
                    // just as fatal and just as silent as a mangled
                    // privateKey.
                    const reopened = decode(
                        await openData(subtle, unlocked, sealedFlat),
                    ) as { privateKey?: Uint8Array; publicKey?: Uint8Array }
                    const publicKeyVerified =
                        !(publicKey instanceof Uint8Array) ||
                        (reopened.publicKey instanceof Uint8Array &&
                            bytesEqual(reopened.publicKey, publicKey))
                    if (
                        !(reopened.privateKey instanceof Uint8Array) ||
                        !bytesEqual(reopened.privateKey, privateKey) ||
                        !publicKeyVerified
                    ) {
                        throw new Error(
                            `rematerialized record for ${id} did not read back`,
                        )
                    }
                } catch (error) {
                    // Undoes a flat write this iteration may have made before
                    // failing — a `remove` on a key that was never set (an
                    // earlier failure, before any write) is a harmless no-op.
                    // Leaving a written-but-unverified flat copy behind is the
                    // dangerous case: the next run's idempotency check sees it
                    // and treats the credential as already done.
                    storage.remove(id)
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
                    continue
                } finally {
                    wipeBytes(privateKey)
                }

                // Reached only once the flat copy is provably readable. A
                // failure from here on must never roll back to storage.remove
                // the flat write above — that copy is already proven correct,
                // and destroying it here would leave nothing readable at all.
                // Worst case, the split pair lingers for a later pass to
                // retry (harmless: the next run's resume gate reprocesses any
                // credential whose k/ is still present).
                try {
                    // Un-adopt: only now is it safe to drop the pair the
                    // provider can't use (see the module doc for why leaving
                    // it would shadow the flat copy on Android).
                    storage.remove(metadataKey)
                    storage.remove(materialKey)
                } catch (error) {
                    untouched.push(id)
                    console.warn(
                        `[provider] rematerialize-passkey-credentials: entry ${id} rematerialized but left with an orphaned k/+m/ pair: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    )
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
