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

import { Networks } from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useDeviceStore } from '@perawallet/wallet-core-platform-integration'

/**
 * Returns an instance of AlgorandClient based on the current network in device store.
 * This is a non-hook version and should be used in non-React contexts or where hooks cannot be used.
 * @returns {AlgorandClient}
 */
export const getAlgorandClient = (): AlgorandClient => {
  const network = useDeviceStore.getState().network
  const isMainnet = network === Networks.mainnet

  const algodConfig = {
    server: isMainnet ? config.mainnetAlgodUrl : config.testnetAlgodUrl,
    token: config.algodApiKey,
  }

  const indexerConfig = {
    server: isMainnet ? config.mainnetIndexerUrl : config.testnetIndexerUrl,
    token: config.algodApiKey,
  }

  return AlgorandClient.fromConfig({ algodConfig, indexerConfig })
}
