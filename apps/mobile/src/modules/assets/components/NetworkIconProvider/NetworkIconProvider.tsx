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

import React, { createContext, useContext, type ComponentType } from 'react'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { AssetIcon } from '@components/AssetIcon'

export type NetworkIconProps = {
    chainId: ChainId
    /** Pixels. */
    size: number
}

// Only renders outside the app shell (isolated tests) fall back to the native
// coin; the shell provides the chain icons.
const NativeAssetNetworkIcon = ({ chainId }: NetworkIconProps) => (
    <AssetIcon
        asset={nativeAssetFor(chainId)}
        size='xs'
    />
)

// Injected rather than imported: chain-ui's registry reaches this barrel
// through Algorand's chain UI, so importing ChainIcon here closes a load cycle.
const NetworkIconContext = createContext<ComponentType<NetworkIconProps>>(
    NativeAssetNetworkIcon,
)

export type NetworkIconProviderProps = {
    NetworkIcon: ComponentType<NetworkIconProps>
    children: React.ReactNode
}

export const NetworkIconProvider = ({
    NetworkIcon,
    children,
}: NetworkIconProviderProps) => (
    <NetworkIconContext.Provider value={NetworkIcon}>
        {children}
    </NetworkIconContext.Provider>
)

export const useNetworkIcon = (): ComponentType<NetworkIconProps> =>
    useContext(NetworkIconContext)
