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
    writeNativePasskeyEntry,
} from '@perawallet/wallet-core-passkeys'
import type { PasskeyImportFn, PasskeyImportSummary } from '../sync/types'

/** Resolves a seed's BIP39 entropy from the first-derived address the payload
 *  names. Injected because it needs a KMS session, which the engine has no
 *  access to. `null` means the wallet is not on this device. */
export type SeedEntropyResolver = (
    seedAddress: string,
) => Promise<Uint8Array | null>

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
            const mainKeys = new Map<string, Uint8Array | null>()

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

                    if (!mainKeys.has(payload.seedAddress)) {
                        const entropy = await resolveSeedEntropy(
                            payload.seedAddress,
                        )
                        mainKeys.set(
                            payload.seedAddress,
                            entropy === null
                                ? null
                                : await derivePasskeyMainKey(entropy),
                        )
                    }
                    const mainKey = mainKeys.get(payload.seedAddress) ?? null
                    if (mainKey === null) {
                        summary.skipped.push({
                            credentialId,
                            reason: 'seed-missing',
                        })
                        continue
                    }

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
                        count: payload.counter,
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

            return summary
        },
        [resolveSeedEntropy],
    )

    return { importPasskeys }
}
