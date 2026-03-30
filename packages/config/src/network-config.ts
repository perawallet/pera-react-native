/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Network, Networks } from './models/network'
import { config } from './main'

export type NetworkConfig = {
    network: Network
    backendUrl: string
    algodUrl: string
    indexerUrl: string
    explorerUrl: string
    bidaliBaseUrl: string
    bidaliApiKey: string
    isTestnet: boolean
    isMainnet: boolean
}

export const isTestnet = (network: Network) => network === Networks.testnet
export const isMainnet = (network: Network) => network === Networks.mainnet

export const getNetworkConfig = (network: Network): NetworkConfig => {
    const isMain = isMainnet(network)

    return {
        network,
        isMainnet: isMain,
        isTestnet: !isMain,
        backendUrl: isMain
            ? config.mainnetBackendUrl
            : config.testnetBackendUrl,
        algodUrl: isMain ? config.mainnetAlgodUrl : config.testnetAlgodUrl,
        indexerUrl: isMain
            ? config.mainnetIndexerUrl
            : config.testnetIndexerUrl,
        explorerUrl: isMain
            ? config.mainnetExplorerUrl
            : config.testnetExplorerUrl,
        bidaliBaseUrl: isMain 
            ? config.mainnetBidaliBaseUrl
            : config.testnetBidaliBaseUrl,
        bidaliApiKey: isMain
            ? config.mainnetBidaliApiKey
            : config.testnetBidaliApiKey
    }
}
