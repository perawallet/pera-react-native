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

import { describe, test, expect } from 'vitest'
import { Networks } from '../models/network'
import { config } from '../main'
import { getNetworkConfig, isMainnet, isTestnet } from '../network-config'

describe('network-config', () => {
    test('isMainnet returns correct boolean', () => {
        expect(isMainnet(Networks.mainnet)).toBe(true)
        expect(isMainnet(Networks.testnet)).toBe(false)
    })

    test('isTestnet returns correct boolean', () => {
        expect(isTestnet(Networks.testnet)).toBe(true)
        expect(isTestnet(Networks.mainnet)).toBe(false)
    })

    test('getNetworkConfig returns correct mainnet config', () => {
        const networkConfig = getNetworkConfig(Networks.mainnet)

        expect(networkConfig).toEqual({
            network: Networks.mainnet,
            isMainnet: true,
            isTestnet: false,
            backendUrl: config.mainnetBackendUrl,
            algodUrl: config.mainnetAlgodUrl,
            indexerUrl: config.mainnetIndexerUrl,
            explorerUrl: config.mainnetExplorerUrl,
            bidaliBaseUrl: config.mainnetBidaliBaseUrl,
            bidaliApiKey: config.mainnetBidaliApiKey,
        })
    })

    test('getNetworkConfig returns correct testnet config', () => {
        const networkConfig = getNetworkConfig(Networks.testnet)

        expect(networkConfig).toEqual({
            network: Networks.testnet,
            isMainnet: false,
            isTestnet: true,
            backendUrl: config.testnetBackendUrl,
            algodUrl: config.testnetAlgodUrl,
            indexerUrl: config.testnetIndexerUrl,
            explorerUrl: config.testnetExplorerUrl,
            bidaliBaseUrl: config.testnetBidaliBaseUrl,
            bidaliApiKey: config.testnetBidaliApiKey,
        })
    })
})
