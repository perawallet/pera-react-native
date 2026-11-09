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

import { afterEach, describe, expect, test, vi } from 'vitest'
import {
    EVM_CHAIN_NETWORKS,
    type ChainId,
    type ChainScope,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import { UnconfiguredScopeError } from '../errors'
import { config } from '../main'
import {
    PERA_SERVICES,
    configuredScopes,
    getAlgorandChainConfig,
    getChainConfig,
    getPeraDeploymentConfig,
    getPeraServicesConfig,
    hasPeraBackend,
    hasPeraService,
    deploymentOf,
    peraDeploymentOf,
    peraServicesFor,
    registerCustomNetworkSource,
    setPeraBackendSwitch,
    type CustomNetworkEndpoints,
    type PeraService,
} from '../network-config'

const algorandScope = (networkId: NetworkId) =>
    ({ chainId: 'algorand', networkId }) as const

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
}

const cleanups: Array<() => void> = []

const registerSavedCustomNode = (): void => {
    cleanups.push(
        registerCustomNetworkSource(scope =>
            scope.chainId === 'algorand' && scope.networkId === 'custom'
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
        expect(getChainConfig(algorandScope('mainnet'))).toStrictEqual({
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
        expect(getChainConfig(algorandScope('testnet'))).toStrictEqual({
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
        expect(getChainConfig(algorandScope('betanet'))).toStrictEqual({
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
        expect(getChainConfig(algorandScope('custom'))).toStrictEqual({
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

        expect(getChainConfig(algorandScope('custom'))).toStrictEqual({
            ...SAVED_NODE,
            explorerUrl: '',
            dispenserUrl: '',
        })
    })

    test('the baked networks ignore the saved node', () => {
        const before = ['mainnet', 'testnet', 'betanet'].map(network =>
            getChainConfig(algorandScope(network)),
        )

        registerSavedCustomNode()

        expect(
            ['mainnet', 'testnet', 'betanet'].map(network =>
                getChainConfig(algorandScope(network)),
            ),
        ).toStrictEqual(before)
    })

    test('unregistering the source restores the placeholder', () => {
        const unregister = registerCustomNetworkSource(() => SAVED_NODE)

        unregister()

        expect(getChainConfig(algorandScope('custom')).algodUrl).toBe('')
    })

    test('a stale unregister leaves a newer source in place', () => {
        const unregisterFirst = registerCustomNetworkSource(() => undefined)
        registerSavedCustomNode()

        unregisterFirst()

        expect(getChainConfig(algorandScope('custom')).algodUrl).toBe(
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
        const scope = algorandScope('mainnet')

        getChainConfig(scope).algodUrl = 'https://mutated.example'

        expect(getChainConfig(scope).algodUrl).toBe(config.mainnetAlgodUrl)
    })
})

describe('getAlgorandChainConfig', () => {
    test('serves the saved custom node too', () => {
        registerSavedCustomNode()

        expect(getAlgorandChainConfig(algorandScope('custom'))).toMatchObject({
            ...SAVED_NODE,
            explorerUrl: '',
            dispenserUrl: '',
        })
        expect(getPeraServicesConfig(algorandScope('custom'))).toStrictEqual(
            NO_PERA_SERVICES,
        )
    })

    test('throws UnconfiguredScopeError for a network no row configures', () => {
        expect(() => getAlgorandChainConfig(algorandScope('fnet'))).toThrow(
            UnconfiguredScopeError,
        )
    })

    test('throws UnconfiguredScopeError for another chain', () => {
        expect(() =>
            getAlgorandChainConfig({
                chainId: 'ethereum',
                networkId: 'mainnet',
            }),
        ).toThrow(UnconfiguredScopeError)
    })
})

describe('getPeraServicesConfig', () => {
    test('mainnet resolves its product endpoints', () => {
        expect(getPeraServicesConfig(algorandScope('mainnet'))).toStrictEqual({
            backendUrl: config.mainnetBackendUrl,
            bidaliBaseUrl: config.mainnetBidaliBaseUrl,
            bidaliApiKey: config.mainnetBidaliApiKey,
            baanxBaseUrl: config.mainnetBaanxBaseUrl,
            baanxClientKey: config.mainnetBaanxClientKey,
            baanxTenantId: config.mainnetBaanxTenantId,
        })
    })

    test('testnet resolves its product endpoints', () => {
        expect(getPeraServicesConfig(algorandScope('testnet'))).toStrictEqual({
            backendUrl: config.testnetBackendUrl,
            bidaliBaseUrl: config.testnetBidaliBaseUrl,
            bidaliApiKey: config.testnetBidaliApiKey,
            baanxBaseUrl: config.testnetBaanxBaseUrl,
            baanxClientKey: config.testnetBaanxClientKey,
            baanxTenantId: config.testnetBaanxTenantId,
        })
    })

    test.each(['betanet', 'custom'])('%s has no Pera deployment', network => {
        expect(getPeraServicesConfig(algorandScope(network))).toStrictEqual(
            NO_PERA_SERVICES,
        )
    })

    test('an unconfigured fixture chain gets empty values, not an error', () => {
        expect(getPeraServicesConfig(FIXTURE_MAINNET)).toStrictEqual(
            NO_PERA_SERVICES,
        )
    })
})

describe('Pera deployments', () => {
    test.each([
        ['live', 'mainnet'],
        ['developer', 'testnet'],
    ] as const)(
        "the %s deployment is the %s Algorand scope's Pera services",
        (deployment, network) => {
            expect(getPeraDeploymentConfig(deployment)).toStrictEqual(
                getPeraServicesConfig(algorandScope(network)),
            )
        },
    )

    test.each([
        ['mainnet', 'live'],
        ['testnet', 'developer'],
        ['betanet', undefined],
        ['custom', undefined],
    ] as const)('algorand/%s is served by %s', (network, deployment) => {
        expect(peraDeploymentOf(algorandScope(network))).toBe(deployment)
    })

    test('an unconfigured fixture chain has no deployment', () => {
        expect(peraDeploymentOf(FIXTURE_MAINNET)).toBeUndefined()
    })
})

describe('deploymentOf', () => {
    test('is the deployment serving the scope', () => {
        expect(deploymentOf(algorandScope('testnet'))).toBe('developer')
    })

    test('is null for a scope no deployment serves, or no scope', () => {
        expect(deploymentOf(algorandScope('betanet'))).toBeNull()
        expect(deploymentOf(null)).toBeNull()
    })
})

describe('peraServicesFor', () => {
    test('lists exactly the ten Pera services', () => {
        expect(PERA_SERVICES).toEqual([
            'accounts',
            'assets',
            'prices',
            'history',
            'devices',
            'notifications',
            'blockFollowing',
            'nfts',
            'contracts',
            'simulations',
        ])
    })

    test.each(['mainnet', 'testnet'])('%s has every Pera service', network => {
        expect(peraServicesFor(algorandScope(network))).toStrictEqual(
            new Set(PERA_SERVICES),
        )
    })

    test.each(['betanet', 'custom'])('%s has none', network => {
        expect(peraServicesFor(algorandScope(network)).size).toBe(0)
    })

    test("a fixture chain's mainnet scope has none until its configuration lists some", () => {
        expect(peraServicesFor(FIXTURE_MAINNET).size).toBe(0)
    })

    test('returns a copy, so a caller cannot change the table', () => {
        const scope = algorandScope('mainnet')

        ;(peraServicesFor(scope) as Set<PeraService>).delete('prices')

        expect(hasPeraService(scope, 'prices')).toBe(true)
    })
})

describe('the Pera backend switch', () => {
    afterEach(() => setPeraBackendSwitch(() => false))

    test('lists no services for a switched-off chain only', () => {
        const algorand = algorandScope('mainnet')
        setPeraBackendSwitch(chainId => chainId === 'ethereum')

        expect(hasPeraBackend(algorand)).toBe(true)

        setPeraBackendSwitch(chainId => chainId === algorand.chainId)

        expect(hasPeraBackend(algorand)).toBe(false)
        expect(hasPeraService(algorand, 'prices')).toBe(false)
        expect(peraServicesFor(algorand).size).toBe(0)
    })

    test('leaves the scope on its deployment, so device ids and deployment requests are unaffected', () => {
        const scope = algorandScope('mainnet')
        const deployment = peraDeploymentOf(scope)
        setPeraBackendSwitch(() => true)

        expect(peraDeploymentOf(scope)).toBe(deployment)
        expect(getPeraServicesConfig(scope).backendUrl).not.toBe('')
    })

    test('lists the services again once the chain is switched back on', () => {
        const scope = algorandScope('mainnet')
        setPeraBackendSwitch(() => true)
        setPeraBackendSwitch(() => false)

        expect(hasPeraBackend(scope)).toBe(true)
    })
})

describe('hasPeraService', () => {
    test('answers per scope and service', () => {
        expect(hasPeraService(algorandScope('mainnet'), 'prices')).toBe(true)
        expect(hasPeraService(algorandScope('betanet'), 'prices')).toBe(false)
        expect(hasPeraService(FIXTURE_MAINNET, 'prices')).toBe(false)
    })

    test('hasPeraBackend holds exactly where the Algorand scope has every service', () => {
        const pairs = ['mainnet', 'testnet', 'betanet', 'custom'].map(
            network => ({
                isBacked: hasPeraBackend(algorandScope(network)),
                hasEvery: PERA_SERVICES.every(service =>
                    hasPeraService(algorandScope(network), service),
                ),
            }),
        )

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
    test('lists the Algorand scopes in network order, then every EVM network in table order', () => {
        expect(configuredScopes()).toStrictEqual([
            ...['mainnet', 'testnet', 'betanet', 'custom'].map(network => ({
                chainId: 'algorand',
                networkId: network,
            })),
            ...Object.entries(EVM_CHAIN_NETWORKS).flatMap(
                ([chainId, { networks }]) =>
                    networks.map(network => ({
                        chainId,
                        networkId: network.id,
                    })),
            ),
        ])
        expect(configuredScopes()).toContainEqual({
            chainId: 'base',
            networkId: 'sepolia',
        })
    })
})

type EthereumValues = Partial<typeof config>

// `config` is frozen at import, so a configured value needs fresh modules.
const withEthereumConfig = async (values: EthereumValues) => {
    vi.resetModules()
    vi.doMock('../main', async importOriginal => {
        const actual = await importOriginal<typeof import('../main')>()
        return { ...actual, config: { ...actual.config, ...values } }
    })
    const networkConfig = await import('../network-config')
    const errors = await import('../errors')
    const { config: mocked } = await import('../main')
    return { ...networkConfig, ...errors, config: mocked }
}

const ETHEREUM_MAINNET: ChainScope = {
    chainId: 'ethereum',
    networkId: 'mainnet',
}
const ETHEREUM_SEPOLIA: ChainScope = {
    chainId: 'ethereum',
    networkId: 'sepolia',
}

describe('ethereum scopes', () => {
    afterEach(() => {
        vi.doUnmock('../main')
        vi.resetModules()
    })

    test('getChainConfig returns the configured RPC URL per network', async () => {
        const { getChainConfig: fresh } = await withEthereumConfig({
            ethereumMainnetRpcUrl: ['https://mainnet.rpc.example'],
            ethereumSepoliaRpcUrl: ['https://sepolia.rpc.example'],
        })

        expect(
            fresh({ chainId: 'ethereum', networkId: 'sepolia' }),
        ).toStrictEqual({ rpcUrls: ['https://sepolia.rpc.example'] })
        expect(
            fresh({ chainId: 'ethereum', networkId: 'mainnet' }),
        ).toStrictEqual({ rpcUrls: ['https://mainnet.rpc.example'] })
    })

    test('a registered custom-node source never reaches an Ethereum scope', async () => {
        const { getChainConfig: fresh, registerCustomNetworkSource: register } =
            await withEthereumConfig({
                ethereumSepoliaRpcUrl: ['https://sepolia.rpc.example'],
            })
        const unregister = register(() => SAVED_NODE)

        try {
            expect(fresh(ETHEREUM_SEPOLIA)).toStrictEqual({
                rpcUrls: ['https://sepolia.rpc.example'],
            })
        } finally {
            unregister()
        }
    })

    test('a network without an RPC URL is unconfigured', async () => {
        const { getChainConfig: fresh, UnconfiguredScopeError: FreshError } =
            await withEthereumConfig({
                ethereumMainnetRpcUrl: ['https://mainnet.rpc.example'],
                ethereumSepoliaRpcUrl: [],
            })

        expect(() => fresh(ETHEREUM_SEPOLIA)).toThrow(FreshError)
    })

    test('getAlgorandChainConfig refuses an Ethereum scope', async () => {
        const { getAlgorandChainConfig, UnconfiguredScopeError: FreshError } =
            await withEthereumConfig({
                ethereumMainnetRpcUrl: ['https://mainnet.rpc.example'],
            })

        expect(() => getAlgorandChainConfig(ETHEREUM_MAINNET)).toThrow(
            FreshError,
        )
    })

    test('getAlgorandChainConfig serves an Algorand scope', async () => {
        const { getAlgorandChainConfig, config: fresh } =
            await withEthereumConfig({})

        expect(getAlgorandChainConfig(algorandScope('mainnet')).algodUrl).toBe(
            fresh.mainnetAlgodUrl,
        )
    })

    test('peraServicesFor reflects the configured list', async () => {
        const { peraServicesFor: fresh, hasPeraService: freshHas } =
            await withEthereumConfig({
                ethereumMainnetPeraServices: ['prices', 'history'],
            })

        expect(fresh(ETHEREUM_MAINNET)).toStrictEqual(
            new Set(['prices', 'history']),
        )
        expect(freshHas(ETHEREUM_MAINNET, 'prices')).toBe(true)
        expect(freshHas(ETHEREUM_MAINNET, 'assets')).toBe(false)
    })

    test.each([
        [ETHEREUM_MAINNET, 'mainnetBackendUrl'],
        [ETHEREUM_SEPOLIA, 'testnetBackendUrl'],
    ] as const)(
        '%o reuses the Pera base URL of its tier',
        async (scope, backendField) => {
            const { getPeraServicesConfig: fresh, config: freshConfig } =
                await withEthereumConfig({
                    ethereumMainnetPeraServices: ['assets'],
                    ethereumSepoliaPeraServices: ['assets'],
                })

            expect(fresh(scope)).toStrictEqual({
                ...NO_PERA_SERVICES,
                backendUrl: freshConfig[backendField],
            })
        },
    )

    test.each([
        [ETHEREUM_MAINNET, 'live'],
        [ETHEREUM_SEPOLIA, 'developer'],
    ] as const)('%o is served by the %s deployment', async (scope, tier) => {
        const { peraDeploymentOf: fresh } = await withEthereumConfig({
            ethereumMainnetPeraServices: ['assets'],
            ethereumSepoliaPeraServices: ['assets'],
        })

        expect(fresh(scope)).toBe(tier)
    })

    // The query client refuses every Pera request for a scope with no
    // deployment, so an empty list must drop it too.
    test('an empty list leaves the scope with no Pera deployment', async () => {
        const {
            getPeraServicesConfig: fresh,
            peraDeploymentOf: freshDeployment,
            peraServicesFor: freshFor,
        } = await withEthereumConfig({ ethereumMainnetPeraServices: [] })

        expect(freshFor(ETHEREUM_MAINNET).size).toBe(0)
        expect(fresh(ETHEREUM_MAINNET)).toStrictEqual(NO_PERA_SERVICES)
        expect(freshDeployment(ETHEREUM_MAINNET)).toBeUndefined()
    })
})

describe('chains the Pera backend refuses', () => {
    const withBothEthereumNetworks = () =>
        withEthereumConfig({
            ethereumMainnetPeraServices: ['assets', 'history'],
            ethereumSepoliaPeraServices: ['assets', 'history'],
        })

    afterEach(() => {
        vi.doUnmock('../main')
        vi.resetModules()
    })

    test('a chain list without a scope of its deployment leaves that scope no services, and keeps the listed ones', async () => {
        const fresh = await withBothEthereumNetworks()
        const algorand = algorandScope('mainnet')

        fresh.setPeraServedScopes('live', [algorand])

        expect(fresh.isPeraScopeRefused(ETHEREUM_MAINNET)).toBe(true)
        expect(fresh.peraServicesFor(ETHEREUM_MAINNET).size).toBe(0)
        expect(fresh.hasPeraBackend(ETHEREUM_MAINNET)).toBe(false)
        expect(fresh.isPeraScopeRefused(algorand)).toBe(false)
        expect(fresh.hasPeraService(algorand, 'prices')).toBe(true)
    })

    test("one deployment's list leaves the other deployment's scopes alone", async () => {
        const fresh = await withBothEthereumNetworks()

        fresh.setPeraServedScopes('developer', [algorandScope('testnet')])

        expect(fresh.isPeraScopeRefused(ETHEREUM_SEPOLIA)).toBe(true)
        expect(fresh.isPeraScopeRefused(ETHEREUM_MAINNET)).toBe(false)
        expect(fresh.hasPeraService(ETHEREUM_MAINNET, 'assets')).toBe(true)
    })

    test('a later list replaces the earlier one for its deployment', async () => {
        const fresh = await withBothEthereumNetworks()

        fresh.setPeraServedScopes('live', [algorandScope('mainnet')])
        fresh.setPeraServedScopes('live', [
            algorandScope('mainnet'),
            ETHEREUM_MAINNET,
        ])

        expect(fresh.isPeraScopeRefused(ETHEREUM_MAINNET)).toBe(false)
    })

    test('a refused request refuses its scope only', async () => {
        const fresh = await withBothEthereumNetworks()

        fresh.markPeraScopeRefused(ETHEREUM_MAINNET)

        expect(fresh.isPeraScopeRefused(ETHEREUM_MAINNET)).toBe(true)
        expect(fresh.hasPeraBackend(ETHEREUM_MAINNET)).toBe(false)
        expect(fresh.isPeraScopeRefused(ETHEREUM_SEPOLIA)).toBe(false)
        expect(fresh.isPeraScopeRefused(algorandScope('mainnet'))).toBe(false)
    })

    test('a scope no deployment holds is never refused', async () => {
        const fresh = await withBothEthereumNetworks()

        fresh.setPeraServedScopes('live', [algorandScope('mainnet')])
        fresh.markPeraScopeRefused(algorandScope('betanet'))

        expect(fresh.isPeraScopeRefused(algorandScope('betanet'))).toBe(false)
        expect(fresh.isPeraScopeRefused(algorandScope('custom'))).toBe(false)
    })

    test('nothing is refused before a list or a refusal arrives, or after a reset', async () => {
        const fresh = await withBothEthereumNetworks()

        expect(fresh.isPeraScopeRefused(ETHEREUM_MAINNET)).toBe(false)

        fresh.setPeraServedScopes('live', [])
        fresh.markPeraScopeRefused(ETHEREUM_SEPOLIA)
        fresh.resetPeraScopeRefusals()

        expect(fresh.isPeraScopeRefused(ETHEREUM_MAINNET)).toBe(false)
        expect(fresh.isPeraScopeRefused(ETHEREUM_SEPOLIA)).toBe(false)
    })
})

describe('a scope generated from the EVM table', () => {
    afterEach(() => {
        vi.doUnmock('../main')
        vi.resetModules()
    })

    const BASE_MAINNET: ChainScope = { chainId: 'base', networkId: 'mainnet' }
    const BASE_SEPOLIA: ChainScope = { chainId: 'base', networkId: 'sepolia' }

    test('reads its RPC URL and services from its own fields', async () => {
        const { getChainConfig: fresh, peraServicesFor: freshFor } =
            await withEthereumConfig({
                baseSepoliaRpcUrl: ['https://base-sepolia.rpc.example'],
                baseSepoliaPeraServices: ['assets'],
            })

        expect(fresh(BASE_SEPOLIA)).toStrictEqual({
            rpcUrls: ['https://base-sepolia.rpc.example'],
        })
        expect(freshFor(BASE_SEPOLIA)).toStrictEqual(new Set(['assets']))
    })

    test('without services has no Pera backend, as betanet has none', async () => {
        const { hasPeraBackend: fresh, peraDeploymentOf: freshDeployment } =
            await withEthereumConfig({})

        expect(fresh(BASE_MAINNET)).toBe(false)
        expect(freshDeployment(BASE_MAINNET)).toBeUndefined()
    })

    test('without an RPC URL is unconfigured', async () => {
        const { getChainConfig: fresh, UnconfiguredScopeError: FreshError } =
            await withEthereumConfig({ baseMainnetRpcUrl: [] })

        expect(() => fresh(BASE_MAINNET)).toThrow(FreshError)
    })

    test("is served by its tier's deployment", async () => {
        const { peraDeploymentOf: fresh } = await withEthereumConfig({
            polygonMainnetPeraServices: ['assets'],
            polygonAmoyPeraServices: ['assets'],
        })

        expect(fresh({ chainId: 'polygon', networkId: 'mainnet' })).toBe('live')
        expect(fresh({ chainId: 'polygon', networkId: 'amoy' })).toBe(
            'developer',
        )
    })
})

describe('chainEndpointsFor', () => {
    afterEach(() => {
        vi.doUnmock('../main')
        vi.resetModules()
    })

    test('keys Ethereum RPC URLs by network id', async () => {
        const { chainEndpointsFor } = await withEthereumConfig({
            ethereumMainnetRpcUrl: ['https://mainnet.rpc.example'],
            ethereumSepoliaRpcUrl: ['https://sepolia.rpc.example'],
        })

        expect(chainEndpointsFor('ethereum')).toStrictEqual({
            mainnet: ['https://mainnet.rpc.example'],
            sepolia: ['https://sepolia.rpc.example'],
        })
    })

    test("keeps a network's RPC URLs in the order the build lists them", async () => {
        const { chainEndpointsFor } = await withEthereumConfig({
            ethereumMainnetRpcUrl: [
                'https://first.rpc.example',
                'https://second.rpc.example',
            ],
            ethereumSepoliaRpcUrl: [],
        })

        expect(chainEndpointsFor('ethereum')).toStrictEqual({
            mainnet: [
                'https://first.rpc.example',
                'https://second.rpc.example',
            ],
        })
    })

    test('leaves out a network without an RPC URL', async () => {
        const { chainEndpointsFor } = await withEthereumConfig({
            ethereumMainnetRpcUrl: ['https://mainnet.rpc.example'],
            ethereumSepoliaRpcUrl: [],
        })

        expect(chainEndpointsFor('ethereum')).toStrictEqual({
            mainnet: ['https://mainnet.rpc.example'],
        })
    })

    test('is empty for a build with no RPC URLs', async () => {
        const { chainEndpointsFor } = await withEthereumConfig({
            ethereumMainnetRpcUrl: [],
            ethereumSepoliaRpcUrl: [],
        })

        expect(chainEndpointsFor('ethereum')).toStrictEqual({})
    })

    test('is empty for Algorand, whose node URLs come from getAlgorandChainConfig', async () => {
        const { chainEndpointsFor } = await withEthereumConfig({})

        expect(chainEndpointsFor('algorand')).toStrictEqual({})
    })
})
