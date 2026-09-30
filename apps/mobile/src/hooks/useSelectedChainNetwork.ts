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

import type { ChainId, NetworkId } from '@perawallet/wallet-core-chain-contract'
import {
    CUSTOM_NETWORK_ID,
    useSelectedNetworkId,
} from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useLanguage } from '@hooks/useLanguage'

export type UseSelectedChainNetworkResult = {
    networkId: NetworkId
    isMainnet: boolean
    label: string
}

/**
 * The store holds nothing for a chain nobody has picked a network on, and an
 * id its descriptor no longer lists, so both resolve to the descriptor's
 * default mainnet rather than to a blank selection.
 */
export const useSelectedChainNetwork = (
    chainId: ChainId,
): UseSelectedChainNetworkResult => {
    const storedId = useSelectedNetworkId(chainId)
    const { t } = useLanguage()

    if (storedId === CUSTOM_NETWORK_ID) {
        return {
            networkId: CUSTOM_NETWORK_ID,
            isMainnet: false,
            label: t('common.network_label.custom'),
        }
    }

    const networks =
        getProvider()
            .chains.list()
            .find(descriptor => descriptor.id === chainId)?.networks ?? []
    const selected =
        networks.find(network => network.id === storedId) ??
        networks.find(
            network => network.tier === 'mainnet' && network.isDefaultForTier,
        )

    if (!selected) {
        return { networkId: storedId, isMainnet: false, label: storedId }
    }
    return {
        networkId: selected.id,
        isMainnet: selected.tier === 'mainnet',
        label: selected.displayName,
    }
}
