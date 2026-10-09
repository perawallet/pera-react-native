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
export const CHAIN_IDS = ['algorand', 'ethereum'] as const

export type ChainId = (typeof CHAIN_IDS)[number]

/** Grown the same way as `ChainId`. */
export type ChainFamily = 'algorand' | 'evm'

export const NETWORK_TIERS = ['mainnet', 'testnet'] as const

export type NetworkTier = (typeof NETWORK_TIERS)[number]

/**
 * Chain-local: lowercase letters, digits and `-` (see `isNetworkId`), so it
 * never contains the scope-key separator.
 */
export type NetworkId = string

/** Persisted as a record id, so it is a storage format as well as a network id. */
export const CUSTOM_NETWORK_ID: NetworkId = 'custom'

export const WALLET_MODES = ['live', 'developer'] as const

/** Live puts every chain on its mainnet-tier default; developer on its testnet-tier default unless the chain has an override. */
export type WalletMode = (typeof WALLET_MODES)[number]

/**
 * What a chain resolves to: `developer-override` is developer mode on any
 * network but the chain's default test network.
 */
export type ChainMode = WalletMode | 'developer-override'

/** The modes a capability can be switched off in; `live` can't be restricted. */
export type DeveloperChainMode = Exclude<ChainMode, 'live'>

/**
 * The network as its own chain identifies it. A chain package adds its own
 * member, discriminated by `kind`.
 */
export type NativeNetworkRef =
    | {
          kind: 'algorand'
          genesisId: string
          /** Base64, as algod reports it. */
          genesisHash: string
      }
    | {
          kind: 'evm'
          /** EIP-155 chain id. */
          eip155ChainId: number
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
export const LEGACY_NETWORKS = [
    'mainnet',
    'testnet',
    'betanet',
    'custom',
] as const

export type LegacyNetwork = (typeof LEGACY_NETWORKS)[number]

const NETWORK_ID_PATTERN = /^[a-z0-9-]+$/

export const isChainId = (value: unknown): value is ChainId =>
    typeof value === 'string' &&
    (CHAIN_IDS as readonly string[]).includes(value)

export const isNetworkId = (value: unknown): value is NetworkId =>
    typeof value === 'string' && NETWORK_ID_PATTERN.test(value)

export const isWalletMode = (value: unknown): value is WalletMode =>
    typeof value === 'string' &&
    (WALLET_MODES as readonly string[]).includes(value)

export const isLegacyNetwork = (value: unknown): value is LegacyNetwork =>
    typeof value === 'string' &&
    (LEGACY_NETWORKS as readonly string[]).includes(value)
