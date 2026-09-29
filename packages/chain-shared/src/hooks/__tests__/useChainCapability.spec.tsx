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

import React from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    createChainRegistry,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
    type ChainRegistry,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainOverridesKey,
    readCapabilityOverrides,
    useRemoteConfigStore,
} from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useAnyEnabledChainHasCapability,
    useChainCapability,
} from '../useChainCapability'

// Overrides the shared setup's provider stub: this suite needs `chains` and
// `remoteConfig` on it too, which no other chain-shared test does.
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: vi.fn(),
}))

const store = new Map<string, string>()

const keyValueStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => {
        store.delete(key)
    },
}

// Not "web" so areConfigOverridesIgnored (behind readCapabilityOverrides)
// never drops the developer layer these tests set.
const deviceInfo = {
    getDevicePlatform: () => 'ios',
    isStoreBuild: () => false,
}

const descriptor = (id: ChainId): ChainDescriptor =>
    ({ id, networks: [] }) as unknown as ChainDescriptor

const allCapabilities = (value: boolean): ChainCapabilities =>
    Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [capability, value]),
    ) as ChainCapabilities

const SECOND_CHAIN_ID = 'fixturehex' as ChainId

const setUpChains = (): ChainRegistry => {
    const chains = createChainRegistry()
    chains.register(descriptor('algorand'), allCapabilities(true))
    // The only chain with `swap` on, so switching it off leaves none enabled.
    chains.register(descriptor(SECOND_CHAIN_ID), {
        ...allCapabilities(true),
        swap: false,
    })
    chains.setCapabilityOverrides(readCapabilityOverrides)
    return chains
}

const setDeveloperSwap = (enabled: boolean): void => {
    act(() => {
        useRemoteConfigStore
            .getState()
            .setConfigOverride(
                chainOverridesKey('algorand'),
                JSON.stringify({ capabilities: { swap: enabled } }),
            )
    })
}

describe('useChainCapability', () => {
    beforeEach(() => {
        store.clear()
        useRemoteConfigStore.getState().resetState()
        vi.mocked(getProvider).mockReturnValue({
            chains: setUpChains(),
            deviceInfo,
            remoteConfig: {
                getStringValue: (_key: string, fallback = '') => fallback,
            },
            keyValueStorage,
        } as unknown as ReturnType<typeof getProvider>)
    })

    it('is true at the build default', () => {
        const { result } = renderHook(() =>
            useChainCapability('algorand', 'swap'),
        )

        expect(result.current).toBe(true)
    })

    it('follows a developer override without a remount', () => {
        const { result } = renderHook(() =>
            useChainCapability('algorand', 'swap'),
        )

        setDeveloperSwap(false)

        expect(result.current).toBe(false)
    })

    it('removes the gated element from the tree, rather than disabling it', () => {
        const Marker = () => {
            const enabled = useChainCapability('algorand', 'swap')
            return enabled
                ? React.createElement('div', { 'data-testid': 'marker' })
                : null
        }

        render(React.createElement(Marker))
        expect(screen.queryByTestId('marker')).not.toBeNull()

        setDeveloperSwap(false)

        expect(screen.queryByTestId('marker')).toBeNull()
    })
})

describe('useAnyEnabledChainHasCapability', () => {
    beforeEach(() => {
        store.clear()
        useRemoteConfigStore.getState().resetState()
        vi.mocked(getProvider).mockReturnValue({
            chains: setUpChains(),
            deviceInfo,
            remoteConfig: {
                getStringValue: (_key: string, fallback = '') => fallback,
            },
            keyValueStorage,
        } as unknown as ReturnType<typeof getProvider>)
    })

    it('is true while an enabled chain has the capability', () => {
        const { result } = renderHook(() =>
            useAnyEnabledChainHasCapability('swap'),
        )

        expect(result.current).toBe(true)
    })

    it('is false once the only chain with the capability is switched off', () => {
        const { result } = renderHook(() =>
            useAnyEnabledChainHasCapability('swap'),
        )

        setDeveloperSwap(false)

        expect(result.current).toBe(false)
    })
})
