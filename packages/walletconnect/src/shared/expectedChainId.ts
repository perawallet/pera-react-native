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

import type { NetworkId } from '@perawallet/wallet-core-chain-contract'
import { Networks, type Nullable } from '@perawallet/wallet-core-shared'
import { AlgorandWalletConnectChainId } from '../models'

/**
 * `custom` borrows TestNet's id because a dApp needs some CAIP id to open a
 * session at all; `assertTransactionsMatchNetwork` still rejects a genesis
 * mismatch at submit time, so this never decides what gets signed.
 */
const EXPECTED_CHAIN_ID_BY_NETWORK: ReadonlyMap<
    NetworkId,
    AlgorandWalletConnectChainId
> = new Map<NetworkId, AlgorandWalletConnectChainId>([
    [Networks.mainnet, AlgorandWalletConnectChainId.mainnet],
    [Networks.testnet, AlgorandWalletConnectChainId.testnet],
    [Networks.betanet, AlgorandWalletConnectChainId.betanet],
    [Networks.custom, AlgorandWalletConnectChainId.testnet],
])

/**
 * The chain id a WalletConnect session/request must present on `networkId`,
 * or `null` for a network with no id, which callers must reject.
 */
export const getExpectedChainId = (
    networkId: NetworkId,
): Nullable<AlgorandWalletConnectChainId> =>
    EXPECTED_CHAIN_ID_BY_NETWORK.get(networkId) ?? null
