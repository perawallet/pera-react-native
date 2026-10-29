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

// A separate entry so ChainIcon gets the logos without chain-ui.ts's transaction UI and viem.
import type { ComponentType } from 'react'
import type { SvgProps } from 'react-native-svg'
import {
    isEvmChainId,
    type ChainId,
    type EvmChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import ArbitrumIcon from '@assets/icons/chains/arbitrum.svg'
import AvalancheIcon from '@assets/icons/chains/avalanche.svg'
import BaseIcon from '@assets/icons/chains/base.svg'
import BscIcon from '@assets/icons/chains/bsc.svg'
import EthereumIcon from '@assets/icons/chains/ethereum.svg'
import PolygonIcon from '@assets/icons/chains/polygon.svg'

// Partial on purpose: a chain added without a logo keeps the initials placeholder.
const EVM_CHAIN_ICONS: Partial<Record<EvmChainId, ComponentType<SvgProps>>> = {
    ethereum: EthereumIcon,
    base: BaseIcon,
    bsc: BscIcon,
    arbitrum: ArbitrumIcon,
    avalanche: AvalancheIcon,
    polygon: PolygonIcon,
}

export const ethereumChainIcon = (
    chainId: ChainId,
): Optional<ComponentType<SvgProps>> =>
    isEvmChainId(chainId) ? EVM_CHAIN_ICONS[chainId] : undefined

// Total, so a chain added without a coin icon fails to compile. L2s that pay
// gas in ETH draw the ETH coin, not their own logo.
const EVM_NATIVE_ASSET_ICONS: Record<EvmChainId, ComponentType<SvgProps>> = {
    ethereum: EthereumIcon,
    base: EthereumIcon,
    arbitrum: EthereumIcon,
    bsc: BscIcon,
    avalanche: AvalancheIcon,
    polygon: PolygonIcon,
}

export const ethereumNativeAssetIcon = (
    chainId: ChainId,
): Optional<ComponentType<SvgProps>> =>
    isEvmChainId(chainId) ? EVM_NATIVE_ASSET_ICONS[chainId] : undefined
