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

import { afterEach, describe, expect, test } from 'vitest'
import {
    scopeForLegacyNetwork,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { UnconfiguredScopeError } from '../errors'
import { config } from '../main'
import { Networks, type Network } from '../models/network'
import {
    PERA_SERVICES,
    configuredScopes,
    getChainConfig,
    getNetworkConfig,
    getPeraServicesConfig,
    hasPeraService,
    isPeraBackedNetwork,
    peraServicesFor,
    registerCustomNetworkSource,
    type CustomNetworkEndpoints,
    type PeraService,
} from '../network-config'

const algorandScope = (network: Network): ChainScope =>
    scopeForLegacyNetwork(network)

// A chain id outside the compiled-in union, standing in for a chain package
// that is not built in.
const FIXTURE_MAINNET: ChainScope = {
    chainId: 'fixture' as unknown as ChainId,
    networkId: 'mainnet',
}

const SAVED_NODE: CustomNetworkEndpoints = {
    algodUrl: 'http://10.0.0.5:4001',
    indexerUrl: 'http://10.0.0.5:8980',
    algodToken: 'a'.repeat(64),
    indexerToken: 'b'.repeat(64),
    genesisHash: 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw=',
    genesisId: 'dockernet-v1',
}

const NO_PERA_SERVICES = {
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
}

const cleanups: Array<() => void> = []

const registerSavedCustomNode = (): void => {
    cleanups.push(
        registerCustomNetworkSource(scope =>
            scope.chainId === 'algorand' && scope.networkId === Networks.custom
                ? SAVED_NODE
                : undefined,
        ),
    )
}

afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup())
})

describe('getChainConfig', () => {
    test('mainnet resolves its baked endpoints', () => {
        expect(getChainConfig(algorandScope(Networks.mainnet))).toStrictEqual({
            algodUrl: config.mainnetAlgodUrl,
            indexerUrl: config.mainnetIndexerUrl,
            genesisHash: config.mainnetGenesisHash,
            genesisId: 'mainnet-v1.0',
            explorerUrl: config.mainnetExplorerUrl,
            algodToken: config.algodApiKey,
            indexerToken: config.indexerApiKey,
            dispenserUrl: config.mainnetDispenserUrl,
        })
    })

    test('testnet resolves its baked endpoints', () => {
        expect(getChainConfig(algorandScope(Networks.testnet))).toStrictEqual({
            algodUrl: config.testnetAlgodUrl,
            indexerUrl: config.testnetIndexerUrl,
            genesisHash: config.testnetGenesisHash,
            genesisId: 'testnet-v1.0',
            explorerUrl: config.testnetExplorerUrl,
            algodToken: config.algodApiKey,
            indexerToken: config.indexerApiKey,
            dispenserUrl: config.dispenserUrl,
        })
    })

    test('betanet resolves its public endpoints with no Pera token', () => {
        expect(getChainConfig(algorandScope(Networks.betanet))).toStrictEqual({
            algodUrl: config.betanetAlgodUrl,
            indexerUrl: config.betanetIndexerUrl,
            genesisHash: config.betanetGenesisHash,
            genesisId: 'betanet-v1.0',
            explorerUrl: config.betanetExplorerUrl,
            algodToken: '',
            indexerToken: '',
            dispenserUrl: 'https://lora.algokit.io/betanet/fund/',
        })
    })

    test('custom is the empty placeholder while no node is saved', () => {
        expect(getChainConfig(algorandScope(Networks.custom))).toStrictEqual({
            algodUrl: '',
            indexerUrl: '',
            genesisHash: '',
            genesisId: '',
            explorerUrl: '',
            algodToken: '',
            indexerToken: '',
            dispenserUrl: '',
        })
    })

    test('a saved custom node is laid over the placeholder, explorer and dispenser stay empty', () => {
        registerSavedCustomNode()

        expect(getChainConfig(algorandScope(Networks.custom))).toStrictEqual({
            ...SAVED_NODE,
            explorerUrl: '',
            dispenserUrl: '',
        })
    })

    test('the baked networks ignore the saved node', () => {
        const before = [
            Networks.mainnet,
            Networks.testnet,
            Networks.betanet,
        ].map(network => getChainConfig(algorandScope(network)))

        registerSavedCustomNode()

        expect(
            [Networks.mainnet, Networks.testnet, Networks.betanet].map(
                network => getChainConfig(algorandScope(network)),
            ),
        ).toStrictEqual(before)
    })

    test('unregistering the source restores the placeholder', () => {
        const unregister = registerCustomNetworkSource(() => SAVED_NODE)

        unregister()

        expect(getChainConfig(algorandScope(Networks.custom)).algodUrl).toBe('')
    })

    test('a stale unregister leaves a newer source in place', () => {
        const unregisterFirst = registerCustomNetworkSource(() => undefined)
        registerSavedCustomNode()

        unregisterFirst()

        expect(getChainConfig(algorandScope(Networks.custom)).algodUrl).toBe(
            SAVED_NODE.algodUrl,
        )
    })

    test('throws UnconfiguredScopeError for a scope no row configures', () => {
        expect(() => getChainConfig(FIXTURE_MAINNET)).toThrow(
            UnconfiguredScopeError,
        )
        expect(() =>
            getChainConfig({ chainId: 'algorand', networkId: 'fnet' }),
        ).toThrow(UnconfiguredScopeError)
    })

    test('a registered source cannot configure a scope that has no row', () => {
        cleanups.push(registerCustomNetworkSource(() => SAVED_NODE))

        expect(() => getChainConfig(FIXTURE_MAINNET)).toThrow(
            UnconfiguredScopeError,
        )
    })

    test('returns a copy, so a caller cannot change the table', () => {
        const scope = algorandScope(Networks.mainnet)

        getChainConfig(scope).algodUrl = 'https://mutated.example'

        expect(getChainConfig(scope).algodUrl).toBe(config.mainnetAlgodUrl)
    })
})

describe('getNetworkConfig', () => {
    test('serves the saved custom node too', () => {
        registerSavedCustomNode()

        expect(getNetworkConfig(Networks.custom)).toMatchObject({
            network: Networks.custom,
            ...SAVED_NODE,
            explorerUrl: '',
            dispenserUrl: '',
            ...NO_PERA_SERVICES,
        })
    })

    test('throws UnconfiguredScopeError for a network outside the union', () => {
        expect(() => getNetworkConfig('fnet' as unknown as Network)).toThrow(
            UnconfiguredScopeError,
        )
    })
})

describe('getPeraServicesConfig', () => {
    test('mainnet resolves its product endpoints', () => {
        expect(
            getPeraServicesConfig(algorandScope(Networks.mainnet)),
        ).toStrictEqual({
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
        })
    })

    test('testnet resolves its product endpoints', () => {
        expect(
            getPeraServicesConfig(algorandScope(Networks.testnet)),
        ).toStrictEqual({
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
        })
    })

    test.each([Networks.betanet, Networks.custom])(
        '%s has no Pera deployment',
        network => {
            expect(getPeraServicesConfig(algorandScope(network))).toStrictEqual(
                NO_PERA_SERVICES,
            )
        },
    )

    test('an unconfigured fixture chain gets empty values, not an error', () => {
        expect(getPeraServicesConfig(FIXTURE_MAINNET)).toStrictEqual(
            NO_PERA_SERVICES,
        )
    })
})

describe('peraServicesFor', () => {
    test('lists exactly the seven Pera services', () => {
        expect(PERA_SERVICES).toEqual([
            'accounts',
            'assets',
            'prices',
            'history',
            'devices',
            'notifications',
            'blockFollowing',
        ])
    })

    test.each([Networks.mainnet, Networks.testnet])(
        '%s has every Pera service',
        network => {
            expect(peraServicesFor(algorandScope(network))).toStrictEqual(
                new Set(PERA_SERVICES),
            )
        },
    )

    test.each([Networks.betanet, Networks.custom])('%s has none', network => {
        expect(peraServicesFor(algorandScope(network)).size).toBe(0)
    })

    test("a fixture chain's mainnet scope has none until its configuration lists some", () => {
        expect(peraServicesFor(FIXTURE_MAINNET).size).toBe(0)
    })

    test('returns a copy, so a caller cannot change the table', () => {
        const scope = algorandScope(Networks.mainnet)

        ;(peraServicesFor(scope) as Set<PeraService>).delete('prices')

        expect(hasPeraService(scope, 'prices')).toBe(true)
    })
})

describe('hasPeraService', () => {
    test('answers per scope and service', () => {
        expect(hasPeraService(algorandScope(Networks.mainnet), 'prices')).toBe(
            true,
        )
        expect(hasPeraService(algorandScope(Networks.betanet), 'prices')).toBe(
            false,
        )
        expect(hasPeraService(FIXTURE_MAINNET, 'prices')).toBe(false)
    })

    test('isPeraBackedNetwork holds exactly where the Algorand scope has every service', () => {
        const pairs = Object.values(Networks).map(network => ({
            isBacked: isPeraBackedNetwork(network),
            hasEvery: PERA_SERVICES.every(service =>
                hasPeraService(algorandScope(network), service),
            ),
        }))

        for (const { isBacked, hasEvery } of pairs) {
            expect(isBacked).toBe(hasEvery)
        }
        // Not vacuous: both outcomes occur.
        expect(pairs.map(pair => pair.isBacked)).toEqual(
            expect.arrayContaining([true, false]),
        )
    })
})

describe('configuredScopes', () => {
    test('lists the four Algorand scopes in network order', () => {
        expect(configuredScopes()).toStrictEqual(
            Object.values(Networks).map(network => ({
                chainId: 'algorand',
                networkId: network,
            })),
        )
    })
})
