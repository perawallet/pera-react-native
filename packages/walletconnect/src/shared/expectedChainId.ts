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

import { Networks, type Network } from '@perawallet/wallet-core-shared'
import { AlgorandWalletConnectChainId } from '../models'

/**
 * A `Record`, not a fallback ladder, so a new `Network` fails TypeScript here
 * instead of silently defaulting. `custom` borrows TestNet's id because a dApp
 * needs some CAIP id to open a session at all; `assertTransactionsMatchNetwork`
 * still rejects a genesis mismatch at submit time, so this never decides what gets signed.
 */
export const EXPECTED_CHAIN_ID_BY_NETWORK: Record<
    Network,
    AlgorandWalletConnectChainId
> = {
    [Networks.mainnet]: AlgorandWalletConnectChainId.mainnet,
    [Networks.testnet]: AlgorandWalletConnectChainId.testnet,
    [Networks.betanet]: AlgorandWalletConnectChainId.betanet,
    [Networks.custom]: AlgorandWalletConnectChainId.testnet,
}

/** The chain id a WalletConnect session/request must present for `network`. */
export const getExpectedChainId = (
    network: Network,
): AlgorandWalletConnectChainId => EXPECTED_CHAIN_ID_BY_NETWORK[network]
