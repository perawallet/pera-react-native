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

import type { KeyStoreState } from '@algorandfoundation/keystore-core'
import { Store } from '@tanstack/store'
import type {
    ChainContext,
    ChainKeyStore,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { evmChainOf } from '@perawallet/wallet-core-chain-ethereum/chains/table'
import type { EvmChain } from '@perawallet/wallet-core-chain-ethereum/chains/types'
import {
    initializeDatabase,
    resetDatabase,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'

import { EVMNET, type EvmnetChain } from './evmnet'
import {
    createEvmConformanceKeyStore,
    type ConformanceKeyStore,
} from './keystore'

/**
 * One wallet's custody and storage, as the app has exactly one: a keystore,
 * the kms over it and the database, shared by every chain. Creating a session
 * installs it as the app's singletons (`getDatabase()`, the provider mock's
 * keystore, the kms registered chain contexts reach) and retires the previous
 * one, so the rule is one session per test: reach other chains with
 * {@link envFor} on the same session. Anything read through a retired
 * session throws instead of silently pointing at storage the app no longer
 * writes to. The setup file retires the session after every test.
 */
export type EvmConformanceSession = {
    readonly keyStore: ConformanceKeyStore
    readonly kms: ChainKeyStore
    readonly db: Database
}

/** One chain's view of a session; `db`, `kms` and `keyStore` are the session's. */
export type EvmConformanceEnv = {
    readonly session: EvmConformanceSession
    readonly chain: EvmnetChain
    readonly scope: ChainScope
    readonly ctx: ChainContext
    readonly evmChain: EvmChain
    readonly kms: ChainKeyStore
    readonly keyStore: ConformanceKeyStore
    readonly db: Database
}

type InstalledSession = {
    keyStore: ConformanceKeyStore
    kms: ChainKeyStore
    db: Database
    teardown: () => void
}

let installed: InstalledSession | undefined

const live = (state: InstalledSession): InstalledSession => {
    if (installed !== state) {
        throw new Error(
            'stale conformance session: create one session per test, and reach other chains with envFor on it',
        )
    }
    return state
}

const noSession = (): never => {
    throw new Error(
        'no conformance session is installed; create one with createEvmConformanceSession',
    )
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

/** Retires the installed session: closes its database and clears the app singletons. */
export const resetEvmConformanceSession = (): void => {
    const retiring = installed
    installed = undefined
    resetDatabase()
    retiring?.teardown()
}

export const createEvmConformanceSession =
    async (): Promise<EvmConformanceSession> => {
        resetEvmConformanceSession()
        const { keyStore, kms } = await createEvmConformanceKeyStore()
        const { db, teardown } = createTestDatabase()
        try {
            // initializeDatabase reads only getDatabase.
            await initializeDatabase({
                getDatabase: async () => db,
            } as unknown as Parameters<typeof initializeDatabase>[0])
        } catch (error) {
            resetDatabase()
            teardown()
            throw error
        }
        const state: InstalledSession = { keyStore, kms, db, teardown }
        installed = state
        // Guarded per call too, so a context holding this object goes stale
        // with the session rather than signing into a retired keystore.
        const guardedKms: ChainKeyStore = {
            deriveFromSeed: async (...args) =>
                live(state).kms.deriveFromSeed(...args),
            importRawKey: async (...args) =>
                live(state).kms.importRawKey(...args),
            sign: async (...args) => live(state).kms.sign(...args),
        }
        return {
            get keyStore() {
                return live(state).keyStore
            },
            get kms() {
                live(state)
                return guardedKms
            },
            get db() {
                return live(state).db
            },
        }
    }

/** Cheap: a chain's scope and context over an existing session. */
export const envFor = (
    session: EvmConformanceSession,
    chain: EvmnetChain,
): EvmConformanceEnv => ({
    session,
    chain,
    scope: evmnetScope(chain),
    ctx: createEvmnetChainContext(chain, session.kms),
    evmChain: evmChainOf(chain),
    get kms() {
        return session.kms
    },
    get keyStore() {
        return session.keyStore
    },
    get db() {
        return session.db
    },
})

/** A fresh session with one chain's env on it, for a test that needs one chain. */
export const createEvmConformanceEnv = async (
    chain: EvmnetChain,
): Promise<EvmConformanceEnv> =>
    envFor(await createEvmConformanceSession(), chain)

/** For the provider mock's `key.store`. */
export const installedKeyStore = (): ConformanceKeyStore | undefined =>
    installed?.keyStore

const emptyKeystoreState = new Store<KeyStoreState>({
    keys: [],
    status: 'idle',
})

/** For the provider mock's `getKeystoreStore()`; empty while no session is installed. */
export const installedKeystoreState = (): Store<KeyStoreState> =>
    installed?.keyStore.store ?? emptyKeystoreState

/** The kms the registered chain contexts carry; it reaches the installed session's. */
export const installedKms: ChainKeyStore = {
    deriveFromSeed: async (...args) =>
        (installed ?? noSession()).kms.deriveFromSeed(...args),
    importRawKey: async (...args) =>
        (installed ?? noSession()).kms.importRawKey(...args),
    sign: async (...args) => (installed ?? noSession()).kms.sign(...args),
}
