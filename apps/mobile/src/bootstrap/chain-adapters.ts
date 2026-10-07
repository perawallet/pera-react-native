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

import { chainModule as algorandChainModule } from '@perawallet/wallet-core-chain-algorand'
import {
    buildChainSetup,
    ChainHttpClientUnavailableError,
    registerChainSetup,
    type ChainCapabilityOverrides,
    type ChainContext,
    type ChainId,
    type ChainMode,
    type ChainSetupEntry,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainMode,
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { config } from '@perawallet/wallet-core-config'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { readCapabilityOverrides } from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ethereumChainModule } from './ethereum-chain-module'

const chainContextFor = (entry: ChainSetupEntry): ChainContext => ({
    getScope: () => ({
        chainId: entry.chainId,
        networkId: selectChainNetworkId(
            useNetworkStore.getState(),
            entry.chainId,
        ),
    }),
    getEndpoints: () => entry.endpoints,
    // Nothing implements ChainHttpClient; a module that calls it must fail loudly.
    http: {
        request: () =>
            Promise.reject(new ChainHttpClientUnavailableError(entry.chainId)),
    },
    kms: kmsCore,
})

const readCapabilityLayers = (): ChainCapabilityOverrides => {
    const state = useNetworkStore.getState()
    const chainMode = Object.fromEntries(
        getProvider()
            .chains.list()
            .map(({ id }) => [id, selectChainMode(state, id)]),
    ) as Partial<Record<ChainId, ChainMode>>
    return { ...readCapabilityOverrides(), chainMode }
}

// The app picks which chains ship: generic packages only define the adapter
// registries and never import a chain package.
export const registerChainAdapters = (): void => {
    const { chains } = getProvider()
    chains.setCapabilityOverrides(readCapabilityLayers)
    registerChainSetup(
        buildChainSetup(config.chains, {
            algorand: algorandChainModule,
            ethereum: ethereumChainModule,
        }),
        chains,
        chainContextFor,
    )
}
