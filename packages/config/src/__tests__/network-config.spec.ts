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

import { describe, test, expect, vi } from 'vitest'
import {
    LEGACY_NETWORKS,
    type ChainScope,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import { config } from '../main'
import {
    configuredScopes,
    getAlgorandChainConfig,
    getArc59Config,
    getIframeOrigins,
    getPeraServicesConfig,
    hasPeraBackend,
} from '../network-config'

const algorand = (networkId: NetworkId): ChainScope => ({
    chainId: 'algorand',
    networkId,
})

describe('network-config', () => {
    test('mainnet carries its chain endpoints and live Pera services', () => {
        const scope = algorand('mainnet')

        expect(getAlgorandChainConfig(scope)).toEqual({
            algodUrl: config.mainnetAlgodUrl,
            indexerUrl: config.mainnetIndexerUrl,
            genesisHash: config.mainnetGenesisHash,
            genesisId: 'mainnet-v1.0',
            explorerUrl: config.mainnetExplorerUrl,
            algodToken: config.algodApiKey,
            indexerToken: config.indexerApiKey,
            dispenserUrl: config.mainnetDispenserUrl,
        })
        expect(getPeraServicesConfig(scope)).toEqual({
            backendUrl: config.mainnetBackendUrl,
            bidaliBaseUrl: config.mainnetBidaliBaseUrl,
            bidaliApiKey: config.mainnetBidaliApiKey,
            baanxBaseUrl: config.mainnetBaanxBaseUrl,
            baanxClientKey: config.mainnetBaanxClientKey,
            baanxTenantId: config.mainnetBaanxTenantId,
        })
    })

    test('testnet carries its chain endpoints and developer Pera services', () => {
        const scope = algorand('testnet')

        expect(getAlgorandChainConfig(scope)).toEqual({
            algodUrl: config.testnetAlgodUrl,
            indexerUrl: config.testnetIndexerUrl,
            genesisHash: config.testnetGenesisHash,
            genesisId: 'testnet-v1.0',
            explorerUrl: config.testnetExplorerUrl,
            algodToken: config.algodApiKey,
            indexerToken: config.indexerApiKey,
            dispenserUrl: config.dispenserUrl,
        })
        expect(getPeraServicesConfig(scope)).toEqual({
            backendUrl: config.testnetBackendUrl,
            bidaliBaseUrl: config.testnetBidaliBaseUrl,
            bidaliApiKey: config.testnetBidaliApiKey,
            baanxBaseUrl: config.testnetBaanxBaseUrl,
            baanxClientKey: config.testnetBaanxClientKey,
            baanxTenantId: config.testnetBaanxTenantId,
        })
    })

    test('custom carries no baked chain config', () => {
        const custom = getAlgorandChainConfig(algorand('custom'))

        expect(custom.algodUrl).toBe('')
        expect(custom.indexerUrl).toBe('')
        expect(custom.genesisHash).toBe('')
        expect(custom.genesisId).toBe('')
        expect(custom.explorerUrl).toBe('')
        expect(custom.dispenserUrl).toBe('')
    })

    test('hasPeraBackend is true only where a Pera backend is deployed', () => {
        expect(hasPeraBackend(algorand('mainnet'))).toBe(true)
        expect(hasPeraBackend(algorand('testnet'))).toBe(true)
        expect(hasPeraBackend(algorand('betanet'))).toBe(false)
        expect(hasPeraBackend(algorand('custom'))).toBe(false)
    })

    test('hasPeraBackend follows the Ethereum service list', () => {
        expect(
            hasPeraBackend({ chainId: 'ethereum', networkId: 'mainnet' }),
        ).toBe(config.ethereumMainnetPeraServices.length > 0)
        expect(
            hasPeraBackend({ chainId: 'ethereum', networkId: 'sepolia' }),
        ).toBe(config.ethereumSepoliaPeraServices.length > 0)
    })

    test('networks without a Pera deployment get empty services, never borrowed ones', () => {
        // betanet's backendUrl must not be testnet's. Asserting inequality with
        // the real testnet value is what makes this test fail if that
        // borrowing ever comes back.
        const testnetBackend = getPeraServicesConfig(
            algorand('testnet'),
        ).backendUrl
        expect(testnetBackend).not.toBe('')

        for (const network of ['betanet', 'custom']) {
            const services = getPeraServicesConfig(algorand(network))

            expect(services.backendUrl).toBe('')
            expect(services.backendUrl).not.toBe(testnetBackend)
            expect(services.bidaliBaseUrl).toBe('')
            expect(services.baanxBaseUrl).toBe('')
        }
    })

    test('chain truth is untouched by the Pera-services change', () => {
        // Guards the one thing that must NOT go empty alongside the services.
        const betanet = getAlgorandChainConfig(algorand('betanet'))

        expect(betanet.algodUrl).not.toBe('')
        expect(betanet.genesisHash).not.toBe('')
    })

    test('betanet keeps its pinned chain identity', () => {
        const betanet = getAlgorandChainConfig(algorand('betanet'))

        expect(betanet.genesisHash).toBe(config.betanetGenesisHash)
        expect(betanet.genesisId).toBe('betanet-v1.0')
        expect(betanet.genesisHash).not.toBe(config.testnetGenesisHash)
    })

    test('betanet and custom carry no algod/indexer token, even with a real key configured', async () => {
        // These endpoints are public third-party hosts Pera doesn't control,
        // so sending Pera's real API keys would leak them.
        //
        // The keys are blank in this environment, so a bare `=== ''` assertion
        // would pass whether the token is hardcoded empty or still wired to
        // `config.algodApiKey`. Mocking a non-empty key is what makes the two
        // cases observably different.
        vi.resetModules()
        vi.doMock('../main', async importOriginal => {
            const actual = await importOriginal<typeof import('../main')>()
            return {
                ...actual,
                config: {
                    ...actual.config,
                    algodApiKey: 'REAL_PERA_ALGOD_SECRET',
                    indexerApiKey: 'REAL_PERA_INDEXER_SECRET',
                },
            }
        })

        const { getAlgorandChainConfig: freshChainConfig } =
            await import('../network-config')

        // The mock took effect: mainnet correctly uses the real key.
        expect(freshChainConfig(algorand('mainnet')).algodToken).toBe(
            'REAL_PERA_ALGOD_SECRET',
        )
        // betanet/custom must not, even though the same real secret is
        // configured for the process.
        for (const network of ['betanet', 'custom']) {
            expect(freshChainConfig(algorand(network)).algodToken).toBe('')
            expect(freshChainConfig(algorand(network)).indexerToken).toBe('')
        }

        vi.doUnmock('../main')
    })
})

describe('getArc59Config', () => {
    test('returns the inbox app of Algorand MainNet and TestNet', () => {
        expect(getArc59Config(algorand('mainnet'))).toEqual(
            config.arc59.mainnet,
        )
        expect(getArc59Config(algorand('testnet'))).toEqual(
            config.arc59.testnet,
        )
    })

    test('is null where the inbox app is not deployed', () => {
        // TestNet's app id aimed at another chain would fail opaquely.
        expect(getArc59Config(algorand('betanet'))).toBeNull()
        expect(getArc59Config(algorand('custom'))).toBeNull()
        expect(
            getArc59Config({ chainId: 'ethereum', networkId: 'mainnet' }),
        ).toBeNull()
    })
})

describe('Algorand genesis', () => {
    test('returns the canonical genesis hashes', () => {
        expect(getAlgorandChainConfig(algorand('mainnet')).genesisHash).toBe(
            'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        )
        expect(getAlgorandChainConfig(algorand('testnet')).genesisHash).toBe(
            'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
        )
    })

    test('returns the canonical genesis ids', () => {
        expect(getAlgorandChainConfig(algorand('mainnet')).genesisId).toBe(
            'mainnet-v1.0',
        )
        expect(getAlgorandChainConfig(algorand('testnet')).genesisId).toBe(
            'testnet-v1.0',
        )
        expect(getAlgorandChainConfig(algorand('betanet')).genesisId).toBe(
            'betanet-v1.0',
        )
    })
})

describe('getIframeOrigins', () => {
    test('adds the giftcards twin a commerce host redirects to', () => {
        expect(
            getIframeOrigins('https://commerce.staging.bidali.com/dapp'),
        ).toEqual([
            'https://commerce.staging.bidali.com',
            'https://giftcards.staging.bidali.com',
        ])
    })

    test('returns only its own origin for any other host', () => {
        expect(
            getIframeOrigins('https://discover-mobile.perawallet.app/main'),
        ).toEqual(['https://discover-mobile.perawallet.app'])
    })

    test('returns nothing for an empty or malformed URL', () => {
        expect(getIframeOrigins('')).toEqual([])
        expect(getIframeOrigins('not a url')).toEqual([])
    })
})

describe('Algorand scope rows', () => {
    // Stored network columns are decoded against LEGACY_NETWORKS, so a network
    // missing there would make its existing rows unreadable.
    test('configure the same networks as the chain contract', () => {
        const configured = configuredScopes()
            .filter(scope => scope.chainId === 'algorand')
            .map(scope => scope.networkId)

        expect([...configured].sort()).toEqual([...LEGACY_NETWORKS].sort())
    })
})
