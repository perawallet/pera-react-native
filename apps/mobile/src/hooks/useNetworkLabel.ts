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
import type { NetworkId } from '@perawallet/wallet-core-chain-contract'
import { Networks } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'

// Static keys: the i18n lint rules cannot verify an interpolated key.
const NETWORK_LABEL_KEYS: ReadonlyMap<NetworkId, string> = new Map([
    [Networks.mainnet, 'common.network_label.mainnet'],
    [Networks.testnet, 'common.network_label.testnet'],
    [Networks.betanet, 'common.network_label.betanet'],
    [Networks.custom, 'common.network_label.custom'],
])

/** An unknown network renders as its raw id: visible, never blank. */
export const useNetworkLabel = (): ((networkId: NetworkId) => string) => {
    const { t } = useLanguage()

    return useCallback(
        (networkId: NetworkId) => {
            const key = NETWORK_LABEL_KEYS.get(networkId)
            return key ? t(key) : networkId
        },
        [t],
    )
}
