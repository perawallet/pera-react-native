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
import {
    DP256_DEFAULT_ITERATIONS,
    DP256_DEFAULT_KEY_LENGTH_BYTES,
    DP256_DEFAULT_SALT,
    genDerivedMainKeyWithSubtle,
} from '@algorandfoundation/keystore-core'
import type { PeraMigrationContext } from '../types'
import { safeErrorMessage, safeWarn } from '../safeLog'
import { sealAndVerify, wipeBytes } from '../sealing'
import { PASSKEY_MAIN_KEY_SCHEME, passkeyMainKeyId } from '../../passkeyMainKey'

/**
 * Back-fills the deterministic-P256 passkey main key for a wallet created
 * before `usePasskeyMainKey` existed.
 *
 * The main key is PBKDF2-HMAC-SHA512 over the wallet's **BIP39 entropy**, not
 * over the XHD extended root: `generateDP256Main` hands `withSeed` its parent's
 * stored bytes unchanged (`wantSeed: false`, `keystore-core@1.0.0-canary.3`
 * `dist/create.js:449-462`), and Pera keeps that entropy in a `secret-key`
 * child tagged `{parentKeyId, entropyKey: true}` (`entropyChildMetadata`,
 * `@perawallet/wallet-core-kms`). The record written here is the same shape
 * `generateDP256Main` writes (`create.js:463-471`), because `deriveDomainKey`
 * accepts a parent only when `type === 'hd-root-key'` and
 * `metadata.scheme === 'pbkdf2-p256'` (`create.js:774`).
 *
 * Exactly one main key is minted per device, never one per wallet root. Both
 * native providers resolve the derivation parent with
 * `selectParentKey(candidates, requestedScheme)`, which for a new credential
 * takes `candidates.first { scheme == pbkdf2-p256 }`
 * (`PasskeyCredentialStore.swift:99-107`, `KeystoreRecords.kt:290`), so a
 * second main key would not be additive — it would make which secret new
 * credentials derive from depend on scan order. `usePasskeyMainKey` short-
 * circuits on the same device-wide basis.
 *
 * Reaching the entropy needs the master key, so this revision **can raise a
 * biometric prompt** — but only when there is genuinely a main key to mint:
 * the decision is made entirely from the plaintext `k/` bucket first, and a
 * store that already has a `pbkdf2-p256` root (or no wallet root at all) never
 * touches material.
 *
 * Nothing here fails the module. A rejecting `up` lands in `report.failed`,
 * which throws `MigrationFailedError` (`provider-migrations` `apply.js:148`)
 * and rejects `keystore.ready` (`react-native-keystore` `extension.js:109`),
 * blocking boot — and because the ledger is written only after `up` resolves,
 * it would do so again on every launch. A wallet with no main key still works:
 * `selectParentKey` falls back to `candidates.first`, so new credentials go on
 * deriving from the XHD root exactly as they did before this revision existed,
 * and already-issued ones are unaffected either way (they pin their scheme).
 * So every failure path here declines and logs instead.
 */

type RootRecord = { id: string; entropyChildId?: string }

const metadataOf = (record: unknown): Record<string, unknown> => {
    const meta = (record as { metadata?: unknown }).metadata
    return meta && typeof meta === 'object'
        ? (meta as Record<string, unknown>)
        : {}
}

export const migration: Migration<PeraMigrationContext> = {
    id: 3,
    name: 'mint-passkey-main-key',
    up: async (
        context: PeraMigrationContext,
        utils: MigrationUtils,
    ): Promise<void> => {
        const { storage, subtle } = context

        let allKeys: string[]
        try {
            allKeys = storage.getAllKeys()
        } catch {
            return
        }

        const rootIds: string[] = []
        const entropyChildByParent = new Map<string, string>()

        for (const key of allKeys) {
            if (!key.startsWith(METADATA_PREFIX)) continue
            const id = key.slice(METADATA_PREFIX.length)

            let raw: string | undefined
            try {
                raw = storage.getString(key)
            } catch {
                continue
            }
            if (raw === undefined) continue

            let record: { type?: unknown }
            try {
                record = decode(raw) as { type?: unknown }
            } catch {
                // Not a record this keystore wrote in the plaintext k/ shape.
                continue
            }

            const meta = metadataOf(record)

            if (record.type === 'hd-root-key') {
                // Already done. Returning mid-scan is safe because this is an
                // abort, not a skip: no work has been committed yet.
                if (meta.scheme === PASSKEY_MAIN_KEY_SCHEME) return
                rootIds.push(id)
                continue
            }

            // All three clauses matter: `parentKeyId` alone also matches every
            // Algo25/Falcon/passkey child (`useAlgo25.ts:92`), and PBKDF2ing
            // one of those instead of the BIP39 entropy would mint a main key
            // no mnemonic reproduces.
            if (
                record.type === 'secret-key' &&
                meta.entropyKey === true &&
                typeof meta.parentKeyId === 'string'
            ) {
                const seen = entropyChildByParent.get(meta.parentKeyId)
                // Lowest id wins, for the same reason the roots are sorted.
                if (seen === undefined || id < seen) {
                    entropyChildByParent.set(meta.parentKeyId, id)
                }
            }
        }

        if (rootIds.length === 0) return

        // `getAllKeys()` order is not specified, and which root gets the
        // device's one main key must not depend on it.
        const target = rootIds
            .sort()
            .map(id => ({ id, entropyChildId: entropyChildByParent.get(id) }))
            .find(
                (root): root is Required<RootRecord> =>
                    root.entropyChildId !== undefined,
            )

        if (!target) {
            // An Algo25-only or watch-only wallet has no BIP39 entropy to
            // derive from. Expected, not a fault — but recorded, because it is
            // also what a lost entropy child looks like.
            safeWarn(
                `[provider] mint-passkey-main-key: no wallet root has an entropy child; left ${rootIds.length} root(s) without a passkey main key`,
            )
            context.declined.record(utils.revision.module, rootIds)
            return
        }

        let masterKey: Uint8Array
        try {
            masterKey = await context.masterKeyForRead()
        } catch (error) {
            // Every Keychain failure is "cannot reach the material", not just
            // `MasterKeyNotFoundError`: a cancelled or locked Keychain arrives
            // as a plain `Error`, and rethrowing it would reject `up` — which,
            // with the ledger written only afterwards, re-fails every launch.
            safeWarn(
                `[provider] mint-passkey-main-key: master key unavailable: ${safeErrorMessage(error)}`,
            )
            context.declined.record(utils.revision.module, [target.id])
            return
        }

        utils.secrets.put('keystore-master-key', masterKey)

        const mainKeyId = passkeyMainKeyId(target.id)
        let declined = false

        await utils.secrets.use('keystore-master-key', async unlocked => {
            let sealedEntropy: string | undefined
            try {
                sealedEntropy = storage.getString(
                    MATERIAL_PREFIX + target.entropyChildId,
                )
            } catch (error) {
                declined = true
                safeWarn(
                    `[provider] mint-passkey-main-key: could not read the entropy child of ${target.id}: ${safeErrorMessage(error)}`,
                )
                return
            }
            if (sealedEntropy === undefined) {
                declined = true
                safeWarn(
                    `[provider] mint-passkey-main-key: entropy child of ${target.id} has no sealed material`,
                )
                return
            }

            let entropy: Uint8Array | undefined
            let mainKey: Uint8Array | undefined
            try {
                entropy = base64.decode(
                    await openData(subtle, unlocked, sealedEntropy),
                )

                // The library's own derivation, so the back-filled key is
                // byte-identical to one `generateDP256Main` would mint. It has
                // no pure-JS fallback of its own — deliberately: upstream says
                // 210,000 `@noble/hashes` iterations *can* block Hermes for
                // minutes (`keystore-core` `dist/shims/dp256.js:28-29`), and
                // declining is the better failure. Not measured here.
                mainKey = await genDerivedMainKeyWithSubtle(
                    subtle,
                    entropy,
                    DP256_DEFAULT_SALT,
                    DP256_DEFAULT_ITERATIONS,
                    DP256_DEFAULT_KEY_LENGTH_BYTES,
                )

                await sealAndVerify(
                    context,
                    unlocked,
                    MATERIAL_PREFIX + mainKeyId,
                    mainKey,
                )

                // Metadata last: a `k/` root whose `m/` is missing is one the
                // providers select and then fail to open, which is worse than
                // no root at all (`selectParentKey` has already committed to
                // it by then).
                storage.set(
                    METADATA_PREFIX + mainKeyId,
                    serializeKey({
                        id: mainKeyId,
                        type: 'hd-root-key',
                        algorithm: 'P256',
                        extractable: false,
                        keyUsages: ['deriveBits', 'deriveKey'],
                        // `id` is restated inside `metadata` because
                        // `generateDP256Main` spreads its `params` there
                        // (`create.js:469`); keeping the shapes identical means
                        // a back-filled root and an app-minted one are the same
                        // record.
                        metadata: {
                            storage: 'bytes',
                            scheme: PASSKEY_MAIN_KEY_SCHEME,
                            parentKeyId: target.entropyChildId,
                            id: mainKeyId,
                        },
                        version: 1,
                    }),
                )
            } catch (error) {
                declined = true
                // Roll the `m/` write back so the next build re-derives from
                // the entropy rather than inheriting a half-written root. Safe
                // to drop unconditionally: this key is reproducible from the
                // entropy child, so nothing unrecoverable lives here.
                try {
                    storage.remove(MATERIAL_PREFIX + mainKeyId)
                } catch (rollbackError) {
                    safeWarn(
                        `[provider] mint-passkey-main-key: rollback of ${mainKeyId} failed, leaving disk state as-is: ${safeErrorMessage(rollbackError)}`,
                    )
                }
                safeWarn(
                    `[provider] mint-passkey-main-key: ${target.id} left without a passkey main key: ${safeErrorMessage(error)}`,
                )
            } finally {
                wipeBytes(entropy)
                wipeBytes(mainKey)
            }
        })

        utils.secrets.wipe('keystore-master-key')

        if (declined) {
            context.declined.record(utils.revision.module, [target.id])
            utils.log?.warn(
                'Left the wallet root without a passkey main key',
                { entries: [target.id] },
                utils.revision.module,
            )
        }
    },
}
