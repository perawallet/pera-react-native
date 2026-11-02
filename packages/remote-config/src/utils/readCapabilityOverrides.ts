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

import { z } from 'zod'
import {
    CHAIN_CAPABILITIES,
    CHAIN_IDS,
    type CapabilityOverrides,
    type ChainCapability,
    type ChainCapabilityOverrides,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useRemoteConfigStore } from '../store'
import { areConfigOverridesIgnored } from './areConfigOverridesIgnored'

export interface ChainOverrides {
    enabled?: boolean
    capabilities: Partial<Record<ChainCapability, boolean>>
}

const NO_OVERRIDES: ChainOverrides = { capabilities: {} }

const chainOverridesSchema = z.object({
    enabled: z.boolean().optional(),
    capabilities: z.record(z.string(), z.unknown()).optional(),
})

export const chainOverridesKey = (chainId: ChainId): string =>
    `chain_${chainId}_overrides`

// Read on every capabilities() call, so warn once per bad value, not per read.
// Keyed by value too, since the remote and developer layers share a key.
const warned = new Set<string>()

const warnOnce = (
    key: string,
    json: string,
    message: string,
    details: Record<string, unknown>,
): void => {
    const slot = `${key}\n${json}`
    if (warned.has(slot)) return
    warned.add(slot)
    logger.warn(message, { remoteConfigKey: key, ...details })
}

/**
 * Never throws: a bad blob means no overrides. Unknown capability names are
 * dropped rather than failing the blob, so an older build still honours the
 * `enabled: false` kill switch next to a capability it doesn't know. So is a
 * `true` for a capability `supports` refuses; a `false` always applies.
 */
export const parseChainOverrides = (
    json: string,
    key: string,
    supports: (capability: ChainCapability) => boolean,
): ChainOverrides => {
    if (json === '') return NO_OVERRIDES
    let parsed: z.infer<typeof chainOverridesSchema>
    try {
        parsed = chainOverridesSchema.parse(JSON.parse(json))
    } catch (error) {
        warnOnce(key, json, 'Ignoring malformed chain overrides', { error })
        return NO_OVERRIDES
    }
    const capabilities: ChainOverrides['capabilities'] = {}
    const unsupported: ChainCapability[] = []
    for (const capability of CHAIN_CAPABILITIES) {
        const value = parsed.capabilities?.[capability]
        if (typeof value !== 'boolean') continue
        if (value && !supports(capability)) {
            unsupported.push(capability)
            continue
        }
        capabilities[capability] = value
    }
    if (unsupported.length > 0) {
        warnOnce(
            key,
            json,
            'Ignoring overrides for capabilities the chain does not support',
            {
                capabilities: unsupported,
            },
        )
    }
    return { enabled: parsed.enabled, capabilities }
}

/** Remote and developer layers for the chain registry, readable outside React. */
export const readCapabilityOverrides = (): ChainCapabilityOverrides => {
    const { remoteConfig, chains } = getProvider()
    const saved = areConfigOverridesIgnored()
        ? {}
        : useRemoteConfigStore.getState().configOverrides
    const remote: CapabilityOverrides = {}
    const developer: CapabilityOverrides = {}
    const chainEnabled: Partial<Record<ChainId, boolean>> = {}

    for (const chainId of CHAIN_IDS) {
        const key = chainOverridesKey(chainId)
        // An unregistered chain is never resolved, so there is nothing to guard.
        const supports = (capability: ChainCapability): boolean =>
            !chains.has(chainId) || chains.supports(chainId, capability)
        const fromRemote = parseChainOverrides(
            remoteConfig.getStringValue(key, ''),
            key,
            supports,
        )
        const savedValue = saved[key]
        const fromDeveloper =
            typeof savedValue === 'string'
                ? parseChainOverrides(savedValue, key, supports)
                : NO_OVERRIDES

        remote[chainId] = fromRemote.capabilities
        developer[chainId] = fromDeveloper.capabilities
        const enabled = fromDeveloper.enabled ?? fromRemote.enabled
        if (enabled !== undefined) {
            chainEnabled[chainId] = enabled
        }
    }

    return { remote, developer, chainEnabled }
}
