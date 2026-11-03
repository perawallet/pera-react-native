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
    isRestrictedIn,
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
    type ChainCapability,
    type ChainCapabilityRestrictions,
} from './models/capabilities'
import type { ChainDescriptor } from './models/descriptor'
import type { ChainId, ChainNetwork } from './models/identity'
import type { ChainContext, ChainEndpoints, ChainModule } from './models/module'

const FEATURE = 'chain descriptor'

export type ChainCapabilityOverrides = Pick<
    CapabilityLayers,
    'remote' | 'developer' | 'chainMode'
> & {
    /**
     * The per-chain kill switch for the chain's Pera backend; only `false`
     * switches it off. RPC and indexer paths stay up. `unknown` because it
     * comes from remote config, like the other layers.
     */
    chainEnabled?: Partial<Record<ChainId, unknown>>
}

export interface RegisteredChain {
    descriptor: ChainDescriptor
}

export interface ChainRegistry {
    /**
     * `build` is the module's defaults with the composition root's overrides
     * applied. `supported` defaults to every capability.
     */
    register(
        descriptor: ChainDescriptor,
        build: ChainCapabilities,
        restrictions?: ChainCapabilityRestrictions,
        supported?: readonly ChainCapability[],
    ): void
    /** @throws ChainAdapterNotRegisteredError */
    get(chainId: ChainId): RegisteredChain
    has(chainId: ChainId): boolean
    list(): ChainDescriptor[]
    /** @throws ChainAdapterNotRegisteredError */
    capabilities(chainId: ChainId): ChainCapabilities
    /** Read on every `capabilities` call, so a changed remote value or chain mode applies without re-registering. */
    setCapabilityOverrides(read: () => ChainCapabilityOverrides): void
    /**
     * True only while the chain's Pera backend kill switch is explicitly off,
     * registered or not.
     */
    isSwitchedOff(chainId: ChainId): boolean
    /**
     * True while the chain's current mode (BetaNet, a custom node) restricts
     * `capability`: off for this network rather than absent from the build.
     * @throws ChainAdapterNotRegisteredError
     */
    isRestricted(chainId: ChainId, capability: ChainCapability): boolean
    /**
     * False when an override must not switch `capability` on for the chain:
     * its module doesn't list it as supported.
     * @throws ChainAdapterNotRegisteredError
     */
    supports(chainId: ChainId, capability: ChainCapability): boolean
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

/** The build layer, from `CHAINS` and `CHAIN_<ID>_CAPABILITIES`. */
export interface ChainSetupConfig {
    enabled: readonly ChainId[]
    /** A listed chain gets exactly these capabilities on and every other one off. */
    capabilities: Partial<Record<ChainId, readonly ChainCapability[]>>
}

const NO_OVERRIDES = (): ChainCapabilityOverrides => ({})

/** Starts empty: each composition root registers its chains through `registerChainSetup`. */
export const createChainRegistry = (): ChainRegistry => {
    const chains = new Map<
        ChainId,
        {
            chain: RegisteredChain
            build: ChainCapabilities
            restrictions?: ChainCapabilityRestrictions
            supported: ReadonlySet<ChainCapability>
        }
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
        register: (
            descriptor,
            build,
            restrictions,
            supported = CHAIN_CAPABILITIES,
        ) => {
            const existing = chains.get(descriptor.id)
            if (existing?.chain.descriptor === descriptor) {
                return
            }
            if (existing) {
                throw new DuplicateChainAdapterError(FEATURE, descriptor.id)
            }
            chains.set(descriptor.id, {
                chain: { descriptor },
                build,
                restrictions,
                supported: new Set(supported),
            })
        },
        get: chainId => entryFor(chainId).chain,
        has: chainId => chains.has(chainId),
        list: () => [...chains.values()].map(entry => entry.chain.descriptor),
        capabilities: chainId => {
            const { build, restrictions } = entryFor(chainId)
            // The kill switch is not a capability: it only turns off the Pera backend.
            const { chainEnabled: _chainEnabled, ...overrides } =
                readOverrides()
            // Every registered chain has a build entry; the layer only needs this one.
            const layers = {
                ...overrides,
                build: { [chainId]: build },
                restrictions: { [chainId]: restrictions },
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
        isSwitchedOff: chainId =>
            readOverrides().chainEnabled?.[chainId] === false,
        isRestricted: (chainId, capability) =>
            isRestrictedIn(
                entryFor(chainId).restrictions,
                capability,
                readOverrides().chainMode?.[chainId] ?? 'live',
            ),
        supports: (chainId, capability) =>
            entryFor(chainId).supported.has(capability),
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
    const chainsToRegister = setup
        .filter(entry => entry.enabled)
        .map(entry => ({
            entry,
            build: {
                ...entry.module.capabilityDefaults,
                ...entry.capabilities,
            },
        }))
    // Checked before any chain registers, and at boot rather than in tests: the
    // parity spec only sees the test env's `CHAIN_<ID>_CAPABILITIES`.
    for (const { entry, build } of chainsToRegister) {
        const unsupported = CHAIN_CAPABILITIES.filter(
            capability =>
                build[capability] &&
                !entry.module.supportedCapabilities.includes(capability),
        )
        if (unsupported.length > 0) {
            throw new Error(
                `Chain "${entry.chainId}" is built with ${unsupported.join(', ')} on, which its module does not support`,
            )
        }
    }
    for (const { entry, build } of chainsToRegister) {
        chains.register(
            entry.module.descriptor,
            build,
            entry.module.capabilityRestrictions,
            entry.module.supportedCapabilities,
        )
        entry.module.register(contextFor(entry))
    }
}

export const buildChainSetup = (
    chains: ChainSetupConfig,
    modules: Partial<Record<ChainId, ChainModule>>,
    endpointsFor: (chainId: ChainId) => ChainEndpoints,
): ChainSetupEntry[] => {
    for (const chainId of chains.enabled) {
        if (!modules[chainId]) {
            throw new Error(
                `Chain "${chainId}" is enabled but no chain module was supplied for it`,
            )
        }
    }
    return (Object.entries(modules) as [ChainId, ChainModule | undefined][])
        .filter((entry): entry is [ChainId, ChainModule] => !!entry[1])
        .map(([chainId, module]) => {
            const listed = chains.capabilities[chainId]
            return {
                chainId,
                enabled: chains.enabled.includes(chainId),
                module,
                endpoints: endpointsFor(chainId),
                ...(listed && {
                    capabilities: Object.fromEntries(
                        CHAIN_CAPABILITIES.map(capability => [
                            capability,
                            listed.includes(capability),
                        ]),
                    ) as ChainCapabilities,
                }),
            }
        })
}
