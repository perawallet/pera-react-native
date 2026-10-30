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

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createChainRegistry,
    type ChainCapabilityOverrides,
    type ChainContext,
    type ChainModule,
    type ChainRegistry,
    type ChainScope,
    type ChainSetupConfig,
    type EvmChainId,
} from '@perawallet/wallet-core-chain-contract'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'
import {
    ethereumModule,
    evmChainModules,
} from '@perawallet/wallet-core-chain-ethereum'

const PRODUCTION_ALGORAND_CAPABILITIES = {
    send: true,
    receive: true,
    history: true,
    assets: true,
    pricing: true,
    messageSigning: true,
    dappConnect: true,
    customNetworks: true,
    watchAccounts: true,
    ledger: true,
    multisig: true,
    rekey: true,
    quantumAccounts: true,
    staking: true,
    swap: true,
    card: true,
    assetInbox: true,
    nameService: true,
    onramp: true,
    giftCards: true,
    discover: true,
    feeDelegation: true,
    liquidAuth: true,
    notifications: true,
    cloudBackup: true,
    mnemonicBackup: true,
    secureBackup: true,
    nft: true,
    manageAssets: true,
    privateKeys: false,
    contractDecoding: false,
    priceHistory: true,
    balanceHistory: true,
    assetSearch: true,
    assetFavorites: true,
    priceAlerts: true,
    csvExport: true,
    peraWebImport: true,
}

const { FIXTURE_PINNED_HOSTS } = vi.hoisted(() => ({
    FIXTURE_PINNED_HOSTS: {
        flag: 'enable_ssl_pinning_fixture',
        urls: ['https://node.fixture.example'],
        domains: ['fixture.example'],
    },
}))

const mocks = vi.hoisted(() => ({
    // The network store resolves its shim through the registry as it loads,
    // before beforeEach installs the real one.
    provider: {
        chains: { has: () => false } as unknown as ChainRegistry,
    },
    config: {
        chains: { enabled: ['algorand'], capabilities: {} } as ChainSetupConfig,
        chainRequestTimeouts: {
            algorand: { readMs: 10_000, submitMs: 30_000 },
            ethereum: { readMs: 15_000, submitMs: 20_000 },
        },
    },
    chainEndpointsFor: vi.fn((chainId: string): Record<string, string> =>
        chainId === 'ethereum' ? { mainnet: 'https://mainnet.rpc.test' } : {},
    ),
    getPeraServicesConfig: vi.fn(),
    peraServicesFor: vi.fn(),
    registerModule: vi.fn(),
    registerEthereumModule: vi.fn(),
    evmChainModules: {} as Partial<Record<EvmChainId, ChainModule>>,
    readCapabilityOverrides: vi.fn((): ChainCapabilityOverrides => ({})),
    networkGetState: vi.fn(),
    kmsCore: { deriveFromSeed: vi.fn(), importRawKey: vi.fn(), sign: vi.fn() },
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => mocks.provider,
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-config')
    >()),
    config: mocks.config,
    chainEndpointsFor: mocks.chainEndpointsFor,
    getPeraServicesConfig: mocks.getPeraServicesConfig,
    peraServicesFor: mocks.peraServicesFor,
}))

vi.mock('@perawallet/wallet-core-remote-config', async () => ({
    readCapabilityOverrides: mocks.readCapabilityOverrides,
    chainOverridesKey: (chainId: string) => `chain_${chainId}_overrides`,
    remoteConfigDefaultsRegistry: (
        await import('@perawallet/wallet-extension-platform')
    ).remoteConfigDefaultsRegistry,
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetworkStore: { getState: mocks.networkGetState },
}))

vi.mock('@perawallet/wallet-core-kms', () => ({ kmsCore: mocks.kmsCore }))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    rehydrateSigningStore: vi.fn(async () => {}),
}))

// The real module pulls in every adapter; the root only needs the module's shape.
vi.mock('@perawallet/wallet-core-chain-algorand', async () => {
    const descriptorEntry =
        await import('@perawallet/wallet-core-chain-algorand/descriptor')
    return {
        chainModule: {
            descriptor: descriptorEntry.algorandDescriptor,
            capabilityDefaults: descriptorEntry.algorandCapabilityDefaults,
            capabilityRestrictions:
                descriptorEntry.algorandCapabilityRestrictions,
            register: mocks.registerModule,
            remoteConfigDefaults: { fixture_fee: 1000 },
            pinnedHosts: () => FIXTURE_PINNED_HOSTS,
        },
    }
})

// A getter so each test decides whether the Metro gate left the real module in.
vi.mock('../evm-chain-modules', () => ({
    get evmChainModules() {
        return mocks.evmChainModules
    },
}))

import { rehydrateAccountsStore } from '@perawallet/wallet-core-accounts'
import { rehydrateSigningStore } from '@perawallet/wallet-core-signing'
import {
    pinnedHostRegistry,
    remoteConfigDefaultsRegistry,
} from '@perawallet/wallet-extension-platform'
import {
    declareChainPlatformInputs,
    registerChainAdapters,
} from '../chain-adapters'

const contextGivenToModule = (): ChainContext =>
    mocks.registerModule.mock.calls[0]?.[0] as ChainContext

const contextGivenToEthereum = (): ChainContext => {
    mocks.config.chains = {
        enabled: ['algorand', 'ethereum'],
        capabilities: {},
    }
    mocks.evmChainModules = {
        ethereum: { ...ethereumModule, register: mocks.registerEthereumModule },
    }
    registerChainAdapters()
    return mocks.registerEthereumModule.mock.calls[0]?.[0] as ChainContext
}

describe('registerChainAdapters', () => {
    beforeEach(() => {
        remoteConfigDefaultsRegistry.reset()
        pinnedHostRegistry.reset()
        mocks.provider.chains = createChainRegistry()
        mocks.config.chains = { enabled: ['algorand'], capabilities: {} }
        mocks.evmChainModules = { ethereum: ethereumModule }
        mocks.readCapabilityOverrides.mockReturnValue({})
        mocks.networkGetState.mockReturnValue({
            mode: 'live',
            selectedNetworkByChain: {},
            customNetworksByChain: { algorand: [] },
            endpointOverridesByChain: {},
        })
    })

    it('registers the Algorand descriptor on the provider chain registry', () => {
        registerChainAdapters()

        expect(mocks.provider.chains.get('algorand').descriptor).toBe(
            algorandDescriptor,
        )
    })

    it('leaves Ethereum unregistered when the build does not list it', () => {
        registerChainAdapters()

        expect(mocks.provider.chains.has('ethereum')).toBe(false)
    })

    it('keeps Algorand first so generic code resolves it as the home chain', () => {
        mocks.config.chains = {
            enabled: ['algorand', 'ethereum'],
            capabilities: {},
        }

        registerChainAdapters()

        expect(mocks.provider.chains.list()[0]?.id).toBe('algorand')
    })

    it('registers the Ethereum descriptor and defaults when the build lists it', () => {
        mocks.config.chains = {
            enabled: ['algorand', 'ethereum'],
            capabilities: {},
        }

        registerChainAdapters()

        expect(mocks.provider.chains.get('ethereum').descriptor).toBe(
            ethereumModule.descriptor,
        )
        expect(mocks.provider.chains.capabilities('ethereum')).toEqual(
            ethereumModule.capabilityDefaults,
        )
    })

    it('fails loudly when the build lists Ethereum but Metro stubbed its module', () => {
        mocks.evmChainModules = {}
        mocks.config.chains = {
            enabled: ['algorand', 'ethereum'],
            capabilities: {},
        }

        expect(() => registerChainAdapters()).toThrow(
            /no chain module was supplied/,
        )
    })

    it('registers another EVM chain the build lists through the same table', () => {
        mocks.evmChainModules = evmChainModules
        mocks.config.chains = {
            enabled: ['algorand', 'base'],
            capabilities: {},
        }

        registerChainAdapters()

        expect(mocks.provider.chains.get('base').descriptor).toBe(
            evmChainModules.base.descriptor,
        )
        expect(mocks.provider.chains.has('ethereum')).toBe(false)
    })

    it('fails loudly when the build lists Base but Metro stubbed the EVM modules', () => {
        mocks.evmChainModules = {}
        mocks.config.chains = {
            enabled: ['algorand', 'base'],
            capabilities: {},
        }

        expect(() => registerChainAdapters()).toThrow(
            /no chain module was supplied/,
        )
    })

    it('rehydrates the accounts store only once the adapters are registered', () => {
        registerChainAdapters()

        expect(rehydrateAccountsStore).toHaveBeenCalledOnce()
        expect(
            vi.mocked(rehydrateAccountsStore).mock.invocationCallOrder[0],
        ).toBeGreaterThan(mocks.registerModule.mock.invocationCallOrder[0])
    })

    it('rehydrates the signing store, naming the legacy chain for requests stored without one', () => {
        registerChainAdapters()

        expect(rehydrateSigningStore).toHaveBeenCalledWith({
            unstampedRequestChainId: 'algorand',
        })
    })

    it('registers the Algorand adapters once', () => {
        registerChainAdapters()

        expect(mocks.registerModule).toHaveBeenCalledOnce()
    })

    it('keeps a single Algorand entry when it runs again', () => {
        registerChainAdapters()

        registerChainAdapters()

        expect(mocks.provider.chains.list()).toEqual([algorandDescriptor])
    })

    it("resolves Algorand's supported feature set for a production build with no overrides", () => {
        registerChainAdapters()

        expect(mocks.provider.chains.capabilities('algorand')).toEqual(
            PRODUCTION_ALGORAND_CAPABILITIES,
        )
    })

    it('turns on exactly the capabilities the build lists', () => {
        mocks.config.chains = {
            enabled: ['algorand'],
            capabilities: { algorand: ['swap'] },
        }

        registerChainAdapters()

        const enabled = Object.entries(
            mocks.provider.chains.capabilities('algorand'),
        )
            .filter(([, isOn]) => isOn)
            .map(([capability]) => capability)
        expect(enabled).toEqual(['swap'])
    })

    it('reads the remote kill switch through the installed override layers', () => {
        mocks.readCapabilityOverrides.mockReturnValue({
            chainEnabled: { algorand: false },
        })

        registerChainAdapters()

        const { chains } = mocks.provider
        expect(chains.isSwitchedOff('algorand')).toBe(true)
        expect(Object.values(chains.capabilities('algorand'))).not.toContain(
            true,
        )
        expect(chains.has('algorand')).toBe(true)
    })

    it('applies the remote and developer override layers', () => {
        mocks.readCapabilityOverrides.mockReturnValue({
            remote: { algorand: { swap: false } },
            developer: { algorand: { card: false } },
        })

        registerChainAdapters()

        const capabilities = mocks.provider.chains.capabilities('algorand')
        expect(capabilities.swap).toBe(false)
        expect(capabilities.card).toBe(false)
        expect(capabilities.send).toBe(true)
    })

    describe('platform inputs', () => {
        it("declares an enabled chain's remote-config defaults and pinned hosts", () => {
            registerChainAdapters()

            expect(remoteConfigDefaultsRegistry.all()).toEqual(
                expect.objectContaining({ fixture_fee: 1000 }),
            )
            expect(pinnedHostRegistry.all()).toEqual([FIXTURE_PINNED_HOSTS])
        })

        it('declares nothing for a chain the build leaves out', () => {
            mocks.config.chains = { enabled: [], capabilities: {} }

            registerChainAdapters()

            expect(remoteConfigDefaultsRegistry.all()).not.toHaveProperty(
                'fixture_fee',
            )
            expect(pinnedHostRegistry.all()).toEqual([])
        })

        it("declares every chain's overrides key, enabled or not", () => {
            declareChainPlatformInputs([])

            expect(remoteConfigDefaultsRegistry.all()).toEqual(
                expect.objectContaining({
                    chain_algorand_overrides: '',
                    chain_ethereum_overrides: '',
                }),
            )
        })

        it('declares again without throwing when it runs twice', () => {
            registerChainAdapters()

            expect(() => registerChainAdapters()).not.toThrow()
            expect(pinnedHostRegistry.all()).toEqual([FIXTURE_PINNED_HOSTS])
        })
    })

    describe('mode restrictions', () => {
        it.each([
            ['live', {}, true],
            ['developer', {}, false],
            ['developer', { algorand: 'betanet' }, false],
        ] as const)(
            'resolves onramp in %s mode with overrides %j as %s',
            (mode, selectedNetworkByChain, expected) => {
                mocks.networkGetState.mockReturnValue({
                    mode,
                    selectedNetworkByChain,
                    customNetworksByChain: { algorand: [] },
                })
                registerChainAdapters()

                expect(
                    mocks.provider.chains.capabilities('algorand').onramp,
                ).toBe(expected)
            },
        )

        it('follows a mode change without registering again', () => {
            registerChainAdapters()
            expect(mocks.provider.chains.capabilities('algorand').onramp).toBe(
                true,
            )

            mocks.networkGetState.mockReturnValue({
                mode: 'developer',
                selectedNetworkByChain: {},
                customNetworksByChain: { algorand: [] },
            })

            expect(mocks.provider.chains.capabilities('algorand').onramp).toBe(
                false,
            )
        })
    })

    describe('the chain context', () => {
        it('reads the selected network on every getScope call', () => {
            registerChainAdapters()
            const context = contextGivenToModule()

            const before = context.getScope()
            mocks.networkGetState.mockReturnValue({
                mode: 'developer',
                selectedNetworkByChain: { algorand: 'betanet' },
                customNetworksByChain: { algorand: [] },
            })
            const after = context.getScope()

            expect(before).toEqual({
                chainId: 'algorand',
                networkId: 'mainnet',
            })
            expect(after).toEqual({ chainId: 'algorand', networkId: 'betanet' })
        })

        it('resolves a chain with no override to its default test network in developer mode', () => {
            registerChainAdapters()
            mocks.networkGetState.mockReturnValue({
                mode: 'developer',
                selectedNetworkByChain: {},
                customNetworksByChain: { algorand: [] },
            })

            expect(contextGivenToModule().getScope()).toEqual({
                chainId: 'algorand',
                networkId: 'testnet',
            })
        })

        it('hands each chain its own endpoints', () => {
            registerChainAdapters()
            const algorand = contextGivenToModule().getEndpoints()
            const ethereum = contextGivenToEthereum().getEndpoints()

            expect(algorand).toEqual({})
            expect(ethereum).toEqual({ mainnet: 'https://mainnet.rpc.test' })
            expect(mocks.chainEndpointsFor).toHaveBeenCalledWith('ethereum')
        })

        it("lays a developer's endpoint override over its own chain only, and drops it once cleared", () => {
            registerChainAdapters()
            const algorand = contextGivenToModule()
            const ethereum = contextGivenToEthereum()
            const withOverrides = (endpointOverridesByChain: unknown) =>
                mocks.networkGetState.mockReturnValue({
                    mode: 'developer',
                    selectedNetworkByChain: {},
                    customNetworksByChain: { algorand: [] },
                    endpointOverridesByChain,
                })

            withOverrides({ ethereum: { mainnet: 'https://my-node.test' } })

            expect(ethereum.getEndpoints()).toEqual({
                mainnet: 'https://my-node.test',
            })
            expect(algorand.getEndpoints()).toEqual({})

            withOverrides({ ethereum: {} })

            expect(ethereum.getEndpoints()).toEqual({
                mainnet: 'https://mainnet.rpc.test',
            })
        })

        it('hands each chain its own request timeouts', () => {
            registerChainAdapters()
            const algorand = contextGivenToModule().timeouts
            const ethereum = contextGivenToEthereum().timeouts

            expect(algorand).toEqual({ readMs: 10_000, submitMs: 30_000 })
            expect(ethereum).toEqual({ readMs: 15_000, submitMs: 20_000 })
        })

        it("hands over the scope's Pera backend URL and services", () => {
            mocks.getPeraServicesConfig.mockReturnValue({
                backendUrl: 'https://pera.test',
            })
            mocks.peraServicesFor.mockReturnValue(new Set(['blockFollowing']))
            const scope: ChainScope = {
                chainId: 'ethereum',
                networkId: 'sepolia',
            }

            const backend = contextGivenToEthereum().getPeraBackend(scope)

            expect(mocks.getPeraServicesConfig).toHaveBeenCalledWith(scope)
            expect(mocks.peraServicesFor).toHaveBeenCalledWith(scope)
            expect(backend).toEqual({
                baseUrl: 'https://pera.test',
                services: new Set(['blockFollowing']),
            })
        })

        it('hands over the KMS core as the key store', () => {
            registerChainAdapters()

            expect(contextGivenToModule().kms).toBe(mocks.kmsCore)
        })
    })
})
