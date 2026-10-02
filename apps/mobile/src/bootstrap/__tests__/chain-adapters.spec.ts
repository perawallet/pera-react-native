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
    type ChainRegistry,
    type ChainSetupConfig,
} from '@perawallet/wallet-core-chain-contract'
import {
    algorandCapabilityDefaults,
    algorandDescriptor,
} from '@perawallet/wallet-core-chain-algorand/descriptor'

const mocks = vi.hoisted(() => ({
    // The network store resolves its shim through the registry as it loads,
    // before beforeEach installs the real one.
    provider: {
        chains: { has: () => false } as unknown as ChainRegistry,
    },
    config: {
        chains: { enabled: ['algorand'], capabilities: {} } as ChainSetupConfig,
    },
    registerModule: vi.fn(),
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
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    readCapabilityOverrides: mocks.readCapabilityOverrides,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
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

import { registerChainAdapters } from '../chain-adapters'

const contextGivenToModule = (): ChainContext =>
    mocks.registerModule.mock.calls[0]?.[0] as ChainContext

describe('registerChainAdapters', () => {
    beforeEach(() => {
        mocks.provider.chains = createChainRegistry()
        mocks.config.chains = { enabled: ['algorand'], capabilities: {} }
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

    it('registers the Algorand adapters once', () => {
        registerChainAdapters()

        expect(mocks.registerModule).toHaveBeenCalledOnce()
    })

    it('keeps a single Algorand entry when it runs again', () => {
        registerChainAdapters()

        registerChainAdapters()

        expect(mocks.provider.chains.list()).toEqual([algorandDescriptor])
    })

    it('resolves the module defaults when nothing overrides them', () => {
        registerChainAdapters()

        expect(mocks.provider.chains.capabilities('algorand')).toEqual(
            algorandCapabilityDefaults,
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
