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
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { UnconfiguredScopeError } from './errors'
import { type Network, Networks } from './models/network'
import { config } from './main'

/** Chain-intrinsic endpoints. Always the real active network — never falls back. */
export type ChainConfig = {
    algodUrl: string
    indexerUrl: string
    genesisHash: string
    genesisId: string
    explorerUrl: string
    algodToken: string
    indexerToken: string
    dispenserUrl: string
}

/** Empty outside `PeraBackedNetwork`s — never borrowed from another network. */
export type PeraServices = {
    backendUrl: string
    bidaliBaseUrl: string
    bidaliApiKey: string
    baanxBaseUrl: string
    baanxClientKey: string
    baanxTenantId: string
    cardW3CardAppId: string
    cardKillswitchAppId: string
    /**
     * Lowercase hex SHA-256 of the compiled AutoDraw program, pinned per
     * network. Lives beside the app IDs because it is derived from them — the
     * compile is deterministic over (template, app IDs, genesis hash), so
     * rotating either app ID invalidates this pin and both must move together.
     * Build-time only, never remote config: a remotely-settable expected value
     * would let whoever controls it approve any program the wallet is asked to
     * sign.
     */
    cardAutoDrawProgramHash: string
    cardUsdcAssetId: string
}

export type NetworkConfig = ChainConfig &
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
    ChainConfig,
    | 'algodUrl'
    | 'indexerUrl'
    | 'algodToken'
    | 'indexerToken'
    | 'genesisHash'
    | 'genesisId'
>

export type CustomNetworkSource = (
    scope: ChainScope,
) => CustomNetworkEndpoints | undefined

export const isTestnet = (network: Network) => network === Networks.testnet
export const isMainnet = (network: Network) => network === Networks.mainnet

const chainConfigByNetwork: Record<Network, ChainConfig> = {
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
    cardW3CardAppId: '',
    cardKillswitchAppId: '',
    cardAutoDrawProgramHash: '',
    cardUsdcAssetId: '',
} satisfies PeraServices

/**
 * `Record<Network, …>`, not `Partial<…>` plus a fallback: a fifth network added
 * to the union fails TypeScript here until someone decides its Pera services,
 * rather than silently resolving to TestNet's deployment. Same reasoning as
 * `EXPECTED_CHAIN_ID_BY_NETWORK` in the walletconnect package.
 */
const peraServicesByNetwork: Record<Network, PeraServices> = {
    [Networks.mainnet]: {
        backendUrl: config.mainnetBackendUrl,
        bidaliBaseUrl: config.mainnetBidaliBaseUrl,
        bidaliApiKey: config.mainnetBidaliApiKey,
        baanxBaseUrl: config.mainnetBaanxBaseUrl,
        baanxClientKey: config.mainnetBaanxClientKey,
        baanxTenantId: config.mainnetBaanxTenantId,
        cardW3CardAppId: config.mainnetCardW3CardAppId,
        cardKillswitchAppId: config.mainnetCardKillswitchAppId,
        cardAutoDrawProgramHash: config.mainnetCardAutoDrawProgramHash,
        cardUsdcAssetId: config.mainnetCardUsdcAssetId,
    },
    [Networks.testnet]: {
        backendUrl: config.testnetBackendUrl,
        bidaliBaseUrl: config.testnetBidaliBaseUrl,
        bidaliApiKey: config.testnetBidaliApiKey,
        baanxBaseUrl: config.testnetBaanxBaseUrl,
        baanxClientKey: config.testnetBaanxClientKey,
        baanxTenantId: config.testnetBaanxTenantId,
        cardW3CardAppId: config.testnetCardW3CardAppId,
        cardKillswitchAppId: config.testnetCardKillswitchAppId,
        cardAutoDrawProgramHash: config.testnetCardAutoDrawProgramHash,
        cardUsdcAssetId: config.testnetCardUsdcAssetId,
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

type ScopeConfig = {
    scope: ChainScope
    chain: ChainConfig
    peraServices: PeraServices
    services: ReadonlySet<PeraService>
}

const SCOPE_CONFIGS: readonly ScopeConfig[] = Object.values(Networks).map(
    network => ({
        scope: scopeForLegacyNetwork(network),
        chain: chainConfigByNetwork[network],
        peraServices: peraServicesByNetwork[network],
        services: new Set(peraServiceNamesByNetwork[network]),
    }),
)

// Compared field by field, not through toScopeKey: that validates the chain id
// against the compiled-in union and throws for a test's fixture chain, and
// nothing here is persisted.
const findScopeConfig = (scope: ChainScope): ScopeConfig | undefined =>
    SCOPE_CONFIGS.find(
        row =>
            row.scope.chainId === scope.chainId &&
            row.scope.networkId === scope.networkId,
    )

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
export const getChainConfig = (scope: ChainScope): ChainConfig => {
    const row = findScopeConfig(scope)
    if (row === undefined) {
        throw new UnconfiguredScopeError(scope)
    }
    return { ...row.chain, ...customNetworkSource?.(scope) }
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
