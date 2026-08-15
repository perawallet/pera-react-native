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
import { safeErrorMessage, safeWarn } from '../safeLog'
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
 * a bad *removal*).
 *
 * There is usually no "next run" to lean on: the runner records this revision
 * applied as soon as `up` resolves. For that to hold, every storage mutation
 * a per-credential failure can trigger has to be guarded against throwing
 * itself — the write-and-verify rollback, the k/+m/ removal, and
 * `declined.record` (guarded once, centrally, inside `createDeclinedRegister`
 * rather than at each of its five call sites) all swallow their own storage
 * failures rather than let one escape, precisely because an unguarded one
 * previously escaped `up`, rejected
 * `keystore.ready`, and — since the ledger only writes after `up`
 * resolves — re-ran and re-failed on every subsequent launch. With that
 * true, the resume gate above (`is k/ still there?`) only ever helps a
 * process that never reached `up`'s resolution at all — killed mid-run, not
 * merely a prior run that "declined." A completed decline is final:
 * recorded via `declined`, a durable note that nothing in this codebase
 * currently reads back (Task 4 already deferred that consuming revision),
 * so a declined credential's `k/` shadow is permanent, not revisited.
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

        // An MMKV read failing here must not reject `up` — same reasoning as
        // every other guard in this module: that would reject
        // `keystore.ready` and stop the app booting over a scan, not even a
        // single record.
        let allKeys: string[]
        try {
            allKeys = storage.getAllKeys()
        } catch {
            return
        }

        const pending: { id: string; metadataRaw: string }[] = []
        for (const key of allKeys) {
            if (!key.startsWith(METADATA_PREFIX)) continue
            const id = key.slice(METADATA_PREFIX.length)

            // "Done" is the absence of k/, not the presence of a flat copy:
            // a launch killed between the flat write and the k/+m/ removals
            // leaves both a flat record AND k/ behind, and the work is not
            // finished until k/ is gone (Android's split-first lookup means a
            // surviving k/ still shadows a correct flat copy beside it). So a
            // record with a pre-existing flat copy is deliberately
            // reprocessed here, not skipped.
            // Silently skipped, not `untouched`-tracked, on a read failure:
            // at this point the scan doesn't yet know `id` names a passkey
            // credential at all (that's decided below), so there's nothing
            // meaningful to decline yet — same reasoning as the decode
            // failure two lines down. The per-credential material read
            // further down tracks failures because by then `id` is already
            // a confirmed pending credential.
            let metadataRaw: string | undefined
            try {
                metadataRaw = storage.getString(key)
            } catch {
                continue
            }
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
                let sealed: string | undefined
                try {
                    sealed = storage.getString(materialKey)
                } catch {
                    untouched.push(id)
                    continue
                }
                if (sealed === undefined) {
                    untouched.push(id)
                    continue
                }

                // Under the resume gate above, `id` frequently already holds
                // a flat record a PREVIOUS run wrote and verified before
                // being killed before the k/+m/ removals — exactly the state
                // that gate exists to reprocess. A failure in THIS run must
                // restore that, not destroy it. A throw here means we don't
                // know what's there — NOT the same as confirmed absence — so
                // `priorFlatUnknown` routes the failure catch below to leave
                // the key untouched rather than treating "couldn't read it"
                // as "nothing to restore" and deleting a record that might be
                // perfectly good.
                let priorFlat: string | undefined
                let priorFlatUnknown = false
                try {
                    priorFlat = storage.getString(id)
                } catch {
                    priorFlatUnknown = true
                }

                let privateKey: Uint8Array | undefined
                try {
                    privateKey = base64.decode(
                        await openData(subtle, unlocked, sealed),
                    )

                    const metadata = decode(metadataRaw)
                    // Cast rather than `publicKey?: Uint8Array`: no separate
                    // "missing publicKey" guard follows on purpose.
                    // `toNativeByteArray(publicKey)` throws on `undefined`
                    // (declining exactly as an explicit guard would). A plain
                    // `number[]` rather than a real `Uint8Array` isn't caught
                    // by anything either, but is harmless: `toNativeByteArray`
                    // and the readback comparison below only need something
                    // iterable/indexable, so they treat it identically to a
                    // real `Uint8Array`. A falsy-but-defined `publicKey` —
                    // `''` or a plain `[]` — is a different, NOT harmless gap
                    // this reasoning doesn't cover: `toNativeByteArray('')`/
                    // `toNativeByteArray([])` both produce `[]` without
                    // throwing, the readback reconstructs an empty
                    // `Uint8Array`, and `bytesEqual`'s length+`.every` check
                    // passes vacuously comparing two empty values — so it
                    // verifies clean and the split pair is deleted, exactly
                    // the "no usable publicKey" case the deleted early guard
                    // existed to decline. (`new Uint8Array(0)` was accepted
                    // both before and after this revision too — this gap was
                    // never fully closed.) Not fixed here: reachability from a
                    // real writer wasn't established, so this is deferred
                    // rather than changed.
                    const { publicKey, ...rest } =
                        metadata as typeof metadata & {
                            publicKey: Uint8Array
                        }

                    const flatRecord = {
                        ...rest,
                        publicKey: toNativeByteArray(publicKey),
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
                    if (
                        !(reopened.privateKey instanceof Uint8Array) ||
                        !bytesEqual(reopened.privateKey, privateKey) ||
                        !(reopened.publicKey instanceof Uint8Array) ||
                        !bytesEqual(reopened.publicKey, publicKey)
                    ) {
                        throw new Error(
                            `rematerialized record for ${id} did not read back`,
                        )
                    }
                } catch (error) {
                    // Restore, don't remove: `priorFlat` is what makes this
                    // safe under the resume gate above. Only a credential
                    // with no pre-existing flat copy (a genuinely first
                    // attempt) gets `remove`d back to nothing. Wrapped in its
                    // own try: this rollback must never escape `up` either —
                    // a rejecting `up` rejects `keystore.ready` and, because
                    // the ledger only writes after `up` resolves, re-runs and
                    // re-fails this module on every subsequent launch.
                    if (priorFlatUnknown) {
                        // Couldn't read what was there before, so we don't
                        // know whether it's safe to remove or what to
                        // restore — nothing is done here, deliberately. That
                        // only leaves `id` "exactly as-is" for a failure
                        // BEFORE the flat write above (a decrypt or decode
                        // failure): the bare id never changed this run. A
                        // failure AFTER the write — the readback verification
                        // above throwing — has already overwritten the
                        // unknown prior record with the new (unverified) one,
                        // and doing nothing here means that unverified write
                        // is what's kept, not the unknown original.
                    } else {
                        try {
                            if (priorFlat === undefined) {
                                storage.remove(id)
                            } else {
                                storage.set(id, priorFlat)
                            }
                        } catch (rollbackError) {
                            safeWarn(
                                `[provider] rematerialize-passkey-credentials: entry ${id} rollback itself failed, leaving disk state as-is: ${safeErrorMessage(rollbackError)}`,
                            )
                        }
                    }
                    untouched.push(id)
                    // Storage keys, never key material — the only thing that
                    // makes an on-device failure diagnosable.
                    safeWarn(
                        `[provider] rematerialize-passkey-credentials: entry ${id} left un-rematerialized: ${safeErrorMessage(error)}`,
                    )
                    continue
                } finally {
                    wipeBytes(privateKey)
                }

                // Reached only once the flat copy is provably readable. A
                // failure from here on must never roll back to storage.remove
                // the flat write above — that copy is already proven correct,
                // and destroying it here would leave nothing readable at all.
                //
                // k/ removed before m/, deliberately: if the removal below
                // throws between the two calls, k/ is already gone and m/ is
                // merely orphaned — harmless, since nothing looks up material
                // without metadata, and the split is gone from the layout
                // Android's split-first lookup shadows. The reverse order
                // would leave a k/ with no material, and since this run
                // already resolves (this catch doesn't rethrow), there is no
                // next run to notice: this same revision only re-scans on a
                // process killed before `up` resolves, and once resolved the
                // ledger marks it done regardless of outcome. So a failed
                // removal here is permanent, not "a later pass" — declined
                // and logged, the same as any other un-rematerializable
                // credential.
                try {
                    // Un-adopt: only now is it safe to drop the pair the
                    // provider can't use (see the module doc for why leaving
                    // it would shadow the flat copy on Android).
                    storage.remove(metadataKey)
                    storage.remove(materialKey)
                } catch (error) {
                    untouched.push(id)
                    safeWarn(
                        `[provider] rematerialize-passkey-credentials: entry ${id} rematerialized but left with an orphaned k/+m/ pair: ${safeErrorMessage(error)}`,
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
