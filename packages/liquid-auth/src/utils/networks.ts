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

import { type Network, Networks } from '@perawallet/wallet-core-config'
import type { LiquidAuthNetwork } from '../models'

// Canonical Algorand genesis IDs/hashes (stable network constants).
export const ALGORAND_GENESIS = {
    mainnet: {
        genesisId: 'mainnet-v1.0',
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
    },
    testnet: {
        genesisId: 'testnet-v1.0',
        genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
    },
} as const

/**
 * Returns the single Liquid Auth network entry matching the app's current
 * network. The app only models mainnet/testnet (see `Networks`).
 */
export const liquidAuthNetworksForCurrent = (
    network: Network,
): LiquidAuthNetwork[] => {
    const entry =
        network === Networks.testnet
            ? ALGORAND_GENESIS.testnet
            : ALGORAND_GENESIS.mainnet
    return [{ genesisHash: entry.genesisHash, genesisId: entry.genesisId }]
}
