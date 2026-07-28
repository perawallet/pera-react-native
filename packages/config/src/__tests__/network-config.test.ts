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

import { describe, test, expect } from 'vitest'
import { Networks } from '../models/network'
import { config } from '../main'
import {
    getArc59Config,
    getNetworkConfig,
    isMainnet,
    isTestnet,
} from '../network-config'

describe('network-config', () => {
    test('isMainnet returns correct boolean', () => {
        expect(isMainnet(Networks.mainnet)).toBe(true)
        expect(isMainnet(Networks.testnet)).toBe(false)
    })

    test('isTestnet is a real testnet check, not the mainnet inverse', () => {
        expect(isTestnet(Networks.testnet)).toBe(true)
        expect(isTestnet(Networks.mainnet)).toBe(false)
        expect(isTestnet(Networks.betanet)).toBe(false)
        expect(isTestnet(Networks.fnet)).toBe(false)
        expect(isTestnet(Networks.localnet)).toBe(false)
    })

    test('getNetworkConfig returns correct mainnet config', () => {
        const networkConfig = getNetworkConfig(Networks.mainnet)

        expect(networkConfig).toEqual({
            network: Networks.mainnet,
            isMainnet: true,
            isTestnet: false,
            backendUrl: config.mainnetBackendUrl,
            algodUrl: config.mainnetAlgodUrl,
            indexerUrl: config.mainnetIndexerUrl,
            genesisHash: config.mainnetGenesisHash,
            explorerUrl: config.mainnetExplorerUrl,
            algodToken: config.algodApiKey,
            indexerToken: config.indexerApiKey,
            dispenserUrl: config.mainnetDispenserUrl,
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
        })
    })

    test('getNetworkConfig returns correct testnet config', () => {
        const networkConfig = getNetworkConfig(Networks.testnet)

        expect(networkConfig).toEqual({
            network: Networks.testnet,
            isMainnet: false,
            isTestnet: true,
            backendUrl: config.testnetBackendUrl,
            algodUrl: config.testnetAlgodUrl,
            indexerUrl: config.testnetIndexerUrl,
            genesisHash: config.testnetGenesisHash,
            explorerUrl: config.testnetExplorerUrl,
            algodToken: config.algodApiKey,
            indexerToken: config.indexerApiKey,
            dispenserUrl: config.dispenserUrl,
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
        })
    })

    test('chain identity comes from the real network, never the fallback', () => {
        const fnet = getNetworkConfig(Networks.fnet)

        expect(fnet.algodUrl).toBe(config.fnetAlgodUrl)
        expect(fnet.indexerUrl).toBe(config.fnetIndexerUrl)
        expect(fnet.genesisHash).toBe(config.fnetGenesisHash)
        // The invariant that makes cross-network signing impossible.
        expect(fnet.genesisHash).not.toBe(config.testnetGenesisHash)
    })

    test('pera services on a fallback network come from the testnet lane', () => {
        const fnet = getNetworkConfig(Networks.fnet)

        expect(fnet.backendUrl).toBe(config.testnetBackendUrl)
        expect(fnet.baanxBaseUrl).toBe(config.testnetBaanxBaseUrl)
        expect(fnet.cardUsdcAssetId).toBe(config.testnetCardUsdcAssetId)
    })

    test('localnet carries its own algod token', () => {
        expect(getNetworkConfig(Networks.localnet).algodToken).toBe(
            config.localnetAlgodToken,
        )
        expect(getNetworkConfig(Networks.mainnet).algodToken).toBe(
            config.algodApiKey,
        )
    })

    test('getArc59Config falls back to testnet app ids', () => {
        expect(getArc59Config(Networks.mainnet)).toEqual(config.arc59.mainnet)
        expect(getArc59Config(Networks.fnet)).toEqual(config.arc59.testnet)
    })
})

describe('getNetworkConfig genesisHash', () => {
    test('returns the canonical mainnet genesis hash', () => {
        expect(getNetworkConfig('mainnet').genesisHash).toBe(
            'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        )
    })

    test('returns the canonical testnet genesis hash', () => {
        expect(getNetworkConfig('testnet').genesisHash).toBe(
            'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
        )
    })
})
