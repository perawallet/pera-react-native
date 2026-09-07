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
 * Un-adopts passkey credentials: rewrites the flat bare-id record the native
 * provider reads, then removes the `k/`+`m/` pair upstream's
 * `adopt-flat-records` revision just split them into. That revision runs
 * immediately before this one and destroys every migrated credential's
 * provider-visible copy, because neither provider can read a credential from
 * the split layout. See `packages/passkeys/src/native/README.md` for why.
 *
 * A dual-write is not enough. Android's `CredentialRepository.getCredential`
 * tries the split layout first and returns on a hit, so a surviving `k/` record
 * shadows a correct flat copy beside it. Removing the pair also dissolves two
 * dependent symptoms: `getAllCredentials()` listing a credential twice (it
 * appends from both branches with no dedup by `credentialId`), and
 * `deleteCredential` only removing bare-id candidates, so a deleted credential
 * reappears from its orphaned pair.
 *
 * The layout does not need to survive but its content does. Upstream's
 * `migrateLegacyPasskeys` stamps `metadata.migration` onto a legacy
 * credential's `k/` record moments before this module deletes it, and that flag
 * is what surfaces "needs migration" in the passkeys UI. The `...rest` spread
 * below carries it into the flat record by construction, pinned by a test.
 *
 * Copy, verify, delete, and never the reverse. The delete is a second, separate
 * step: once verification passes, a failure removing `k/`+`m/` must not roll
 * back the flat write, because that copy is already proven correct and
 * destroying it would leave nothing readable at all.
 *
 * There is usually no next run to lean on, because the runner records the
 * revision applied as soon as `up` resolves. So every storage mutation a
 * per-credential failure can trigger swallows its own failure: an escaping one
 * rejects `keystore.ready`, stops the app booting, and re-fails on every
 * subsequent launch. The resume gate below (is `k/` still there?) therefore
 * only helps a process killed mid-run. A completed decline is final.
 *
 * Idle runs are cheap: the `k/` bucket is scanned and decoded as plaintext
 * first, and the master key is touched only if a credential is pending.
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

        // Must not reject `up`: this is a scan, not even a single record.
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

            // "Done" is the absence of k/, not the presence of a flat copy: a
            // run killed between the write and the removals leaves both, and a
            // surviving k/ still shadows the flat copy. So a record that
            // already has a flat copy is reprocessed, not skipped.
            // Read failures here are skipped untracked because the scan does
            // not yet know this id names a passkey credential.
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
            // A pair cannot exist without a master key having sealed it, so a
            // cancelled or locked Keychain (a plain `Error`) is far likelier
            // than `MasterKeyNotFoundError`. Both mean the material is out of
            // reach, and both decline rather than reject.
            if (!(error instanceof MasterKeyNotFoundError)) {
                safeWarn(
                    `[provider] rematerialize-passkey-credentials: master key unavailable: ${safeErrorMessage(error)}`,
                )
            }
            context.declined.record(
                utils.revision.module,
                pending.map(({ id }) => id),
            )
            return
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
                // ledger marks it done regardless of outcome (unless the
                // ledger's own write fails too). So a failed removal here is
                // effectively permanent, not "a later pass" — declined
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
