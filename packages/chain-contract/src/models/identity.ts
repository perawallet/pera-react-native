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

import evmNetworks from './evm-networks.json'

/**
 * A chain package adds its own id here in the change that creates it; an EVM
 * chain also adds its networks to evm-networks.json. Append only: device
 * registration's refusal fallback drops the last chain first, as the newest.
 */
export const CHAIN_IDS = [
    'algorand',
    'ethereum',
    'base',
    'bsc',
    'arbitrum',
    'avalanche',
    'polygon',
] as const

export type ChainId = (typeof CHAIN_IDS)[number]

/**
 * Append only: a contact's backup record is keyed on its first family in this
 * order, so reordering would move every contact to a new key.
 */
export const CHAIN_FAMILIES = ['algorand', 'evm'] as const

export type ChainFamily = (typeof CHAIN_FAMILIES)[number]

export const NETWORK_TIERS = ['mainnet', 'testnet'] as const

export type NetworkTier = (typeof NETWORK_TIERS)[number]

// A key that isn't a ChainId fails to compile here.
const evmChainIdsOf = <T extends Partial<Record<ChainId, unknown>>>(
    table: T & Record<Exclude<keyof T, ChainId>, never>,
): readonly Extract<keyof T, ChainId>[] =>
    Object.keys(table) as unknown as readonly Extract<keyof T, ChainId>[]

// Not annotated: the inferred literal union is what the emitted .d.ts keeps,
// where a `keyof typeof evmNetworks` would leave an import of a JSON that
// declaration emit never copies into dist.
const EVM_CHAIN_IDS = evmChainIdsOf(evmNetworks)

/** The chains chain-ethereum serves: the keys of evm-networks.json. */
export type EvmChainId = (typeof EVM_CHAIN_IDS)[number]

export type EvmNetworkIdentity = {
    readonly id: string
    readonly tier: NetworkTier
    readonly displayName: string
    readonly eip155ChainId: number
}

/**
 * Plain JSON so the config generator, Metro and the browser build read the same
 * networks the app registers, without importing a chain package.
 */
export const EVM_CHAIN_NETWORKS: Readonly<
    Record<EvmChainId, { readonly networks: readonly EvmNetworkIdentity[] }>
> = evmNetworks as Record<
    EvmChainId,
    { readonly networks: readonly EvmNetworkIdentity[] }
>

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
 * The network as its own chain identifies it; one member per `ChainFamily`,
 * discriminated by `kind`.
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

/** Algorand ids persisted before scope keys. */
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

export const isEvmChainId = (value: unknown): value is EvmChainId =>
    isChainId(value) && (EVM_CHAIN_IDS as readonly string[]).includes(value)

export const isChainFamily = (value: unknown): value is ChainFamily =>
    typeof value === 'string' &&
    (CHAIN_FAMILIES as readonly string[]).includes(value)

export const isNetworkId = (value: unknown): value is NetworkId =>
    typeof value === 'string' && NETWORK_ID_PATTERN.test(value)

export const isWalletMode = (value: unknown): value is WalletMode =>
    typeof value === 'string' &&
    (WALLET_MODES as readonly string[]).includes(value)

export const isLegacyNetwork = (value: unknown): value is LegacyNetwork =>
    typeof value === 'string' &&
    (LEGACY_NETWORKS as readonly string[]).includes(value)
