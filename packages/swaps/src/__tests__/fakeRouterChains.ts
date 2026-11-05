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

import type {
    ChainId,
    ChainScope,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

type FakeNetwork = { id: NetworkId; caip2?: string }

/** Two chains the router knows, plus a custom network it doesn't. */
export const FAKE_ROUTER_CHAINS: Record<string, FakeNetwork[]> = {
    algorand: [
        { id: 'mainnet', caip2: 'fake-a:main' },
        { id: 'testnet', caip2: 'fake-a:test' },
        { id: 'custom' },
    ],
    ethereum: [{ id: 'mainnet', caip2: 'fake-b:main' }],
}

export const fakeCaip2Of = (scope: ChainScope): Nullable<string> =>
    FAKE_ROUTER_CHAINS[scope.chainId]?.find(
        network => network.id === scope.networkId,
    )?.caip2 ?? null

/** The slice of `getProvider().chains` the router id conversions read. */
export const fakeChains = {
    byCaip2: (caip2: string) => {
        for (const [chainId, networks] of Object.entries(FAKE_ROUTER_CHAINS)) {
            const network = networks.find(n => n.caip2 === caip2)
            if (network) return { chainId: chainId as ChainId, network }
        }
        return undefined
    },
    get: (chainId: ChainId) => ({
        descriptor: { networks: FAKE_ROUTER_CHAINS[chainId] ?? [] },
    }),
}

export const fakeRouterAssetId = (scope: ChainScope, assetId: string): string =>
    `${fakeCaip2Of(scope)}/token:${assetId}`
