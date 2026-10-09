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

import { rehydrateAccountsStore } from '@perawallet/wallet-core-accounts'
import { chainModule as algorandChainModule } from '@perawallet/wallet-core-chain-algorand'
import {
    buildChainSetup,
    CHAIN_IDS,
    ChainHttpClientUnavailableError,
    registerChainSetup,
    type ChainCapabilityOverrides,
    type ChainContext,
    type ChainEndpoints,
    type ChainId,
    type ChainMode,
    type ChainSetup,
    type ChainSetupEntry,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainMode,
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import {
    config,
    getChainConfig,
    getPeraServicesConfig,
    peraServicesFor,
    UnconfiguredScopeError,
} from '@perawallet/wallet-core-config'
import { kmsCore } from '@perawallet/wallet-core-kms'
import {
    chainOverridesKey,
    readCapabilityOverrides,
    remoteConfigDefaultsRegistry,
} from '@perawallet/wallet-core-remote-config'
import { pinnedHostRegistry } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ethereumChainModule } from './ethereum-chain-module'

// Keyed by network id rather than resolved for the selected network: an EVM
// client is built for an explicit scope. A network without an RPC URL is left out.
const ethereumRpcEndpoints = (entry: ChainSetupEntry): ChainEndpoints =>
    Object.fromEntries(
        entry.module.descriptor.networks.flatMap(({ id }) => {
            try {
                const { rpcUrl } = getChainConfig({
                    chainId: 'ethereum',
                    networkId: id,
                })
                return [[id, rpcUrl]]
            } catch (error) {
                if (error instanceof UnconfiguredScopeError) return []
                throw error
            }
        }),
    )

const chainContextFor = (entry: ChainSetupEntry): ChainContext => ({
    getScope: () => ({
        chainId: entry.chainId,
        networkId: selectChainNetworkId(
            useNetworkStore.getState(),
            entry.chainId,
        ),
    }),
    getEndpoints: () =>
        entry.chainId === 'ethereum'
            ? ethereumRpcEndpoints(entry)
            : entry.endpoints,
    getPeraBackend: scope => ({
        baseUrl: getPeraServicesConfig(scope).backendUrl,
        services: peraServicesFor(scope),
    }),
    timeouts: {
        readMs: config.algodReadTimeout,
        submitMs: config.algodSubmitTimeout,
    },
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

/**
 * Must run before the platform initializes remote config, which seeds these
 * defaults. The overrides key is declared for every chain, enabled or not, so
 * a kill switch can reach a chain this build doesn't register.
 */
export const declareChainPlatformInputs = (setup: ChainSetup): void => {
    remoteConfigDefaultsRegistry.declare(
        Object.fromEntries(CHAIN_IDS.map(id => [chainOverridesKey(id), ''])),
    )
    for (const { enabled, module } of setup) {
        if (!enabled) continue
        if (module.remoteConfigDefaults) {
            remoteConfigDefaultsRegistry.declare(module.remoteConfigDefaults)
        }
        if (module.pinnedHosts) {
            pinnedHostRegistry.declare(module.pinnedHosts())
        }
    }
}

// The app picks which chains ship: generic packages only define the adapter
// registries and never import a chain package.
export const registerChainAdapters = (): void => {
    const { chains } = getProvider()
    chains.setCapabilityOverrides(readCapabilityLayers)
    const setup = buildChainSetup(config.chains, {
        algorand: algorandChainModule,
        ethereum: ethereumChainModule,
    })
    registerChainSetup(setup, chains, chainContextFor)
    declareChainPlatformInputs(setup)
    // Its migration decodes persisted accounts through the adapters just registered.
    void rehydrateAccountsStore()
}
