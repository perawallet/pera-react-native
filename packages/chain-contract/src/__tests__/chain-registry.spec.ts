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
    buildChainSetup,
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
import type { ChainId, ChainMode, ChainNetwork } from '../models/identity'
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
        hasTokenApproval: false,
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
    timeouts: { readMs: 10_000, submitMs: 30_000 },
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

    describe('mode restrictions', () => {
        const swapOn = { ...build, swap: true }
        let mode: ChainMode | undefined

        beforeEach(() => {
            mode = undefined
            registry.register(descriptor, swapOn, {
                swap: ['developer', 'developer-override'],
            })
            registry.setCapabilityOverrides(() => ({
                chainMode: mode ? { algorand: mode } : undefined,
            }))
        })

        it('switches the capability off in a restricted mode and back on in live, without re-registering', () => {
            mode = 'developer'
            expect(registry.capabilities('algorand').swap).toBe(false)

            mode = 'live'
            expect(registry.capabilities('algorand').swap).toBe(true)

            mode = 'developer-override'
            expect(registry.capabilities('algorand').swap).toBe(false)
        })

        it('restricts nothing when the reader gives no chainMode', () => {
            expect(registry.capabilities('algorand')).toEqual(swapOn)
        })

        it('leaves an unrestricted capability alone in a developer mode', () => {
            mode = 'developer'

            expect(registry.capabilities('algorand').staking).toBe(false)
            expect(registry.capabilities('algorand').swap).toBe(false)
        })

        it('lets Feature Flags force the capability on in a restricted mode', () => {
            mode = 'developer'
            registry.setCapabilityOverrides(() => ({
                chainMode: { algorand: 'developer' },
                developer: { algorand: { swap: true } },
            }))

            expect(registry.capabilities('algorand').swap).toBe(true)
        })
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

    it('keeps a switched-off chain registered', () => {
        registry.register(descriptor, build)
        registry.setCapabilityOverrides(() => ({
            chainEnabled: { algorand: false },
        }))

        expect(registry.has('algorand')).toBe(true)
        expect(registry.get('algorand').descriptor).toBe(descriptor)
    })

    it('reports a chain switched off only for an explicit false, registered or not', () => {
        expect(registry.isSwitchedOff('algorand')).toBe(false)

        registry.setCapabilityOverrides(() => ({
            chainEnabled: { algorand: 'false' },
        }))
        expect(registry.isSwitchedOff('algorand')).toBe(false)

        registry.setCapabilityOverrides(() => ({
            chainEnabled: { algorand: false },
        }))
        expect(registry.has('algorand')).toBe(false)
        expect(registry.isSwitchedOff('algorand')).toBe(true)
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

    it('forwards the module capability restrictions to the registry', () => {
        const module = moduleWith({
            capabilityDefaults: { ...build, swap: true },
            capabilityRestrictions: { swap: ['developer'] },
        })
        chains.setCapabilityOverrides(() => ({
            chainMode: { algorand: 'developer' },
        }))

        registerChainSetup([entryWith({ module })], chains, () => context)

        expect(chains.capabilities('algorand').swap).toBe(false)
    })
})

describe('buildChainSetup', () => {
    const chains = createChainRegistry()

    beforeEach(() => {
        chains.reset()
    })

    it('registers only the modules of enabled chains', () => {
        const algorand = moduleWith()
        const other = moduleWith({
            descriptor: { ...descriptor, id: 'other' as ChainId },
        })
        const modules = { algorand, other } as Partial<
            Record<ChainId, ChainModule>
        >

        const setup = buildChainSetup(
            { enabled: ['algorand'], capabilities: {} },
            modules,
        )
        registerChainSetup(setup, chains, () => context)

        expect(chains.list()).toEqual([descriptor])
        expect(algorand.register).toHaveBeenCalledTimes(1)
        expect(other.register).not.toHaveBeenCalled()
    })

    it('leaves the module defaults alone when the build lists no capabilities', () => {
        const [entry] = buildChainSetup(
            { enabled: ['algorand'], capabilities: {} },
            { algorand: moduleWith() },
        )

        expect(entry).toEqual({
            chainId: 'algorand',
            enabled: true,
            module: expect.anything(),
            endpoints: {},
        })
    })

    it('turns a listed capability set into the exact enabled set', () => {
        const [entry] = buildChainSetup(
            {
                enabled: ['algorand'],
                capabilities: { algorand: ['send', 'receive'] },
            },
            { algorand: moduleWith() },
        )

        expect(entry.capabilities).toEqual({
            ...allFalse,
            send: true,
            receive: true,
        })
    })

    it('throws when an enabled chain has no module', () => {
        expect(() =>
            buildChainSetup({ enabled: ['algorand'], capabilities: {} }, {}),
        ).toThrow(/no chain module/)
    })

    it('skips a chain whose module is undefined', () => {
        const setup = buildChainSetup(
            { enabled: ['algorand'], capabilities: {} },
            { algorand: moduleWith(), ethereum: undefined },
        )

        expect(setup.map(entry => entry.chainId)).toEqual(['algorand'])
    })

    it('throws when an enabled chain maps to an undefined module', () => {
        expect(() =>
            buildChainSetup(
                { enabled: ['algorand', 'ethereum'], capabilities: {} },
                { algorand: moduleWith(), ethereum: undefined },
            ),
        ).toThrow(/no chain module/)
    })
})
