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
    ChainDescriptor,
    ChainId,
    ChainNetwork,
    ChainRegistry,
    NetworkTier,
} from '@perawallet/wallet-core-chain-contract'

export const TEST_CAIP2: Partial<Record<ChainId, Record<NetworkTier, string>>> =
    {
        algorand: {
            mainnet: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
            testnet: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
        },
        ethereum: { mainnet: 'eip155:1', testnet: 'eip155:11155111' },
    }

const networkOf = (tier: NetworkTier, caip2: string): ChainNetwork => ({
    id: tier,
    tier,
    displayName: tier,
    isDefaultForTier: true,
    caip2,
    nativeRef: { kind: 'evm', eip155ChainId: 0 },
    status: 'active',
})

/** Only what registration reads: `has` and each descriptor's networks. */
export const createFakeChainRegistry = (
    caip2ByChain: Partial<
        Record<ChainId, Record<NetworkTier, string>>
    > = TEST_CAIP2,
): ChainRegistry => {
    const has = (chainId: ChainId) => caip2ByChain[chainId] !== undefined
    return {
        has,
        get: (chainId: ChainId) => {
            const caip2 = caip2ByChain[chainId]
            if (caip2 === undefined) throw new Error(`unregistered ${chainId}`)
            return {
                descriptor: {
                    id: chainId,
                    networks: [
                        networkOf('mainnet', caip2.mainnet),
                        networkOf('testnet', caip2.testnet),
                    ],
                } as unknown as ChainDescriptor,
            }
        },
    } as unknown as ChainRegistry
}
