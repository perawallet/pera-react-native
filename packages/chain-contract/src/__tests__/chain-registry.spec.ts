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
    createChainRegistry,
    registerChainSetup,
    type ChainSetupEntry,
} from '../chain-registry'
import {
    ChainAdapterNotRegisteredError,
    DuplicateChainAdapterError,
} from '../errors'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
} from '../models/capabilities'
import type { ChainDescriptor } from '../models/descriptor'
import type { ChainNetwork } from '../models/identity'
import type { ChainContext, ChainModule } from '../models/module'
import { descriptorContractViolations } from './descriptor-contract'

const network = (
    overrides: Partial<ChainNetwork> & Pick<ChainNetwork, 'id'>,
): ChainNetwork => ({
    tier: 'mainnet',
    displayName: overrides.id,
    isDefaultForTier: false,
    caip2: `algorand:${overrides.id}`,
    nativeRef: {
        kind: 'algorand',
        genesisId: overrides.id,
        genesisHash: 'AA==',
    },
    status: 'active',
    ...overrides,
})

const explorerUrl = (networkId: string, path: string): string | undefined =>
    networkId === 'custom'
        ? undefined
        : `https://${networkId}.explorer.example/${path}`

const descriptor: ChainDescriptor = {
    id: 'algorand',
    family: 'algorand',
    displayName: 'Algorand',
    networks: [
        network({ id: 'mainnet', tier: 'mainnet', isDefaultForTier: true }),
        network({ id: 'testnet', tier: 'testnet', isDefaultForTier: true }),
        network({ id: 'custom', tier: 'testnet', caip2: undefined }),
    ],
    nativeAsset: {
        ref: { chainId: 'algorand', assetId: '0' },
        symbol: 'ALGO',
        name: 'Algo',
        decimals: 6,
    },
    signing: { schemes: ['ed25519'], derivationPaths: {} },
    protocol: {
        feeModel: 'flat',
        hasAccountNonce: false,
        requiresAssetOptIn: true,
        hasMinimumBalance: true,
        supportsAtomicGroups: true,
        supportsReplacement: false,
        supportsNativeMultisig: true,
        supportsRekey: true,
        multipleAddressesPerAccount: false,
    },
    explorer: {
        accountUrl: (networkId, address) =>
            explorerUrl(networkId, `account/${address}`),
        transactionUrl: (networkId, txId) =>
            explorerUrl(networkId, `tx/${txId}`),
        assetUrl: (networkId, assetId) =>
            explorerUrl(networkId, `asset/${assetId}`),
    },
    finality: { kind: 'instant' },
}

const build = {
    ...(Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [capability, true]),
    ) as ChainCapabilities),
    staking: false,
}

const allFalse = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, false]),
)

const context: ChainContext = {
    getScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
    getEndpoints: () => ({}),
    http: { request: vi.fn() },
    kms: {} as ChainContext['kms'],
}

const moduleWith = (overrides: Partial<ChainModule> = {}): ChainModule => ({
    descriptor,
    capabilityDefaults: build,
    register: vi.fn(),
    i18nKeys: () => [],
    ...overrides,
})

const entryWith = (
    overrides: Partial<ChainSetupEntry> = {},
): ChainSetupEntry => ({
    chainId: 'algorand',
    enabled: true,
    module: moduleWith(),
    endpoints: {},
    ...overrides,
})

describe('createChainRegistry', () => {
    const registry = createChainRegistry()

    beforeEach(() => {
        registry.reset()
    })

    it('uses a fixture that satisfies the descriptor contract', () => {
        expect(descriptorContractViolations(descriptor, build)).toEqual([])
    })

    it('reports the build value of every capability when nothing overrides it', () => {
        registry.register(descriptor, build)

        const capabilities = registry.capabilities('algorand')

        expect(capabilities).toEqual(build)
        expect(capabilities.staking).toBe(false)
    })

    it('lets a remote false override a build true', () => {
        registry.register(descriptor, build)
        registry.setCapabilityOverrides(() => ({
            remote: { algorand: { swap: false } },
        }))

        expect(registry.capabilities('algorand').swap).toBe(false)
    })

    it('lets a developer true override a remote false', () => {
        registry.register(descriptor, build)
        registry.setCapabilityOverrides(() => ({
            remote: { algorand: { staking: false } },
            developer: { algorand: { staking: true } },
        }))

        expect(registry.capabilities('algorand').staking).toBe(true)
    })

    it('reports every capability false while the chain is switched off', () => {
        registry.register(descriptor, build)
        registry.setCapabilityOverrides(() => ({
            developer: { algorand: { staking: true } },
            chainEnabled: { algorand: false },
        }))

        expect(registry.capabilities('algorand')).toEqual(allFalse)
    })

    it('ignores a chain switch that is not strictly false', () => {
        registry.register(descriptor, build)
        registry.setCapabilityOverrides(() => ({
            chainEnabled: { algorand: 'false' },
        }))

        expect(registry.capabilities('algorand')).toEqual(build)
    })

    it('drops the overrides on reset', () => {
        registry.register(descriptor, build)
        registry.setCapabilityOverrides(() => ({
            chainEnabled: { algorand: false },
        }))

        registry.reset()
        registry.register(descriptor, build)

        expect(registry.capabilities('algorand')).toEqual(build)
    })

    it('returns and lists the registered descriptor', () => {
        registry.register(descriptor, build)

        expect(registry.has('algorand')).toBe(true)
        expect(registry.get('algorand').descriptor).toBe(descriptor)
        expect(registry.get('algorand')).toBe(registry.get('algorand'))
        expect(registry.list()).toEqual([descriptor])
    })

    it('treats registering the same descriptor again as a no-op', () => {
        registry.register(descriptor, build)

        expect(() => registry.register(descriptor, build)).not.toThrow()
        expect(registry.list()).toEqual([descriptor])
    })

    it('rejects a different descriptor under a registered chain id and keeps the first', () => {
        registry.register(descriptor, build)

        expect(() => registry.register({ ...descriptor }, build)).toThrow(
            DuplicateChainAdapterError,
        )
        expect(registry.get('algorand').descriptor).toBe(descriptor)
    })

    it('throws a typed error for an unregistered chain', () => {
        expect(registry.has('algorand')).toBe(false)
        expect(() => registry.get('algorand')).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => registry.capabilities('algorand')).toThrow(
            ChainAdapterNotRegisteredError,
        )
    })

    it('forgets every registration on reset', () => {
        registry.register(descriptor, build)

        registry.reset()

        expect(registry.list()).toEqual([])
    })

    it('resolves a CAIP-2 id to its chain and network', () => {
        registry.register(descriptor, build)

        expect(registry.byCaip2('algorand:testnet')).toEqual({
            chainId: 'algorand',
            network: descriptor.networks[1],
        })
    })

    it('resolves an unknown CAIP-2 id to undefined', () => {
        registry.register(descriptor, build)

        expect(registry.byCaip2('algorand:nope')).toBeUndefined()
        expect(registry.byCaip2('')).toBeUndefined()
    })
})

describe('registerChainSetup', () => {
    const chains = createChainRegistry()

    beforeEach(() => {
        chains.reset()
    })

    it('never registers a disabled entry', () => {
        const module = moduleWith()
        const contextFor = vi.fn(() => context)

        registerChainSetup(
            [entryWith({ enabled: false, module })],
            chains,
            contextFor,
        )

        expect(module.register).not.toHaveBeenCalled()
        expect(contextFor).not.toHaveBeenCalled()
        expect(chains.has('algorand')).toBe(false)
    })

    it('registers an enabled entry with its capability overrides applied over the module defaults', () => {
        const module = moduleWith()
        const entry = entryWith({ module, capabilities: { swap: false } })
        const contextFor = vi.fn(() => context)

        registerChainSetup([entry], chains, contextFor)

        expect(chains.get('algorand').descriptor).toBe(descriptor)
        expect(chains.capabilities('algorand')).toEqual({
            ...build,
            swap: false,
        })
        expect(contextFor).toHaveBeenCalledWith(entry)
        expect(module.register).toHaveBeenCalledTimes(1)
        expect(module.register).toHaveBeenCalledWith(context)
    })
})
