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
import { AlgorandChainId } from '../models'

/**
 * The CAIP-configured (WalletConnect v1 `chainId`) session identity expected
 * for each network. A `Record`, not a fallback ladder — a future network
 * added to `Network` fails TypeScript here rather than silently resolving to
 * whatever the last `? :` branch happened to default to (the bug this table
 * replaces: every network past testnet used to compute `expectedChainId` as
 * `network === Networks.testnet ? AlgorandChainId.testnet :
 * AlgorandChainId.mainnet`, so betanet — which HAS a real registered id —
 * was rejected when presented correctly, and silently accepted MainNet's id
 * instead).
 *
 * - betanet has a real registered CAIP id (`416_003`) — use it.
 * - custom (an arbitrary developer-pointed node — LocalNet, an fnet instance,
 *   a private node) has NO registered CAIP id of its own; there is no
 *   registry entry for "whatever node you happen to be pointed at". It maps
 *   to TestNet's (`416_002`) because a dApp needs *some* id to establish a
 *   session at all. The real safety net is the genesis-hash assertion below,
 *   not this id.
 *
 * Signing stays safe regardless: a dApp that paired under a borrowed chain
 * id builds transactions with THAT chain's genesis hash, and
 * `assertTransactionsMatchNetwork` compares against the real active
 * network's genesis — a mismatch is rejected loudly at submit time. This
 * table only affects which session gets waved through and how it is
 * labelled in the UI, never what gets signed.
 *
 * `AlgorandChainId.all` (`4160`, matches any network) is a separate constant
 * and is unaffected by this table — every call site still checks it first.
 */
export const EXPECTED_CHAIN_ID_BY_NETWORK: Record<Network, AlgorandChainId> = {
    [Networks.mainnet]: AlgorandChainId.mainnet,
    [Networks.testnet]: AlgorandChainId.testnet,
    [Networks.betanet]: AlgorandChainId.betanet,
    [Networks.custom]: AlgorandChainId.testnet,
}

/** The chain id a WalletConnect session/request must present for `network`. */
export const getExpectedChainId = (network: Network): AlgorandChainId =>
    EXPECTED_CHAIN_ID_BY_NETWORK[network]
