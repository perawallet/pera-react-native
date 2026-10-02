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
    p256PrivateKeyToSpkiDer,
    passkeyMainKeyIdFromSeedKeyId,
    writeNativePasskeyEntry,
} from '@perawallet/wallet-core-passkeys'
import { handOffSecret, zeroBytes } from '@perawallet/wallet-core-kms'
import type { PasskeyBackupPayload } from '../models'
import type {
    PasskeyImportFn,
    PasskeyImportSummary,
    PasskeySkipReason,
} from '../sync/types'

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

type SeedCache = Map<string, { seedKeyId: string; mainKey: Uint8Array } | null>

/** `privateKey` is owned by whoever receives this and must be zeroed. */
type ResolvedKey =
    | { privateKey: Uint8Array; parentKeyId?: string }
    | { skip: PasskeySkipReason }

export const useCloudBackupPasskeyImport = (
    resolveSeedEntropy: SeedEntropyResolver,
): UseCloudBackupPasskeyImportResult => {
    /** Only for a credential backed up without its `passkey-secrets/` item, by
     *  a build that re-derived every credential from its seed. */
    const keyFromSeed = useCallback(
        async (
            payload: PasskeyBackupPayload,
            seeds: SeedCache,
        ): Promise<ResolvedKey> => {
            const { seedAddress, identity, counter } = payload
            if (seedAddress == null || identity == null) {
                return { skip: 'secret-missing' }
            }

            if (!seeds.has(seedAddress)) {
                const resolved = await resolveSeedEntropy(seedAddress)
                try {
                    seeds.set(
                        seedAddress,
                        resolved === null
                            ? null
                            : {
                                  seedKeyId: resolved.seedKeyId,
                                  mainKey: handOffSecret(
                                      await derivePasskeyMainKey(
                                          resolved.entropy,
                                      ),
                                  ),
                              },
                    )
                } finally {
                    if (resolved !== null) zeroBytes(resolved.entropy)
                }
            }
            const seed = seeds.get(seedAddress) ?? null
            if (seed === null) return { skip: 'seed-missing' }

            const derived = await derivePasskeyCredential({
                mainKey: seed.mainKey,
                origin: payload.origin,
                identity,
                counter: counter ?? 0,
            })
            return {
                privateKey: derived.privateKey,
                // Without this the credential is unprovable from its seed here.
                parentKeyId: passkeyMainKeyIdFromSeedKeyId(seed.seedKeyId),
            }
        },
        [resolveSeedEntropy],
    )

    const importPasskeys = useCallback<PasskeyImportFn>(
        async passkeys => {
            const summary: PasskeyImportSummary = {
                imported: 0,
                skipped: [],
                failed: [],
            }
            // PBKDF2 at 210k iterations is the expensive part, and a user's
            // credentials cluster on one seed.
            const seeds: SeedCache = new Map()

            try {
                for (const { payload, secret } of passkeys) {
                    const { credentialId } = payload
                    let privateKey: Uint8Array | null = null
                    try {
                        if (nativePasskeyEntryExists(credentialId)) {
                            summary.skipped.push({
                                credentialId,
                                reason: 'already-present',
                            })
                            continue
                        }

                        const resolved =
                            secret !== null
                                ? {
                                      privateKey: decodeFromBase64(
                                          secret.privateKey,
                                      ),
                                  }
                                : await keyFromSeed(payload, seeds)
                        if ('skip' in resolved) {
                            summary.skipped.push({
                                credentialId,
                                reason: resolved.skip,
                            })
                            continue
                        }
                        privateKey = resolved.privateKey

                        // The collecting device checked this key, so a mismatch is
                        // corruption; written, every signature would be rejected.
                        let publicKeySpkiDer: string | null
                        try {
                            publicKeySpkiDer = encodeToBase64(
                                p256PrivateKeyToSpkiDer(privateKey),
                            )
                        } catch {
                            publicKeySpkiDer = null
                        }
                        if (publicKeySpkiDer !== payload.publicKeySpkiDer) {
                            logger.warn(
                                'useCloudBackupPasskeyImport: private key does not match the public key',
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
                            userId: payload.userId ?? payload.identity ?? '',
                            userName: payload.userName,
                            displayName: payload.displayName,
                            publicKeySpkiDer: decodeFromBase64(
                                payload.publicKeySpkiDer,
                            ),
                            privateKey,
                            // The proven string, not a guess: `identityCandidates`
                            // cannot rebuild it from the fields this device writes.
                            identity: payload.identity,
                            // The derivation counter; the WebAuthn signature
                            // counter starts fresh on this device.
                            counter: payload.counter,
                            parentKeyId: resolved.parentKeyId,
                            createdAtMs: payload.createdAt,
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
                    } finally {
                        // writeNativePasskeyEntry seals its own copy; this one is ours.
                        zeroBytes(privateKey)
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
        [keyFromSeed],
    )

    return { importPasskeys }
}
