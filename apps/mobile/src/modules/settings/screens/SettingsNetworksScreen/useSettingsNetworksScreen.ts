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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'

type UseSettingsNetworksScreenResult = {
    chains: { chainId: ChainId }[]
    isChainHeaderVisible: boolean
}

export const useSettingsNetworksScreen =
    (): UseSettingsNetworksScreenResult => {
        const chains = getProvider()
            .chains.list()
            .map(descriptor => ({ chainId: descriptor.id }))

        return { chains, isChainHeaderVisible: chains.length > 1 }
    }
