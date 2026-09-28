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

import {
    resolveCapability,
    type CapabilityLayers,
} from './capabilities/resolve'
import {
    ChainAdapterNotRegisteredError,
    DuplicateChainAdapterError,
} from './errors'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
} from './models/capabilities'
import type { ChainDescriptor } from './models/descriptor'
import type { ChainId, ChainNetwork } from './models/identity'
import type { ChainContext, ChainEndpoints, ChainModule } from './models/module'

const FEATURE = 'chain descriptor'

export type ChainCapabilityOverrides = Pick<
    CapabilityLayers,
    'remote' | 'developer'
> & {
    /**
     * The per-chain kill switch; only `false` switches a chain off. `unknown`
     * because it comes from remote config, like the other layers.
     */
    chainEnabled?: Partial<Record<ChainId, unknown>>
}

export interface RegisteredChain {
    descriptor: ChainDescriptor
}

export interface ChainRegistry {
    /** `build` is the module's defaults with the composition root's overrides applied. */
    register(descriptor: ChainDescriptor, build: ChainCapabilities): void
    /** @throws ChainAdapterNotRegisteredError */
    get(chainId: ChainId): RegisteredChain
    has(chainId: ChainId): boolean
    list(): ChainDescriptor[]
    /** @throws ChainAdapterNotRegisteredError */
    capabilities(chainId: ChainId): ChainCapabilities
    /** Read on every `capabilities` call, so a changed remote value applies without re-registering. */
    setCapabilityOverrides(read: () => ChainCapabilityOverrides): void
    byCaip2(
        caip2: string,
    ): { chainId: ChainId; network: ChainNetwork } | undefined
    /** Test-only: drops every registration and the overrides. */
    reset(): void
}

export interface ChainSetupEntry {
    chainId: ChainId
    enabled: boolean
    module: ChainModule
    endpoints: ChainEndpoints
    /** This composition root's build-time overrides of the module's defaults. */
    capabilities?: Partial<ChainCapabilities>
}

export type ChainSetup = readonly ChainSetupEntry[]

const NO_OVERRIDES = (): ChainCapabilityOverrides => ({})

const ALL_OFF = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, false]),
) as ChainCapabilities

/** Starts empty: each composition root registers its chains through `registerChainSetup`. */
export const createChainRegistry = (): ChainRegistry => {
    const chains = new Map<
        ChainId,
        { chain: RegisteredChain; build: ChainCapabilities }
    >()
    let readOverrides = NO_OVERRIDES

    const entryFor = (chainId: ChainId) => {
        const entry = chains.get(chainId)
        if (!entry) {
            throw new ChainAdapterNotRegisteredError(FEATURE, chainId)
        }
        return entry
    }

    return {
        register: (descriptor, build) => {
            const existing = chains.get(descriptor.id)
            if (existing?.chain.descriptor === descriptor) {
                return
            }
            if (existing) {
                throw new DuplicateChainAdapterError(FEATURE, descriptor.id)
            }
            chains.set(descriptor.id, { chain: { descriptor }, build })
        },
        get: chainId => entryFor(chainId).chain,
        has: chainId => chains.has(chainId),
        list: () => [...chains.values()].map(entry => entry.chain.descriptor),
        capabilities: chainId => {
            const { build } = entryFor(chainId)
            const { chainEnabled, ...overrides } = readOverrides()
            if (chainEnabled?.[chainId] === false) {
                return ALL_OFF
            }
            // Every registered chain has a build entry; the layer only needs this one.
            const layers = {
                ...overrides,
                build: { [chainId]: build },
            } as CapabilityLayers
            return Object.fromEntries(
                CHAIN_CAPABILITIES.map(capability => [
                    capability,
                    resolveCapability(chainId, capability, layers),
                ]),
            ) as ChainCapabilities
        },
        setCapabilityOverrides: read => {
            readOverrides = read
        },
        byCaip2: caip2 => {
            for (const {
                chain: { descriptor },
            } of chains.values()) {
                const network = descriptor.networks.find(
                    candidate => candidate.caip2 === caip2,
                )
                if (network) {
                    return { chainId: descriptor.id, network }
                }
            }
            return undefined
        },
        reset: () => {
            chains.clear()
            readOverrides = NO_OVERRIDES
        },
    }
}

/**
 * The descriptor is registered here rather than by the module, so a disabled
 * entry reaches neither registry and no module can forget its own descriptor.
 */
export const registerChainSetup = (
    setup: ChainSetup,
    chains: ChainRegistry,
    contextFor: (entry: ChainSetupEntry) => ChainContext,
): void => {
    for (const entry of setup) {
        if (!entry.enabled) {
            continue
        }
        chains.register(entry.module.descriptor, {
            ...entry.module.capabilityDefaults,
            ...entry.capabilities,
        })
        entry.module.register(contextFor(entry))
    }
}
