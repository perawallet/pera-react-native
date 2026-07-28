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

import { type Network, Networks } from './models/network'

/**
 * TEMPORARY — remove as real backends ship.
 *
 * Pera backend services (metadata, history, notifications, swap, onramp, card,
 * staking, banners, projects, nfd) exist only for MainNet and TestNet. Until a
 * network has its own deployment, its Pera-service traffic borrows TestNet's.
 *
 * This resolves SERVICE TARGETS ONLY. Chain identity — `algodUrl`,
 * `indexerUrl`, and above all `genesisHash` — must NEVER be resolved through
 * this module: doing so would let a TestNet transaction pass
 * `assertTransactionsMatchNetwork` while the user believes they are on another
 * chain.
 *
 * Removal: delete a row to put that network on its own backend. When the table
 * is empty, delete this file and its two importers
 * (`network-config.ts` and `packages/shared/src/api/query-client.ts`). The
 * `restrict-pera-service-fallback-importers` guardrail pins that importer list.
 */
export const PERA_SERVICE_FALLBACK: Partial<Record<Network, Network>> = {
    [Networks.betanet]: Networks.testnet,
    [Networks.fnet]: Networks.testnet,
    [Networks.localnet]: Networks.testnet,
}

/** The two networks that have real Pera service deployments. */
export type PeraServiceLane = typeof Networks.mainnet | typeof Networks.testnet

/** True when this network's Pera-service traffic is borrowed from another. */
export const hasPeraServiceFallback = (network: Network): boolean =>
    PERA_SERVICE_FALLBACK[network] !== undefined

/** The network whose Pera services should serve `network`. */
export const resolvePeraServiceNetwork = (network: Network): Network =>
    PERA_SERVICE_FALLBACK[network] ?? network

/**
 * Narrows to the lane that indexes the flat `mainnetX`/`testnetX` config pairs.
 * Everything that is not MainNet resolves to the TestNet lane.
 */
export const resolvePeraServiceLane = (network: Network): PeraServiceLane =>
    resolvePeraServiceNetwork(network) === Networks.mainnet
        ? Networks.mainnet
        : Networks.testnet
