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

import { useCallback, useRef } from 'react'
import {
    hdIndexOf,
    signingKeyOn,
    type LocalAccount,
} from '@perawallet/wallet-core-accounts'
import {
    BACKUP_ACCESS_DOMAIN,
    indicesToEntropy,
    kmsCore,
    useKMS,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import { bytesToHex, logger } from '@perawallet/wallet-core-shared'
import { backupAdapterFor, backupSeedReference } from '../../chain-adapter'
import type { SerializeHdResolver } from '../sync/types'

type KMS = ReturnType<typeof useKMS>

/** Through the mnemonic session rather than the raw entropy secret, so the
 *  seed's ACL gates the recovery phrase the same way it gates the root. */
const readEntropyHex = async (
    executeWithMnemonic: KMS['executeWithMnemonic'],
    keyPairId: string,
): Promise<string> =>
    executeWithMnemonic(keyPairId, BACKUP_ACCESS_DOMAIN, indices => {
        const entropy = indicesToEntropy(indices)
        try {
            return bytesToHex(entropy)
        } finally {
            zeroBytes(entropy)
        }
    })

const readSeedHex = async (
    withExportedKey: KMS['withExportedKey'],
    seedKeyId: string,
): Promise<string | null> =>
    withExportedKey(seedKeyId, BACKUP_ACCESS_DOMAIN, keyData =>
        keyData.privateKey ? bytesToHex(keyData.privateKey) : '',
    )

const cached = async (
    cache: Map<string, string>,
    key: string,
    compute: () => Promise<string>,
): Promise<string> => {
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const value = await compute()
    cache.set(key, value)
    return value
}

/** Resolves null when the seed is unavailable, which skips that account.
 *  `seedHex`/`entropyHex` are hex; `seedFirstDerivedAddress` is the chain's seed reference. */
export const useResolveHdSeedForBackup = (): SerializeHdResolver => {
    const { seedIdOf, withExportedKey, executeWithMnemonic } = useKMS()
    // Both are public and fixed for a given key id, and deriving them is most
    // of what a sync spends on an HD account, on every run.
    const seedReferences = useRef(new Map<string, string>())
    const publicKeys = useRef(new Map<string, string>())

    return useCallback<SerializeHdResolver>(
        async (account: LocalAccount) => {
            const adapter = backupAdapterFor()
            const keyPairId = signingKeyOn(account, adapter.chainId)
            const index = hdIndexOf(account)
            const seedKeyId = seedIdOf(keyPairId)
            if (!keyPairId || !index || !seedKeyId) return null
            try {
                const seedFirstDerivedAddress = await cached(
                    seedReferences.current,
                    seedKeyId,
                    () => backupSeedReference(seedKeyId),
                )
                const publicKeyHex = await cached(
                    publicKeys.current,
                    keyPairId,
                    async () => {
                        const child = await adapter.deriveHdAccount(
                            kmsCore,
                            seedKeyId,
                            index,
                        )
                        return bytesToHex(child.publicKey)
                    },
                )
                const entropyHex = await readEntropyHex(
                    executeWithMnemonic,
                    keyPairId,
                )

                const seedHex = await readSeedHex(withExportedKey, seedKeyId)
                if (!seedHex) return null

                return {
                    seedFirstDerivedAddress,
                    publicKeyHex,
                    seedHex,
                    entropyHex,
                }
            } catch (error) {
                logger.warn('useResolveHdSeedForBackup: resolve failed', {
                    error:
                        error instanceof Error ? error.message : String(error),
                })
                return null
            }
        },
        [seedIdOf, withExportedKey, executeWithMnemonic],
    )
}
