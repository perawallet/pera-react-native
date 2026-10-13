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
