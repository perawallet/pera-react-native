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

import { type Network, Networks } from './models/network'
import { config } from './main'

/** Chain-intrinsic endpoints. Always the real active network — never falls back. */
type ChainConfig = {
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
type PeraServices = {
    backendUrl: string
    bidaliBaseUrl: string
    bidaliApiKey: string
    baanxBaseUrl: string
    baanxClientKey: string
    baanxTenantId: string
    // SWAP POINT: AB escrow card service (card creation + delegated-LSig `/lsig`).
    cardEscrowBaseUrl: string
    cardEscrowAuthToken: string
    cardW3CardAppId: string
    cardKillswitchAppId: string
    /**
     * Base64 of the compiled AutoDraw program, pinned per network. Lives beside
     * the app IDs because it is derived from them — the compile is deterministic
     * over (template, app IDs, genesis hash), so rotating either app ID
     * invalidates this pin and both must move together. Build-time only, never
     * remote config: a remotely-settable expected value would let whoever
     * controls it approve any program the wallet is asked to sign.
     */
    cardAutoDrawProgram: string
    cardUsdcAssetId: string
}

export type NetworkConfig = ChainConfig &
    PeraServices & {
        network: Network
        isTestnet: boolean
        isMainnet: boolean
    }

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
        // custom-network store, which `config` can't read — it's the leaf package
        // and must stay free of store dependencies. The blockchain-layer
        // resolvers overlay the store on top of this placeholder.
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
    cardEscrowBaseUrl: '',
    cardEscrowAuthToken: '',
    cardW3CardAppId: '',
    cardKillswitchAppId: '',
    cardAutoDrawProgram: '',
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
        cardEscrowBaseUrl: config.mainnetCardEscrowBaseUrl,
        cardEscrowAuthToken: config.mainnetCardEscrowAuthToken,
        cardW3CardAppId: config.mainnetCardW3CardAppId,
        cardKillswitchAppId: config.mainnetCardKillswitchAppId,
        cardAutoDrawProgram: config.mainnetCardAutoDrawProgram,
        cardUsdcAssetId: config.mainnetCardUsdcAssetId,
    },
    [Networks.testnet]: {
        backendUrl: config.testnetBackendUrl,
        bidaliBaseUrl: config.testnetBidaliBaseUrl,
        bidaliApiKey: config.testnetBidaliApiKey,
        baanxBaseUrl: config.testnetBaanxBaseUrl,
        baanxClientKey: config.testnetBaanxClientKey,
        baanxTenantId: config.testnetBaanxTenantId,
        cardEscrowBaseUrl: config.testnetCardEscrowBaseUrl,
        cardEscrowAuthToken: config.testnetCardEscrowAuthToken,
        cardW3CardAppId: config.testnetCardW3CardAppId,
        cardKillswitchAppId: config.testnetCardKillswitchAppId,
        cardAutoDrawProgram: config.testnetCardAutoDrawProgram,
        cardUsdcAssetId: config.testnetCardUsdcAssetId,
    },
    // No Pera deployment. Empty, never borrowed: createPeraClient turns an
    // empty backendUrl into a thrown PeraServiceUnavailableError.
    [Networks.betanet]: EMPTY_PERA_SERVICES,
    [Networks.custom]: EMPTY_PERA_SERVICES,
}

export const getNetworkConfig = (network: Network): NetworkConfig => ({
    network,
    isMainnet: isMainnet(network),
    isTestnet: isTestnet(network),
    ...chainConfigByNetwork[network],
    ...peraServicesByNetwork[network],
})

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
