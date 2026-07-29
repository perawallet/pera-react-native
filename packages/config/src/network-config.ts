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
import {
    type PeraServiceLane,
    resolvePeraServiceLane,
} from './pera-service-fallback'

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

/** Pera-ecosystem services. Resolved via the lane, so may be borrowed. */
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
        // Deliberately empty, NOT config.algodApiKey/indexerApiKey: those are
        // Pera's own injected secrets, and betanet's algod/indexer are public
        // third-party endpoints (algonode.cloud) Pera does not control and
        // that need no token. Sending Pera's real credential to a host Pera
        // doesn't operate is a needless credential leak. The client factories
        // (createTokenHeaderClient in query-client.ts, TimeoutHttpClient) skip
        // the auth header entirely when the token is empty, so this is safe.
        algodToken: '',
        indexerToken: '',
        dispenserUrl: 'https://lora.algokit.io/betanet/fund/',
    },
    [Networks.fnet]: {
        algodUrl: config.fnetAlgodUrl,
        indexerUrl: config.fnetIndexerUrl,
        genesisHash: config.fnetGenesisHash,
        genesisId: 'fnet-v1',
        explorerUrl: config.fnetExplorerUrl,
        // See the betanet entry above — same reasoning: fnet's algod/indexer
        // (nodely.dev) are public third-party endpoints, not Pera's, and need
        // no token.
        algodToken: '',
        indexerToken: '',
        dispenserUrl: 'https://lora.algokit.io/fnet/fund/',
    },
    [Networks.localnet]: {
        algodUrl: config.localnetAlgodUrl,
        indexerUrl: config.localnetIndexerUrl,
        // Regenerated on every container reset — resolved at runtime.
        genesisHash: '',
        // Container-dependent, like genesisHash above: 'dockernet-v1' is
        // AlgoKit LocalNet's conventional default, but a later task introduces
        // runtime resolution — this literal is not authoritative.
        genesisId: 'dockernet-v1',
        explorerUrl: config.localnetExplorerUrl,
        algodToken: config.localnetAlgodToken,
        indexerToken: config.localnetAlgodToken,
        dispenserUrl: 'https://lora.algokit.io/localnet/fund/',
    },
}

const peraServicesByLane: Record<PeraServiceLane, PeraServices> = {
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
        cardUsdcAssetId: config.testnetCardUsdcAssetId,
    },
}

export const getNetworkConfig = (network: Network): NetworkConfig => ({
    network,
    isMainnet: isMainnet(network),
    isTestnet: isTestnet(network),
    ...chainConfigByNetwork[network],
    ...peraServicesByLane[resolvePeraServiceLane(network)],
})

/**
 * ARC-59 inbox app id/address for the network's Pera service lane. The inbox
 * app is only deployed on the two Pera-backed networks.
 */
export const getArc59Config = (network: Network) =>
    resolvePeraServiceLane(network) === Networks.mainnet
        ? config.arc59.mainnet
        : config.arc59.testnet
