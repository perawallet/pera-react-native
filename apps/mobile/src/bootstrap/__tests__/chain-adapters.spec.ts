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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    ChainHttpClientUnavailableError,
    createChainRegistry,
    type ChainCapabilityOverrides,
    type ChainContext,
    type ChainModule,
    type ChainRegistry,
    type ChainScope,
    type ChainSetupConfig,
} from '@perawallet/wallet-core-chain-contract'
import { UnconfiguredScopeError } from '@perawallet/wallet-core-config'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { ethereumModule } from '@perawallet/wallet-core-chain-ethereum'

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

const mocks = vi.hoisted(() => ({
    // The network store resolves its shim through the registry as it loads,
    // before beforeEach installs the real one.
    provider: {
        chains: { has: () => false } as unknown as ChainRegistry,
    },
    config: {
        chains: { enabled: ['algorand'], capabilities: {} } as ChainSetupConfig,
        algodReadTimeout: 10_000,
        algodSubmitTimeout: 30_000,
    },
    getChainConfig: vi.fn(),
    getPeraServicesConfig: vi.fn(),
    peraServicesFor: vi.fn(),
    registerModule: vi.fn(),
    registerEthereumModule: vi.fn(),
    ethereumChainModule: undefined as ChainModule | undefined,
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
    getChainConfig: mocks.getChainConfig,
    getPeraServicesConfig: mocks.getPeraServicesConfig,
    peraServicesFor: mocks.peraServicesFor,
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    readCapabilityOverrides: mocks.readCapabilityOverrides,
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetworkStore: { getState: mocks.networkGetState },
}))

vi.mock('@perawallet/wallet-core-kms', () => ({ kmsCore: mocks.kmsCore }))

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
            i18nKeys: () => [],
        },
    }
})

// A getter so each test decides whether the Metro gate left the real module in.
vi.mock('../ethereum-chain-module', () => ({
    get ethereumChainModule() {
        return mocks.ethereumChainModule
    },
}))

import { registerChainAdapters } from '../chain-adapters'

const contextGivenToModule = (): ChainContext =>
    mocks.registerModule.mock.calls[0]?.[0] as ChainContext

const contextGivenToEthereum = (): ChainContext => {
    mocks.config.chains = {
        enabled: ['algorand', 'ethereum'],
        capabilities: {},
    }
    mocks.ethereumChainModule = {
        ...ethereumModule,
        register: mocks.registerEthereumModule,
    }
    registerChainAdapters()
    return mocks.registerEthereumModule.mock.calls[0]?.[0] as ChainContext
}

describe('registerChainAdapters', () => {
    beforeEach(() => {
        mocks.provider.chains = createChainRegistry()
        mocks.config.chains = { enabled: ['algorand'], capabilities: {} }
        mocks.ethereumChainModule = ethereumModule
        mocks.readCapabilityOverrides.mockReturnValue({})
        mocks.networkGetState.mockReturnValue({
            mode: 'live',
            selectedNetworkByChain: {},
            customNetworksByChain: { algorand: [] },
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
        mocks.ethereumChainModule = undefined
        mocks.config.chains = {
            enabled: ['algorand', 'ethereum'],
            capabilities: {},
        }

        expect(() => registerChainAdapters()).toThrow(
            /no chain module was supplied/,
        )
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

        it('hands over the setup entry endpoints', () => {
            registerChainAdapters()

            expect(contextGivenToModule().getEndpoints()).toEqual({})
        })

        it("hands over the wallet's request timeouts", () => {
            registerChainAdapters()

            expect(contextGivenToModule().timeouts).toEqual({
                readMs: 10_000,
                submitMs: 30_000,
            })
        })

        it('hands Ethereum the RPC URL of every configured network, keyed by network id', () => {
            mocks.getChainConfig.mockImplementation((scope: ChainScope) => {
                if (scope.networkId === 'sepolia') {
                    throw new UnconfiguredScopeError(scope)
                }
                return { rpcUrl: 'https://mainnet.rpc.test' }
            })

            expect(contextGivenToEthereum().getEndpoints()).toEqual({
                mainnet: 'https://mainnet.rpc.test',
            })
        })

        it('rethrows a config failure other than an unconfigured network', () => {
            mocks.getChainConfig.mockImplementation(() => {
                throw new Error('config broken')
            })

            expect(() => contextGivenToEthereum().getEndpoints()).toThrow(
                'config broken',
            )
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

        it('rejects every HTTP request, since no client is wired', async () => {
            registerChainAdapters()

            await expect(
                contextGivenToModule().http.request({
                    url: 'https://example.test',
                }),
            ).rejects.toBeInstanceOf(ChainHttpClientUnavailableError)
        })
    })
})
