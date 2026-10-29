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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    chainAccountOf,
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
import { useSeedReferencesStore } from '../store/seedReferencesStore'
import type { SeedSecretsCache, SerializeHdResolver } from '../sync/types'

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

const rememberedSeedReference = async (
    chainId: ChainId,
    seedKeyId: string,
): Promise<string> => {
    const key = `${chainId}|${seedKeyId}`
    const { references, setReference } = useSeedReferencesStore.getState()
    const remembered = references[key]
    if (remembered !== undefined) return remembered
    const reference = await backupSeedReference(seedKeyId, chainId)
    setReference(key, reference)
    return reference
}

/** Resolves null when the seed is unavailable, which skips that account.
 *  `seedHex`/`entropyHex` are hex; `seedFirstDerivedAddress` is the chain's seed reference. */
export const useResolveHdSeedForBackup = (
    chainId: ChainId,
): SerializeHdResolver => {
    const { seedIdOf, withExportedKey, executeWithMnemonic } = useKMS()
    // Public and fixed for a given key id; deriving it is most of what a sync
    // spends on an HD account on a chain whose address doesn't carry it.
    const publicKeys = useRef(new Map<string, string>())

    return useCallback<SerializeHdResolver>(
        async (account: LocalAccount, seedSecrets?: SeedSecretsCache) => {
            const adapter = backupAdapterFor(chainId)
            // An account with no key on this chain still backs up its other
            // chains; any of its keys finds the seed.
            const scopeKeyPairId = signingKeyOn(account, chainId)
            const keyPairId =
                scopeKeyPairId ??
                Object.values(account.chains).find(entry => entry?.keyPairId)
                    ?.keyPairId
            const index = hdIndexOf(account)
            const seedKeyId = seedIdOf(keyPairId)
            if (!keyPairId || !index || !seedKeyId) return null
            try {
                const seedFirstDerivedAddress = await rememberedSeedReference(
                    chainId,
                    seedKeyId,
                )
                const scopeAddress = chainAccountOf(account, chainId)?.address
                // Deriving commits the child key to the keystore, so a chain
                // whose address carries the key skips it.
                const resolvePublicKeyHex = async () => {
                    if (!scopeKeyPairId) return null
                    if (scopeAddress && adapter.publicKeyHexOf) {
                        return adapter.publicKeyHexOf(scopeAddress)
                    }
                    return cached(
                        publicKeys.current,
                        `${chainId}|${scopeKeyPairId}`,
                        async () => {
                            const child = await adapter.deriveHdAccount(
                                kmsCore,
                                seedKeyId,
                                index,
                            )
                            return bytesToHex(child.publicKey)
                        },
                    )
                }
                const publicKeyHex = await resolvePublicKeyHex()
                const readSecrets = async () => {
                    const entropyHex = await readEntropyHex(
                        executeWithMnemonic,
                        keyPairId,
                    )
                    const seedHex = await readSeedHex(
                        withExportedKey,
                        seedKeyId,
                    )
                    return seedHex ? { seedHex, entropyHex } : null
                }
                // Every account of a seed carries the same secrets, so a sync
                // reads them once rather than once per account.
                let secrets = seedSecrets?.get(seedKeyId)
                if (!secrets) {
                    secrets = readSecrets()
                    seedSecrets?.set(seedKeyId, secrets)
                }
                const resolved = await secrets
                if (!resolved) return null

                return { seedFirstDerivedAddress, publicKeyHex, ...resolved }
            } catch (error) {
                logger.warn('useResolveHdSeedForBackup: resolve failed', {
                    error:
                        error instanceof Error ? error.message : String(error),
                })
                return null
            }
        },
        [chainId, seedIdOf, withExportedKey, executeWithMnemonic],
    )
}
