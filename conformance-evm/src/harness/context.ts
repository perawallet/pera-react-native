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
    ChainContext,
    ChainKeyStore,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { evmChainOf } from '@perawallet/wallet-core-chain-ethereum/chains/table'
import type { EvmChain } from '@perawallet/wallet-core-chain-ethereum/chains/types'
import {
    initializeDatabase,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'

import { EVMNET, type EvmnetChain } from './evmnet'
import {
    createEvmConformanceKeyStore,
    type ConformanceKeyStore,
} from './keystore'

export type EvmConformanceEnv = {
    chain: EvmnetChain
    scope: ChainScope
    ctx: ChainContext
    evmChain: EvmChain
    kms: ChainKeyStore
    keyStore: ConformanceKeyStore
    db: Database
}

// The chain package's own test ceilings; Anvil answers in milliseconds.
const TIMEOUTS = { readMs: 1000, submitMs: 1000 }

export const evmnetScope = (chain: EvmnetChain): ChainScope => ({
    chainId: chain,
    networkId: EVMNET[chain].networkId,
})

/**
 * The context the app builds per chain (`chainContextFor` in the mobile
 * bootstrap), pointed at the chain's Anvil node on its testnet scope. Pera
 * services are off: they are not node calls.
 */
export const createEvmnetChainContext = (
    chain: EvmnetChain,
    kms: ChainKeyStore,
): ChainContext => ({
    getScope: () => evmnetScope(chain),
    getEndpoints: () => ({ [EVMNET[chain].networkId]: EVMNET[chain].rpcUrl }),
    getPeraBackend: () => ({ baseUrl: '', services: new Set() }),
    timeouts: TIMEOUTS,
    kms,
})

/**
 * A fresh keystore and a fresh migrated database per call. The database is
 * also installed as the app's singleton, because the transfer builder
 * allocates nonces against the ledger without being handed one.
 */
export const createEvmConformanceEnv = async (
    chain: EvmnetChain,
): Promise<EvmConformanceEnv> => {
    const { keyStore, kms } = await createEvmConformanceKeyStore()
    const { db } = createTestDatabase()
    // initializeDatabase reads only getDatabase.
    await initializeDatabase({
        getDatabase: async () => db,
    } as unknown as Parameters<typeof initializeDatabase>[0])
    return {
        chain,
        scope: evmnetScope(chain),
        ctx: createEvmnetChainContext(chain, kms),
        evmChain: evmChainOf(chain),
        kms,
        keyStore,
        db,
    }
}
