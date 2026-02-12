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
import { Networks } from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import { getNetworkConfig, isMainnet, isTestnet } from '../network-config'

const AlgorandChainIDs = {
  mainnet: 416001,
  testnet: 416002,
}

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
      chainId: AlgorandChainIDs.mainnet,
      backendUrl: config.mainnetBackendUrl,
      algodUrl: config.mainnetAlgodUrl,
      indexerUrl: config.mainnetIndexerUrl,
      explorerUrl: config.mainnetExplorerUrl,
    })
  })

  test('getNetworkConfig returns correct testnet config', () => {
    const networkConfig = getNetworkConfig(Networks.testnet)

    expect(networkConfig).toEqual({
      network: Networks.testnet,
      isMainnet: false,
      isTestnet: true,
      chainId: AlgorandChainIDs.testnet,
      backendUrl: config.testnetBackendUrl,
      algodUrl: config.testnetAlgodUrl,
      indexerUrl: config.testnetIndexerUrl,
      explorerUrl: config.testnetExplorerUrl,
    })
  })
})
