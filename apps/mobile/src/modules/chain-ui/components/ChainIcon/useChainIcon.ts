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

import type { ComponentType } from 'react'
import type { SvgProps } from 'react-native-svg'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import { getInitials, type Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { chainUiFor } from '../../registry'

export type UseChainIconResult = {
    Icon: Optional<ComponentType<SvgProps>>
    /** Drawn when the chain has no icon yet. */
    initials: string
    displayName: string
}

export const useChainIcon = (chainId: ChainId): UseChainIconResult => {
    const displayName = chainDisplayNameOf(chainId) ?? chainId
    const { chains } = getProvider()
    const Icon = chains.has(chainId)
        ? chainUiFor(chains.get(chainId).descriptor.family).icon?.(chainId)
        : undefined
    return { Icon, initials: getInitials(displayName), displayName }
}
