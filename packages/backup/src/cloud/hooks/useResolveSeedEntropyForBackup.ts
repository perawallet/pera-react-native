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
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    SeedScheme,
    entropyChildIdOf,
    seedSchemeOf,
    useKMS,
    withSecret,
} from '@perawallet/wallet-core-kms'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import type { SeedEntropyResolver } from './useCloudBackupPasskeyImport'

/**
 * Mirrors `useResolveHdSeedForBackup`, but in reverse: that hook starts from
 * an account's `keyPairId` and derives its seed's first-derived address; this
 * one starts from that same address (all a restored passkey payload carries)
 * and searches the on-device bip39 seeds for the one that reproduces it.
 */
export const useResolveSeedEntropyForBackup = (): SeedEntropyResolver => {
    const { getDerivedPublicKey } = useKMS()

    return useCallback<SeedEntropyResolver>(
        async seedAddress => {
            const keys = getKeystoreStore().state.keys

            for (const key of keys) {
                if (seedSchemeOf(key) !== SeedScheme.Bip39) continue

                const firstDerived = await getDerivedPublicKey(
                    key.id,
                    0,
                    0,
                    BIP32DerivationType.Peikert,
                )
                if (encodeAlgorandAddress(firstDerived) !== seedAddress) {
                    continue
                }

                const entropyId = entropyChildIdOf(key.id, keys)
                if (!entropyId) return null

                // `withSecret` zeroes its buffer once the handler returns, so
                // the handler copies the bytes out rather than handing back
                // the reference itself.
                return withSecret(entropyId, entropy => new Uint8Array(entropy))
            }

            return null
        },
        [getDerivedPublicKey],
    )
}
