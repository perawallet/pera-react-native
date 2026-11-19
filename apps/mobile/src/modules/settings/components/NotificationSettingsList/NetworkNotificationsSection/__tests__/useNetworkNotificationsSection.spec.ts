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

import { renderHook } from '@test-utils/render'
import { act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDeviceStore } from '@perawallet/wallet-core-device'

const mocks = vi.hoisted(() => ({
    canMute: ['ethereum', 'base'] as string[],
    isPushSupported: true,
    toggleNetworkNotification: vi.fn(),
    isTogglePending: vi.fn((_chainId: string) => false),
}))

vi.mock('@perawallet/wallet-core-device', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-device')>()
    return { ...actual, useChainsDeviceCanMute: () => mocks.canMute }
})

vi.mock('@perawallet/wallet-extension-provider', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-extension-provider')
        >()
    return {
        ...actual,
        getProvider: () => ({
            ...actual.getProvider(),
            pushNotification: { isSupported: () => mocks.isPushSupported },
            chains: {
                get: (chainId: string) => ({
                    descriptor: {
                        displayName: { ethereum: 'Ethereum', base: 'Base' }[
                            chainId
                        ],
                    },
                }),
            },
        }),
    }
})

vi.mock('@modules/settings/hooks/useNetworkNotificationToggle', () => ({
    useNetworkNotificationToggle: () => ({
        toggleNetworkNotification: mocks.toggleNetworkNotification,
        isTogglePending: mocks.isTogglePending,
    }),
}))

import { useNetworkNotificationsSection } from '../useNetworkNotificationsSection'

describe('useNetworkNotificationsSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.canMute = ['ethereum', 'base']
        mocks.isPushSupported = true
        mocks.toggleNetworkNotification.mockResolvedValue(true)
        useDeviceStore.getState().resetState()
    })

    it('lists the networks the device can mute with their display names', () => {
        const { result } = renderHook(() => useNetworkNotificationsSection())

        expect(result.current.networks).toEqual([
            { chainId: 'ethereum', displayName: 'Ethereum' },
            { chainId: 'base', displayName: 'Base' },
        ])
    })

    it('lists none when the platform cannot receive push', () => {
        mocks.isPushSupported = false

        const { result } = renderHook(() => useNetworkNotificationsSection())

        expect(result.current.networks).toEqual([])
    })

    it('reports a network enabled until it is muted', () => {
        const { result } = renderHook(() => useNetworkNotificationsSection())
        expect(result.current.isNetworkEnabled('ethereum')).toBe(true)

        act(() => useDeviceStore.getState().setChainMuted('ethereum', true))

        expect(result.current.isNetworkEnabled('ethereum')).toBe(false)
        expect(result.current.isNetworkEnabled('base')).toBe(true)
    })

    it('forwards a toggle to the network notification toggle', () => {
        const { result } = renderHook(() => useNetworkNotificationsSection())

        act(() => result.current.handleNetworkToggle('base', false))

        expect(mocks.toggleNetworkNotification).toHaveBeenCalledWith(
            'base',
            false,
        )
    })

    it('reports a network pending while its toggle is in flight', () => {
        mocks.isTogglePending.mockImplementation(
            (chainId: string) => chainId === 'ethereum',
        )
        const { result } = renderHook(() => useNetworkNotificationsSection())

        expect(result.current.isNetworkPending('ethereum')).toBe(true)
        expect(result.current.isNetworkPending('base')).toBe(false)
    })
})
