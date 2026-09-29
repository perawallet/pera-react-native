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
const lastWarned = new Map<string, string>()

const warnOnce = (key: string, json: string, error: unknown): void => {
    if (lastWarned.get(key) === json) return
    lastWarned.set(key, json)
    logger.warn(`Ignoring malformed ${key}`, { error })
}

/**
 * Never throws: a bad blob means no overrides. Unknown capability names are
 * dropped rather than failing the blob, so an older build still honours the
 * `enabled: false` kill switch next to a capability it doesn't know.
 */
export const parseChainOverrides = (
    json: string,
    key: string,
): ChainOverrides => {
    if (json === '') return NO_OVERRIDES
    let parsed: z.infer<typeof chainOverridesSchema>
    try {
        parsed = chainOverridesSchema.parse(JSON.parse(json))
    } catch (error) {
        warnOnce(key, json, error)
        return NO_OVERRIDES
    }
    const capabilities = Object.fromEntries(
        CHAIN_CAPABILITIES.flatMap(capability => {
            const value = parsed.capabilities?.[capability]
            return typeof value === 'boolean' ? [[capability, value]] : []
        }),
    )
    return { enabled: parsed.enabled, capabilities }
}

/** Remote and developer layers for the chain registry, readable outside React. */
export const readCapabilityOverrides = (): ChainCapabilityOverrides => {
    const { remoteConfig } = getProvider()
    const saved = areConfigOverridesIgnored()
        ? {}
        : useRemoteConfigStore.getState().configOverrides
    const remote: CapabilityOverrides = {}
    const developer: CapabilityOverrides = {}
    const chainEnabled: Partial<Record<ChainId, boolean>> = {}

    for (const chainId of CHAIN_IDS) {
        const key = chainOverridesKey(chainId)
        const fromRemote = parseChainOverrides(
            remoteConfig.getStringValue(key, ''),
            key,
        )
        const savedValue = saved[key]
        const fromDeveloper =
            typeof savedValue === 'string'
                ? parseChainOverrides(savedValue, key)
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
