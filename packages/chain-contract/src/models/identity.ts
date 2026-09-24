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

/** A chain package adds its own id here in the change that creates it. */
export const CHAIN_IDS = ['algorand'] as const

export type ChainId = (typeof CHAIN_IDS)[number]

/** Grown the same way as `ChainId`. */
export type ChainFamily = 'algorand'

export type NetworkTier = 'mainnet' | 'testnet'

/**
 * Chain-local: lowercase letters, digits and `-` (see `isNetworkId`), so it
 * never contains the scope-key separator.
 */
export type NetworkId = string

/**
 * The network as its own chain identifies it. A chain package adds its own
 * member, discriminated by `kind`.
 */
export type NativeNetworkRef = {
    kind: 'algorand'
    genesisId: string
    /** Base64, as algod reports it. */
    genesisHash: string
}

export interface ChainNetwork {
    id: NetworkId
    tier: NetworkTier
    displayName: string
    isDefaultForTier: boolean
    /** CAIP-2 chain id; absent on a custom network until its node is probed. */
    caip2?: string
    nativeRef: NativeNetworkRef
    /**
     * A deprecated network stays resolvable so stored rows keep their
     * meaning; pickers hide it.
     */
    status: 'active' | 'deprecated'
}

export interface ChainScope {
    chainId: ChainId
    networkId: NetworkId
}

/** Branded so a key can only come from `toScopeKey`, which validates both parts. */
export type ChainScopeKey = `${ChainId}/${NetworkId}` & {
    readonly __chainScopeKey: unique symbol
}

/**
 * The same values as `Network` in packages/config, declared here so this
 * package depends on nothing.
 */
export type LegacyNetwork = 'mainnet' | 'testnet' | 'betanet' | 'custom'

const NETWORK_ID_PATTERN = /^[a-z0-9-]+$/

export const isChainId = (value: unknown): value is ChainId =>
    typeof value === 'string' &&
    (CHAIN_IDS as readonly string[]).includes(value)

export const isNetworkId = (value: unknown): value is NetworkId =>
    typeof value === 'string' && NETWORK_ID_PATTERN.test(value)
