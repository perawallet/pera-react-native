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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    BACKUP_ACCESS_DOMAIN,
    SeedScheme,
    canAccess,
    entropyChildIdOf,
    seedSchemeOf,
    withSecret,
} from '@perawallet/wallet-core-kms'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { backupSeedReference } from '../../chain-adapter'
import type { SeedEntropyResolver } from './useCloudBackupPasskeyImport'

/**
 * The local id of the on-device bip39 seed whose first-derived address is
 * `seedAddress` (all a restored passkey payload carries), or `null` when no
 * seed matches, it denies the backup domain, or it has no entropy child.
 * Deriving the address runs in the keystore engine, so no secret is read.
 */
export const resolveBackupSeedKeyId = async (
    seedAddress: string,
    chainId: ChainId,
): Promise<Nullable<string>> => {
    const keys = getKeystoreStore().state.keys

    for (const key of keys) {
        if (seedSchemeOf(key) !== SeedScheme.Bip39) continue
        if ((await backupSeedReference(key.id, chainId)) !== seedAddress) {
            continue
        }
        if (!canAccess(key, BACKUP_ACCESS_DOMAIN)) return null
        return entropyChildIdOf(key.id, keys) ? key.id : null
    }

    return null
}

/**
 * Mirrors `useResolveHdSeedForBackup`, but in reverse: that hook starts from
 * an account's `keyPairId` and derives its seed's first-derived address; this
 * one starts from that same address and reads the matching seed's entropy.
 */
export const useResolveSeedEntropyForBackup = (
    chainId: ChainId,
): SeedEntropyResolver => {
    return useCallback<SeedEntropyResolver>(
        async seedAddress => {
            const seedKeyId = await resolveBackupSeedKeyId(seedAddress, chainId)
            if (seedKeyId === null) return null

            const entropyId = entropyChildIdOf(
                seedKeyId,
                getKeystoreStore().state.keys,
            )
            if (!entropyId) return null

            // `withSecret` zeroes its buffer once the handler returns, so the
            // handler copies the bytes out rather than handing back the
            // reference itself.
            const entropy = await withSecret(
                entropyId,
                secret => new Uint8Array(secret),
            )
            return entropy == null ? null : { seedKeyId, entropy }
        },
        [chainId],
    )
}
