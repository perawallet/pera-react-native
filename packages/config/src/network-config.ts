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

import {
    scopeForLegacyNetwork,
    type ChainId,
    type ChainScope,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import { UnconfiguredScopeError } from './errors'
import { type Network, Networks } from './models/network'
import { config } from './main'

/** Chain-intrinsic endpoints. Always the real active network — never falls back. */
export type AlgorandChainConfig = {
    algodUrl: string
    indexerUrl: string
    genesisHash: string
    genesisId: string
    explorerUrl: string
    algodToken: string
    indexerToken: string
    dispenserUrl: string
}

export type EthereumChainConfig = {
    /** Public JSON-RPC endpoint; reads go direct, with no API key. */
    rpcUrl: string
}

// Indexed by `C extends ChainId`, so a chain id without an entry stops
// getChainConfig compiling.
type ChainConfigByChain = {
    algorand: AlgorandChainConfig
    ethereum: EthereumChainConfig
}

export type ChainConfig = ChainConfigByChain[ChainId]

/** Empty outside `PeraBackedNetwork`s — never borrowed from another network. */
export type PeraServices = {
    backendUrl: string
    bidaliBaseUrl: string
    bidaliApiKey: string
    baanxBaseUrl: string
    baanxClientKey: string
    baanxTenantId: string
}

export type NetworkConfig = AlgorandChainConfig &
    PeraServices & {
        network: Network
        isTestnet: boolean
        isMainnet: boolean
    }

export const PERA_SERVICES = [
    'accounts',
    'assets',
    'prices',
    'history',
    'devices',
    'notifications',
    'blockFollowing',
] as const

export type PeraService = (typeof PERA_SERVICES)[number]

/** What a saved custom node supplies; its explorer and dispenser stay empty. */
export type CustomNetworkEndpoints = Pick<
    AlgorandChainConfig,
    | 'algodUrl'
    | 'indexerUrl'
    | 'algodToken'
    | 'indexerToken'
    | 'genesisHash'
    | 'genesisId'
>

/**
 * The node as the user saved it; the tokens are optional there. Saved as a
 * single unit, never merged: a half-updated config (new host, stale genesis
 * hash) would fail every signing attempt with a confusing cross-network
 * mismatch rather than anything pointing at the real cause.
 */
export type CustomNetworkConfig = Omit<
    CustomNetworkEndpoints,
    'algodToken' | 'indexerToken'
> & {
    algodToken?: string
    indexerToken?: string
}

/** Persisted configs are untyped; one missing a required field is not a usable node. */
export const isCustomNetworkConfig = (
    value: unknown,
): value is CustomNetworkConfig => {
    if (typeof value !== 'object' || value === null) return false
    const entry = value as Record<string, unknown>
    return (
        typeof entry.algodUrl === 'string' &&
        typeof entry.indexerUrl === 'string' &&
        typeof entry.genesisHash === 'string' &&
        typeof entry.genesisId === 'string'
    )
}

export type CustomNetworkSource = (
    scope: ChainScope,
) => CustomNetworkEndpoints | undefined

export const isTestnet = (network: Network) => network === Networks.testnet
export const isMainnet = (network: Network) => network === Networks.mainnet

const chainConfigByNetwork: Record<Network, AlgorandChainConfig> = {
    [Networks.mainnet]: {
        algodUrl: config.mainnetAlgodUrl,
        indexerUrl: config.mainnetIndexerUrl,
        genesisHash: config.mainnetGenesisHash,
        genesisId: 'mainnet-v1.0',
        explorerUrl: config.mainnetExplorerUrl,
        algodToken: config.algodApiKey,
        indexerToken: config.indexerApiKey,
        dispenserUrl: config.mainnetDispenserUrl,
    },
    [Networks.testnet]: {
        algodUrl: config.testnetAlgodUrl,
        indexerUrl: config.testnetIndexerUrl,
        genesisHash: config.testnetGenesisHash,
        genesisId: 'testnet-v1.0',
        explorerUrl: config.testnetExplorerUrl,
        algodToken: config.algodApiKey,
        indexerToken: config.indexerApiKey,
        dispenserUrl: config.dispenserUrl,
    },
    [Networks.betanet]: {
        algodUrl: config.betanetAlgodUrl,
        indexerUrl: config.betanetIndexerUrl,
        genesisHash: config.betanetGenesisHash,
        genesisId: 'betanet-v1.0',
        explorerUrl: config.betanetExplorerUrl,
        // Deliberately empty, NOT config.algodApiKey/indexerApiKey: betanet's
        // endpoints are public third-party hosts Pera doesn't control and that
        // need no token, so sending Pera's own credential would just leak it.
        // The client factories skip the auth header when the token is empty.
        algodToken: '',
        indexerToken: '',
        dispenserUrl: 'https://lora.algokit.io/betanet/fund/',
    },
    [Networks.custom]: {
        // Deliberately all empty: `custom`'s real values live in the
        // custom-network store, which `config` can't read — it must stay free
        // of store dependencies. The store's owner registers a
        // `CustomNetworkSource`, and `getChainConfig` lays the saved node over
        // this placeholder.
        //
        // explorerUrl and dispenserUrl stay empty for good: an arbitrary node has
        // no known explorer or faucet, and the existing gate already hides the
        // dispenser row on an empty value.
        algodUrl: '',
        indexerUrl: '',
        genesisHash: '',
        genesisId: '',
        explorerUrl: '',
        algodToken: '',
        indexerToken: '',
        dispenserUrl: '',
    },
}

/**
 * A type guard, not a boolean: `KNOWN_ASSET_IDS` and the `PeraServices` table are
 * keyed by these networks, so callers need the narrowing to index them.
 */
const PERA_BACKED_NETWORKS = [Networks.mainnet, Networks.testnet] as const

export type PeraBackedNetwork = (typeof PERA_BACKED_NETWORKS)[number]

export const isPeraBackedNetwork = (
    network: Network,
): network is PeraBackedNetwork =>
    (PERA_BACKED_NETWORKS as readonly Network[]).includes(network)

/**
 * Named rather than inlined twice, so the rows below can't drift and `satisfies`
 * fails the build if `PeraServices` gains a field without a counterpart here.
 */
const EMPTY_PERA_SERVICES = {
    backendUrl: '',
    bidaliBaseUrl: '',
    bidaliApiKey: '',
    baanxBaseUrl: '',
    baanxClientKey: '',
    baanxTenantId: '',
} satisfies PeraServices

/**
 * `Record<Network, …>`, not `Partial<…>` plus a fallback: a fifth network added
 * to the union fails TypeScript here until someone decides its Pera services,
 * rather than silently resolving to TestNet's deployment.
 */
const peraServicesByNetwork: Record<Network, PeraServices> = {
    [Networks.mainnet]: {
        backendUrl: config.mainnetBackendUrl,
        bidaliBaseUrl: config.mainnetBidaliBaseUrl,
        bidaliApiKey: config.mainnetBidaliApiKey,
        baanxBaseUrl: config.mainnetBaanxBaseUrl,
        baanxClientKey: config.mainnetBaanxClientKey,
        baanxTenantId: config.mainnetBaanxTenantId,
    },
    [Networks.testnet]: {
        backendUrl: config.testnetBackendUrl,
        bidaliBaseUrl: config.testnetBidaliBaseUrl,
        bidaliApiKey: config.testnetBidaliApiKey,
        baanxBaseUrl: config.testnetBaanxBaseUrl,
        baanxClientKey: config.testnetBaanxClientKey,
        baanxTenantId: config.testnetBaanxTenantId,
    },
    // No Pera deployment. Empty, never borrowed: the query client refuses a
    // Pera request for a scope whose backendUrl is empty.
    [Networks.betanet]: EMPTY_PERA_SERVICES,
    [Networks.custom]: EMPTY_PERA_SERVICES,
}

/** `Record<Network, …>` for the same reason as the table above. */
const peraServiceNamesByNetwork: Record<Network, readonly PeraService[]> = {
    [Networks.mainnet]: PERA_SERVICES,
    [Networks.testnet]: PERA_SERVICES,
    [Networks.betanet]: [],
    [Networks.custom]: [],
}

type ScopeConfigOf<C extends ChainId> = {
    scope: ChainScope & { chainId: C }
    /** Absent while the build carries no endpoint for the scope. */
    chain: ChainConfigByChain[C] | undefined
    peraServices: PeraServices
    services: ReadonlySet<PeraService>
    /** Whether a saved custom node overlays `chain`; its endpoints are Algorand's shape. */
    acceptsCustomNode: boolean
}

type ScopeConfig = { [C in ChainId]: ScopeConfigOf<C> }[ChainId]

const ALGORAND_SCOPE_CONFIGS: readonly ScopeConfigOf<'algorand'>[] =
    Object.values(Networks).map(network => ({
        scope: scopeForLegacyNetwork(network),
        chain: chainConfigByNetwork[network],
        peraServices: peraServicesByNetwork[network],
        services: new Set(peraServiceNamesByNetwork[network]),
        acceptsCustomNode: true,
    }))

const ethereumScopeConfig = (
    networkId: NetworkId,
    rpcUrl: string,
    peraBackendUrl: string,
    services: readonly PeraService[],
): ScopeConfigOf<'ethereum'> => ({
    scope: { chainId: 'ethereum', networkId },
    chain: rpcUrl === '' ? undefined : { rpcUrl },
    // An empty list empties backendUrl too: the query client refuses every Pera
    // request for a scope without one, including requests that name no service.
    peraServices: {
        ...EMPTY_PERA_SERVICES,
        backendUrl: services.length > 0 ? peraBackendUrl : '',
    },
    services: new Set(services),
    acceptsCustomNode: false,
})

// The Pera backend serves Ethereum from the same host as the Algorand network
// of the same tier.
const ETHEREUM_SCOPE_CONFIGS: readonly ScopeConfigOf<'ethereum'>[] = [
    ethereumScopeConfig(
        'mainnet',
        config.ethereumMainnetRpcUrl,
        config.mainnetBackendUrl,
        config.ethereumMainnetPeraServices,
    ),
    ethereumScopeConfig(
        'sepolia',
        config.ethereumSepoliaRpcUrl,
        config.testnetBackendUrl,
        config.ethereumSepoliaPeraServices,
    ),
]

const SCOPE_CONFIGS: readonly ScopeConfig[] = [
    ...ALGORAND_SCOPE_CONFIGS,
    ...ETHEREUM_SCOPE_CONFIGS,
]

// Compared field by field, not through toScopeKey: that validates the chain id
// against the compiled-in union and throws for a test's fixture chain, and
// nothing here is persisted.
const findRow = <R extends { scope: ChainScope }>(
    rows: readonly R[],
    scope: ChainScope,
): R | undefined =>
    rows.find(
        row =>
            row.scope.chainId === scope.chainId &&
            row.scope.networkId === scope.networkId,
    )

const findScopeConfig = (scope: ChainScope): ScopeConfig | undefined =>
    findRow(SCOPE_CONFIGS, scope)

let customNetworkSource: CustomNetworkSource | undefined

/**
 * The saved custom node lives in a store `config` cannot import, so the
 * store's owner registers a reader here. One slot; the returned function clears
 * it only while it still holds this source, so a stale cleanup cannot drop a
 * newer registration.
 */
export const registerCustomNetworkSource = (
    source: CustomNetworkSource,
): (() => void) => {
    customNetworkSource = source
    return () => {
        if (customNetworkSource === source) {
            customNetworkSource = undefined
        }
    }
}

// Algorand only: its one consumer builds algod and indexer clients per scope.
export const configuredScopes = (): readonly ChainScope[] =>
    ALGORAND_SCOPE_CONFIGS.map(row => row.scope)

/**
 * Throws for a scope no row configures, rather than handing back empty
 * endpoints that fail later somewhere unrelated.
 */
export const getChainConfig = <C extends ChainId>(
    scope: ChainScope & { chainId: C },
): ChainConfigByChain[C] => {
    const row = findScopeConfig(scope)
    if (row?.chain === undefined) {
        throw new UnconfiguredScopeError(scope)
    }
    const chain = row.acceptsCustomNode
        ? { ...row.chain, ...customNetworkSource?.(scope) }
        : { ...row.chain }
    // The row matched scope.chainId, so its config is C's.
    return chain as ChainConfigByChain[C]
}

/** For Algorand-only code holding an arbitrary scope; any other chain throws. */
export const getAlgorandChainConfig = (
    scope: ChainScope,
): AlgorandChainConfig => {
    const row = findRow(ALGORAND_SCOPE_CONFIGS, scope)
    if (row === undefined) {
        throw new UnconfiguredScopeError(scope)
    }
    return getChainConfig(row.scope)
}

export const getPeraServicesConfig = (scope: ChainScope): PeraServices => ({
    ...(findScopeConfig(scope)?.peraServices ?? EMPTY_PERA_SERVICES),
})

const NO_PERA_SERVICES: ReadonlySet<PeraService> = new Set()

const servicesOf = (scope: ChainScope): ReadonlySet<PeraService> =>
    findScopeConfig(scope)?.services ?? NO_PERA_SERVICES

export const peraServicesFor = (scope: ChainScope): ReadonlySet<PeraService> =>
    new Set(servicesOf(scope))

export const hasPeraService = (
    scope: ChainScope,
    service: PeraService,
): boolean => servicesOf(scope).has(service)

export const getNetworkConfig = (network: Network): NetworkConfig => {
    const scope = scopeForLegacyNetwork(network)
    return {
        network,
        isMainnet: isMainnet(network),
        isTestnet: isTestnet(network),
        ...getChainConfig(scope),
        ...getPeraServicesConfig(scope),
    }
}

const COMMERCE_HOST_PREFIX = 'commerce.'
const GIFTCARDS_HOST_PREFIX = 'giftcards.'

/**
 * Origins an iframe mounted at `url` loads from: its own, plus the `giftcards.`
 * twin a `commerce.` host 302s to (Bidali). The in-app bridge and the
 * extension's frame-src both see the post-redirect origin, so they share this.
 * Empty for a URL that doesn't parse.
 */
export const getIframeOrigins = (url: string): string[] => {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return []
    }
    const origin = parsed.origin
    if (!parsed.hostname.startsWith(COMMERCE_HOST_PREFIX)) return [origin]
    parsed.hostname =
        GIFTCARDS_HOST_PREFIX +
        parsed.hostname.slice(COMMERCE_HOST_PREFIX.length)
    return [origin, parsed.origin]
}

/**
 * ARC-59 inbox app id/address for `network`, or `null` where the inbox app is
 * not deployed.
 *
 * Returned `null` rather than TestNet's ids: those ids do not exist on another
 * chain, so building against them aims a wrong app id at the real chain's
 * algod. Group atomicity meant no funds moved, but it failed opaquely — the
 * caller now fails with a typed error instead.
 */
export const getArc59Config = (
    network: Network,
): { appId: bigint; appAddress: string } | null => {
    if (!isPeraBackedNetwork(network)) return null

    return network === Networks.mainnet
        ? config.arc59.mainnet
        : config.arc59.testnet
}
