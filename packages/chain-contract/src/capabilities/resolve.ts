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

import type {
    CapabilitySource,
    ChainCapabilities,
    ChainCapability,
} from '../models/capabilities'
import type { ChainId } from '../models/identity'

/** `unknown` because both layers come from untyped storage or JSON. */
export type CapabilityOverrides = Partial<
    Record<ChainId, Partial<Record<ChainCapability, unknown>>>
>

export interface CapabilityLayers {
    /** Module defaults with bootstrap overrides already applied. */
    build: Readonly<Record<ChainId, ChainCapabilities>>
    /** Only values remote config actually fetched. */
    remote?: CapabilityOverrides
    /**
     * Feature Flags screen overrides. Omit it wherever the wallet ignores
     * config overrides (see `areConfigOverridesIgnored` in remote-config).
     */
    developer?: CapabilityOverrides
}

export interface ResolvedCapability {
    value: boolean
    source: CapabilitySource
}

// Same precedence as readRemoteConfigWithOverrides in remote-config: an
// override of the wrong type falls through rather than being coerced.
export const resolveCapabilityWithSource = (
    chainId: ChainId,
    capability: ChainCapability,
    layers: CapabilityLayers,
): ResolvedCapability => {
    const developer = layers.developer?.[chainId]?.[capability]
    if (typeof developer === 'boolean') {
        return { value: developer, source: 'developer' }
    }
    const remote = layers.remote?.[chainId]?.[capability]
    if (typeof remote === 'boolean') {
        return { value: remote, source: 'remote' }
    }
    return { value: layers.build[chainId][capability], source: 'build' }
}

export const resolveCapability = (
    chainId: ChainId,
    capability: ChainCapability,
    layers: CapabilityLayers,
): boolean => resolveCapabilityWithSource(chainId, capability, layers).value
