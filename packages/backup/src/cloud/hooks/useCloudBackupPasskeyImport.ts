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

import { useCallback } from 'react'
import {
    decodeFromBase64,
    encodeToBase64,
    logger,
} from '@perawallet/wallet-core-shared'
import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
    nativePasskeyEntryExists,
    passkeyMainKeyIdFromSeedKeyId,
    writeNativePasskeyEntry,
} from '@perawallet/wallet-core-passkeys'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import type { PasskeyImportFn, PasskeyImportSummary } from '../sync/types'

/** The owning seed as this device knows it. `seedKeyId` is local — the id the
 *  restoring device minted, not the one the collecting device had — and is what
 *  the written credential's `parentKeyId` has to point at. */
export type ResolvedSeed = {
    seedKeyId: string
    entropy: Uint8Array
}

/** Resolves a seed's BIP39 entropy from the first-derived address the payload
 *  names. Injected because it needs a KMS session, which the engine has no
 *  access to. `null` means the wallet is not on this device. */
export type SeedEntropyResolver = (
    seedAddress: string,
) => Promise<ResolvedSeed | null>

export type UseCloudBackupPasskeyImportResult = {
    importPasskeys: PasskeyImportFn
}

export const useCloudBackupPasskeyImport = (
    resolveSeedEntropy: SeedEntropyResolver,
): UseCloudBackupPasskeyImportResult => {
    const importPasskeys = useCallback<PasskeyImportFn>(
        async payloads => {
            const summary: PasskeyImportSummary = {
                imported: 0,
                skipped: [],
                failed: [],
            }
            // PBKDF2 at 210k iterations is the expensive part, and a user's
            // credentials cluster on one seed.
            const seeds = new Map<
                string,
                { seedKeyId: string; mainKey: Uint8Array } | null
            >()

            try {
                for (const payload of payloads) {
                    const { credentialId } = payload
                    try {
                        if (nativePasskeyEntryExists(credentialId)) {
                            summary.skipped.push({
                                credentialId,
                                reason: 'already-present',
                            })
                            continue
                        }

                        if (!seeds.has(payload.seedAddress)) {
                            const resolved = await resolveSeedEntropy(
                                payload.seedAddress,
                            )
                            seeds.set(
                                payload.seedAddress,
                                resolved === null
                                    ? null
                                    : {
                                          seedKeyId: resolved.seedKeyId,
                                          mainKey: await derivePasskeyMainKey(
                                              resolved.entropy,
                                          ),
                                      },
                            )
                            if (resolved !== null) zeroBytes(resolved.entropy)
                        }
                        const seed = seeds.get(payload.seedAddress) ?? null
                        if (seed === null) {
                            summary.skipped.push({
                                credentialId,
                                reason: 'seed-missing',
                            })
                            continue
                        }
                        const { mainKey, seedKeyId } = seed

                        const derived = await derivePasskeyCredential({
                            mainKey,
                            origin: payload.origin,
                            identity: payload.identity,
                            counter: payload.counter,
                        })

                        // The collecting device proved these inputs derive this key,
                        // so a disagreement here is corruption, not a wrong guess.
                        if (
                            encodeToBase64(derived.publicKeySpkiDer) !==
                            payload.publicKeySpkiDer
                        ) {
                            logger.warn(
                                'useCloudBackupPasskeyImport: derived key does not match',
                                { origin: payload.origin },
                            )
                            summary.skipped.push({
                                credentialId,
                                reason: 'pubkey-mismatch',
                            })
                            continue
                        }

                        await writeNativePasskeyEntry({
                            credentialId,
                            origin: payload.origin,
                            userId: payload.userId ?? payload.identity,
                            userName: payload.userName,
                            displayName: payload.displayName,
                            publicKeySpkiDer: decodeFromBase64(
                                payload.publicKeySpkiDer,
                            ),
                            privateKey: derived.privateKey,
                            // The proven string, not a guess: `identityCandidates`
                            // cannot rebuild it from the fields this device writes.
                            identity: payload.identity,
                            // The derivation counter, which is what
                            // `passkeyBackupInputs` re-derives from; the WebAuthn
                            // signature counter starts fresh on this device.
                            counter: payload.counter,
                            // Without this the credential is unprovable here, so
                            // the device that just restored it would report it as
                            // one it cannot back up.
                            parentKeyId:
                                passkeyMainKeyIdFromSeedKeyId(seedKeyId),
                        })
                        summary.imported += 1
                    } catch (error) {
                        summary.failed.push({
                            credentialId,
                            reason:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        })
                    }
                }
            } finally {
                // The cached keys outlive the call that derived them, so this
                // is the only place that can zero them.
                for (const seed of seeds.values()) {
                    if (seed) zeroBytes(seed.mainKey)
                }
            }

            return summary
        },
        [resolveSeedEntropy],
    )

    return { importPasskeys }
}
