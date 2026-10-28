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

import { useMemo } from 'react'
import type {
    ChainId,
    ChainMode,
    ChainScope,
    NetworkId,
    WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainMode,
    selectChainNetworkId,
    useNetworkStore,
} from '../store/network-store'

export const useSelectedNetworkId = (chainId: ChainId): NetworkId =>
    useNetworkStore(state => selectChainNetworkId(state, chainId))

export const useSelectedChainMode = (chainId: ChainId): ChainMode =>
    useNetworkStore(state => selectChainMode(state, chainId))

export const useSelectedScope = (chainId: ChainId): ChainScope => {
    const networkId = useSelectedNetworkId(chainId)
    return useMemo(() => ({ chainId, networkId }), [chainId, networkId])
}

const SCOPE_SEPARATOR = '|'
const FIELD_SEPARATOR = '::'

export const useSelectedScopes = (
    chainIds: readonly ChainId[],
): ChainScope[] => {
    // A primitive, so the list keeps its identity until a chain or a selected
    // network actually changes.
    const key = useNetworkStore(state =>
        chainIds
            .map(chainId =>
                [chainId, selectChainNetworkId(state, chainId)].join(
                    FIELD_SEPARATOR,
                ),
            )
            .join(SCOPE_SEPARATOR),
    )
    return useMemo(
        () =>
            key
                ? key.split(SCOPE_SEPARATOR).map(scope => {
                      const [chainId, networkId] = scope.split(
                          FIELD_SEPARATOR,
                      ) as [ChainId, NetworkId]
                      return { chainId, networkId }
                  })
                : [],
        [key],
    )
}

// Chain-agnostic Pera endpoints (banners, inbox, currencies, integrity) route by
// this deployment, never by a scope: one deployment serves every chain of its tier.
export const useWalletDeployment = (): WalletMode =>
    useNetworkStore(state => state.mode)
