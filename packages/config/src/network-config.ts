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
    EVM_CHAIN_NETWORKS,
    type ChainEndpoints,
    type ChainId,
    type ChainScope,
    type EvmChainId,
    type NetworkId,
    type NetworkTier,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import { UnconfiguredScopeError } from './errors'
import { config, evmConfigKeys } from './main'

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

export type EvmChainConfig = {
    /** Public JSON-RPC endpoint; reads go direct, with no API key. */
    rpcUrl: string
}

// Indexed by `C extends ChainId`, so a chain id without an entry stops
// getChainConfig compiling.
type ChainConfigByChain = {
    algorand: AlgorandChainConfig
} & Record<EvmChainId, EvmChainConfig>

export type ChainConfig = ChainConfigByChain[ChainId]

/** Empty for a scope with no Pera deployment, never borrowed from another network. */
export type PeraServices = {
    backendUrl: string
    bidaliBaseUrl: string
    bidaliApiKey: string
    baanxBaseUrl: string
    baanxClientKey: string
    baanxTenantId: string
}

export const PERA_SERVICES = [
    'accounts',
    'assets',
    'prices',
    'history',
    'devices',
    'notifications',
    'blockFollowing',
    'nfts',
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

const ALGORAND_MAINNET_CHAIN: AlgorandChainConfig = {
    algodUrl: config.mainnetAlgodUrl,
    indexerUrl: config.mainnetIndexerUrl,
    genesisHash: config.mainnetGenesisHash,
    genesisId: 'mainnet-v1.0',
    explorerUrl: config.mainnetExplorerUrl,
    algodToken: config.algodApiKey,
    indexerToken: config.indexerApiKey,
    dispenserUrl: config.mainnetDispenserUrl,
}

const ALGORAND_TESTNET_CHAIN: AlgorandChainConfig = {
    algodUrl: config.testnetAlgodUrl,
    indexerUrl: config.testnetIndexerUrl,
    genesisHash: config.testnetGenesisHash,
    genesisId: 'testnet-v1.0',
    explorerUrl: config.testnetExplorerUrl,
    algodToken: config.algodApiKey,
    indexerToken: config.indexerApiKey,
    dispenserUrl: config.dispenserUrl,
}

const ALGORAND_BETANET_CHAIN: AlgorandChainConfig = {
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
}

const ALGORAND_CUSTOM_CHAIN: AlgorandChainConfig = {
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
}

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
 * The two Pera deployments, keyed by the wallet mode that reaches each. A
 * deployment is a backend host, not a chain: it serves every chain of its
 * tier, so chain-agnostic requests (integrity, banners, notifications, fiat
 * rates) go to the wallet mode's deployment whatever network a chain is on.
 */
const peraServicesByDeployment: Record<WalletMode, PeraServices> = {
    live: {
        backendUrl: config.mainnetBackendUrl,
        bidaliBaseUrl: config.mainnetBidaliBaseUrl,
        bidaliApiKey: config.mainnetBidaliApiKey,
        baanxBaseUrl: config.mainnetBaanxBaseUrl,
        baanxClientKey: config.mainnetBaanxClientKey,
        baanxTenantId: config.mainnetBaanxTenantId,
    },
    developer: {
        backendUrl: config.testnetBackendUrl,
        bidaliBaseUrl: config.testnetBidaliBaseUrl,
        bidaliApiKey: config.testnetBidaliApiKey,
        baanxBaseUrl: config.testnetBaanxBaseUrl,
        baanxClientKey: config.testnetBaanxClientKey,
        baanxTenantId: config.testnetBaanxTenantId,
    },
}

type ScopeConfigOf<C extends ChainId> = {
    scope: ChainScope & { chainId: C }
    /** The deployment serving the scope's chain data; absent where none does. */
    deployment: WalletMode | undefined
    /** Absent while the build carries no endpoint for the scope. */
    chain: ChainConfigByChain[C] | undefined
    peraServices: PeraServices
    services: ReadonlySet<PeraService>
    /** Whether a saved custom node overlays `chain`; its endpoints are Algorand's shape. */
    acceptsCustomNode: boolean
}

type ScopeConfig = ScopeConfigOf<'algorand'> | ScopeConfigOf<EvmChainId>

// Betanet and custom pass no deployment: their chain data lives on neither
// Pera deployment, so they carry no services.
const algorandScopeConfig = (
    networkId: NetworkId,
    chain: AlgorandChainConfig,
    deployment: WalletMode | undefined,
): ScopeConfigOf<'algorand'> => ({
    scope: { chainId: 'algorand', networkId },
    deployment,
    chain,
    peraServices:
        deployment === undefined
            ? EMPTY_PERA_SERVICES
            : peraServicesByDeployment[deployment],
    services: new Set(deployment === undefined ? [] : PERA_SERVICES),
    acceptsCustomNode: true,
})

const ALGORAND_SCOPE_CONFIGS: readonly ScopeConfigOf<'algorand'>[] = [
    algorandScopeConfig('mainnet', ALGORAND_MAINNET_CHAIN, 'live'),
    algorandScopeConfig('testnet', ALGORAND_TESTNET_CHAIN, 'developer'),
    algorandScopeConfig('betanet', ALGORAND_BETANET_CHAIN, undefined),
    algorandScopeConfig('custom', ALGORAND_CUSTOM_CHAIN, undefined),
]

const DEPLOYMENT_OF_TIER: Record<NetworkTier, WalletMode> = {
    mainnet: 'live',
    testnet: 'developer',
}

const evmScopeConfig = (
    chainId: EvmChainId,
    networkId: NetworkId,
    rpcUrl: string,
    deployment: WalletMode,
    services: readonly PeraService[],
): ScopeConfigOf<EvmChainId> => ({
    scope: { chainId, networkId },
    // An empty list drops the deployment too: the query client refuses every
    // Pera request for such a scope, including requests that name no service.
    deployment: services.length > 0 ? deployment : undefined,
    chain: rpcUrl === '' ? undefined : { rpcUrl },
    peraServices: {
        ...EMPTY_PERA_SERVICES,
        backendUrl:
            services.length > 0
                ? peraServicesByDeployment[deployment].backendUrl
                : '',
    },
    services: new Set(services),
    acceptsCustomNode: false,
})

const EVM_CHAIN_IDS = Object.keys(EVM_CHAIN_NETWORKS) as EvmChainId[]

const EVM_SCOPE_CONFIGS: readonly ScopeConfigOf<EvmChainId>[] =
    EVM_CHAIN_IDS.flatMap(chainId =>
        EVM_CHAIN_NETWORKS[chainId].networks.map(network => {
            const keys = evmConfigKeys(chainId, network.id)
            return evmScopeConfig(
                chainId,
                network.id,
                config[keys.rpcUrl],
                DEPLOYMENT_OF_TIER[network.tier],
                config[keys.peraServices],
            )
        }),
    )

// Algorand's node URLs come from getAlgorandChainConfig, which overlays a saved
// custom node per request, so its record stays empty. An EVM network without
// an RPC URL is left out.
const evmEndpoints = (): Record<EvmChainId, ChainEndpoints> => {
    const endpoints = Object.fromEntries(
        EVM_CHAIN_IDS.map(chainId => [chainId, {}]),
    ) as Record<EvmChainId, Record<NetworkId, string>>
    for (const { scope, chain } of EVM_SCOPE_CONFIGS) {
        if (chain) endpoints[scope.chainId][scope.networkId] = chain.rpcUrl
    }
    return endpoints
}

const CHAIN_ENDPOINTS: Record<ChainId, ChainEndpoints> = {
    algorand: {},
    ...evmEndpoints(),
}

export const chainEndpointsFor = (chainId: ChainId): ChainEndpoints =>
    CHAIN_ENDPOINTS[chainId]

const SCOPE_CONFIGS: readonly ScopeConfig[] = [
    ...ALGORAND_SCOPE_CONFIGS,
    ...EVM_SCOPE_CONFIGS,
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

export const configuredScopes = (): readonly ChainScope[] =>
    SCOPE_CONFIGS.map(row => row.scope)

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

export const getPeraDeploymentConfig = (
    deployment: WalletMode,
): PeraServices => ({ ...peraServicesByDeployment[deployment] })

/** The deployment holding the scope's chain data, or `undefined` where none does (betanet, a custom node). */
export const peraDeploymentOf = (scope: ChainScope): WalletMode | undefined =>
    findScopeConfig(scope)?.deployment

/** `peraDeploymentOf` for a scope that may be missing; `null` wherever no deployment serves it. */
export const deploymentOf = (scope: ChainScope | null): WalletMode | null =>
    scope === null ? null : (peraDeploymentOf(scope) ?? null)

const NO_PERA_SERVICES: ReadonlySet<PeraService> = new Set()

const servicesOf = (scope: ChainScope): ReadonlySet<PeraService> =>
    findScopeConfig(scope)?.services ?? NO_PERA_SERVICES

export const peraServicesFor = (scope: ChainScope): ReadonlySet<PeraService> =>
    new Set(servicesOf(scope))

/** True when the scope has a Pera deployment; the query client refuses Pera requests otherwise. */
export const hasPeraBackend = (scope: ChainScope): boolean =>
    servicesOf(scope).size > 0

export const hasPeraService = (
    scope: ChainScope,
    service: PeraService,
): boolean => servicesOf(scope).has(service)

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
 * ARC-59 inbox app id/address for `scope`, or `null` where the inbox app is
 * not deployed.
 *
 * Returned `null` rather than TestNet's ids: those ids do not exist on another
 * chain, so building against them aims a wrong app id at the real chain's
 * algod. Group atomicity meant no funds moved, but it failed opaquely — the
 * caller now fails with a typed error instead.
 */
export const getArc59Config = (
    scope: ChainScope,
): { appId: bigint; appAddress: string } | null => {
    const networkId = findRow(ALGORAND_SCOPE_CONFIGS, scope)?.scope.networkId
    if (networkId === 'mainnet') return config.arc59.mainnet
    if (networkId === 'testnet') return config.arc59.testnet
    return null
}
