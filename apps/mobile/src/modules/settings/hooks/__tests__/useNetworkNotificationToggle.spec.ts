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
import { assertOnline, NoConnectionError } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import {
    registerAlgorandAccountsAdapter,
    registerAlgorandDeviceAdapter,
} from '@test-utils/algorandAccountsAdapter'
import { allCapabilities } from '@test-utils/chain-fixtures'

const mocks = vi.hoisted(() => ({
    registerDevice: vi.fn(),
    showToast: vi.fn(),
    accounts: [] as WalletAccount[],
    disabledAccounts: [] as string[],
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useNotificationPreferences: () => ({
        disabledAccounts: mocks.disabledAccounts,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return { ...actual, useAllAccounts: () => mocks.accounts }
})

vi.mock('@perawallet/wallet-core-device', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-device')>()
    return {
        ...actual,
        useDevice: () => ({ registerDevice: mocks.registerDevice }),
    }
})

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mocks.showToast,
        errorToast: vi.fn(),
        infoToast: vi.fn(),
        successToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { debugEnabled: false },
    registerCustomNetworkSource: vi.fn(() => () => undefined),
}))

import {
    useNetworkNotificationToggle,
    clearNetworkNotificationToggleGuardForTests,
} from '../useNetworkNotificationToggle'

const isMuted = (): boolean =>
    useDeviceStore.getState().mutedChainIds.includes('ethereum')

describe('useNetworkNotificationToggle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerAlgorandAccountsAdapter()
        registerAlgorandDeviceAdapter()
        const { chains } = getProvider()
        if (!chains.has(ALGORAND_CHAIN_ID)) {
            chains.register(algorandDescriptor, allCapabilities(true))
        }
        mocks.registerDevice.mockResolvedValue({ createdNew: false })
        mocks.accounts = [
            {
                id: '1',
                name: '',
                custody: { kind: 'local', seed: null },
                chains: { algorand: { address: 'ADDR1', keyPairId: 'kp' } },
            },
        ]
        mocks.disabledAccounts = []
        useDeviceStore.getState().resetState()
        clearNetworkNotificationToggleGuardForTests()
    })

    it('keeps the mute and re-registers the device with the current accounts on success', async () => {
        const { result } = renderHook(() => useNetworkNotificationToggle())

        let outcome: boolean | undefined
        await act(async () => {
            outcome = await result.current.toggleNetworkNotification(
                'ethereum',
                false,
            )
        })

        expect(outcome).toBe(true)
        expect(isMuted()).toBe(true)
        expect(mocks.registerDevice).toHaveBeenCalledWith([
            expect.objectContaining({
                chainId: 'algorand',
                address: 'ADDR1',
                receiveNotifications: true,
            }),
        ])
        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it('has already written the mute when the registration starts', async () => {
        let mutedAtRegistration: boolean | undefined
        mocks.registerDevice.mockImplementation(() => {
            mutedAtRegistration = isMuted()
            return Promise.resolve({ createdNew: false })
        })
        const { result } = renderHook(() => useNetworkNotificationToggle())

        await act(async () => {
            await result.current.toggleNetworkNotification('ethereum', false)
        })

        expect(mutedAtRegistration).toBe(true)
    })

    it('unmutes the chain when it is switched back on', async () => {
        useDeviceStore.getState().setChainMuted('ethereum', true)
        const { result } = renderHook(() => useNetworkNotificationToggle())

        await act(async () => {
            await result.current.toggleNetworkNotification('ethereum', true)
        })

        expect(isMuted()).toBe(false)
    })

    it('rolls back, shows the error toast and resolves false when the backend rejects', async () => {
        mocks.registerDevice.mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => useNetworkNotificationToggle())

        let outcome: boolean | undefined
        await act(async () => {
            outcome = await result.current.toggleNetworkNotification(
                'ethereum',
                false,
            )
        })

        expect(outcome).toBe(false)
        expect(isMuted()).toBe(false)
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            undefined,
        )
    })

    it('rolls back without reaching the registration when offline', async () => {
        vi.mocked(assertOnline).mockImplementationOnce(() => {
            throw new NoConnectionError()
        })
        const { result } = renderHook(() => useNetworkNotificationToggle())

        let outcome: boolean | undefined
        await act(async () => {
            outcome = await result.current.toggleNetworkNotification(
                'ethereum',
                false,
            )
        })

        expect(outcome).toBe(false)
        expect(mocks.registerDevice).not.toHaveBeenCalled()
        expect(isMuted()).toBe(false)
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            undefined,
        )
    })

    it('ignores a second toggle for the same chain while one is in flight, from any instance', async () => {
        let resolveFirst: (value: unknown) => void = () => undefined
        mocks.registerDevice.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveFirst = resolve
                }),
        )
        const instanceA = renderHook(() => useNetworkNotificationToggle())
        const instanceB = renderHook(() => useNetworkNotificationToggle())

        let firstTap: Promise<boolean> = Promise.resolve(false)
        await act(async () => {
            firstTap = instanceA.result.current.toggleNetworkNotification(
                'ethereum',
                false,
            )
        })

        let secondTap: boolean | undefined
        await act(async () => {
            secondTap =
                await instanceB.result.current.toggleNetworkNotification(
                    'ethereum',
                    true,
                )
        })

        expect(secondTap).toBe(false)
        expect(isMuted()).toBe(true)
        expect(mocks.registerDevice).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveFirst({})
            await firstTap
        })
    })

    it('reports the toggle pending while in flight and releases it afterwards', async () => {
        let resolveFirst: (value: unknown) => void = () => undefined
        mocks.registerDevice.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveFirst = resolve
                }),
        )
        const { result } = renderHook(() => useNetworkNotificationToggle())

        let tap: Promise<boolean> = Promise.resolve(false)
        await act(async () => {
            tap = result.current.toggleNetworkNotification('ethereum', false)
        })
        expect(result.current.isTogglePending('ethereum')).toBe(true)
        expect(result.current.isTogglePending('base')).toBe(false)

        await act(async () => {
            resolveFirst({})
            await tap
        })

        expect(result.current.isTogglePending('ethereum')).toBe(false)
    })
})
