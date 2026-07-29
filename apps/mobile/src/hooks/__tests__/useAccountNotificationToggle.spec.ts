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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { onlineManager } from '@tanstack/react-query'
import { NoConnectionError } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    setAccountEnabled: vi.fn(),
    registerDevice: vi.fn(),
    showToast: vi.fn(),
    accounts: [] as WalletAccount[],
    disabledAccounts: [] as string[],
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useNotificationPreferences: () => ({
        setAccountEnabled: mocks.setAccountEnabled,
        isAccountEnabled: vi.fn(() => true),
        disabledAccounts: mocks.disabledAccounts,
    }),
}))

// The mobile-wide vitest setup mocks `@perawallet/wallet-core-accounts` with a
// fixed empty-store double. This hook reads the real account list to build
// the registration payload, so restore the actual implementation and only
// override `useAllAccounts` — the rest (types, `buildDeviceAccountRegistrations`)
// runs for real.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return { ...actual, useAllAccounts: () => mocks.accounts }
})

// Partial mock: `buildDeviceAccountRegistrations` (pulled in via the real
// `@perawallet/wallet-core-accounts` above) needs the real `DeviceAccountTypes`
// map, so only `useDevice` itself is overridden.
vi.mock('@perawallet/wallet-core-device', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-device')>()
    return {
        ...actual,
        useDevice: () => ({ registerDevice: mocks.registerDevice }),
    }
})

// Only useToast is mocked: the real useErrorToast runs, so these tests prove
// the offline copy end to end rather than trusting a mocked dispatcher.
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mocks.showToast,
        errorToast: vi.fn(),
        infoToast: vi.fn(),
        successToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import {
    useAccountNotificationToggle,
    clearAccountNotificationToggleGuardForTests,
} from '../useAccountNotificationToggle'

type SeedAccount = Pick<WalletAccount, 'id' | 'address' | 'type'> &
    Partial<WalletAccount>

const seedAccounts = (accounts: SeedAccount[]): void => {
    mocks.accounts = accounts as WalletAccount[]
}

describe('useAccountNotificationToggle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.registerDevice.mockResolvedValue({ createdNew: false })
        mocks.accounts = []
        mocks.disabledAccounts = []
        // The in-flight guard is module scope (R2: shared app-wide across
        // hook instances), so it survives across tests in this file unless
        // explicitly cleared — a leaked entry would wedge an unrelated test.
        clearAccountNotificationToggleGuardForTests()
    })

    afterEach(() => onlineManager.setOnline(true))

    it('applies the optimistic write and re-registers the device on success', async () => {
        seedAccounts([
            { id: '1', address: 'ADDR1', type: 'algo25', keyPairId: 'kp' },
        ])

        const { result } = renderHook(() => useAccountNotificationToggle())

        let outcome: boolean | undefined
        await act(async () => {
            outcome = await result.current.toggleAccountNotification(
                'ADDR1',
                true,
            )
        })

        expect(outcome).toBe(true)
        expect(mocks.setAccountEnabled).toHaveBeenCalledTimes(1)
        expect(mocks.setAccountEnabled).toHaveBeenCalledWith('ADDR1', true)
        expect(mocks.registerDevice).toHaveBeenCalledWith([
            {
                address: 'ADDR1',
                accountType: 'algo25',
                receiveNotifications: true,
            },
        ])
        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it('rolls back and resolves false when the backend rejects', async () => {
        mocks.registerDevice.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useAccountNotificationToggle())

        let outcome: boolean | undefined
        await act(async () => {
            outcome = await result.current.toggleAccountNotification(
                'ADDR1',
                true,
            )
        })

        expect(outcome).toBe(false)
        expect(mocks.setAccountEnabled).toHaveBeenNthCalledWith(
            1,
            'ADDR1',
            true,
        )
        expect(mocks.setAccountEnabled).toHaveBeenNthCalledWith(
            2,
            'ADDR1',
            false,
        )
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            undefined,
        )
    })

    // AC #2: the persisted store must end up matching what the backend was
    // last told, so a restart cannot resurrect an optimistic value the
    // backend never received.
    it('leaves the store at its pre-toggle value after a failed mutation', async () => {
        let stored = false
        mocks.setAccountEnabled.mockImplementation(
            (_address: string, enabled: boolean) => {
                stored = enabled
            },
        )
        mocks.registerDevice.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useAccountNotificationToggle())

        await act(async () => {
            await result.current.toggleAccountNotification('ADDR1', true)
        })

        expect(stored).toBe(false)
    })

    // Fire-and-fail regime: networkMode 'always' means the mutationFn runs
    // and rejects offline instead of pausing.
    it('shows the localized offline copy when the failure is connectivity', async () => {
        onlineManager.setOnline(false)
        mocks.registerDevice.mockRejectedValue(new NoConnectionError())

        const { result } = renderHook(() => useAccountNotificationToggle())

        await act(async () => {
            await result.current.toggleAccountNotification('ADDR1', true)
        })

        expect(mocks.registerDevice).toHaveBeenCalledTimes(1)
        expect(mocks.showToast).toHaveBeenCalledWith(
            {
                title: 'errors.network.no_connection.title',
                body: 'errors.network.no_connection.body',
                type: 'error',
            },
            undefined,
        )
    })

    // Concurrency guard: two overlapping toggles for one address used to roll
    // each other back to the wrong value, and the store is persisted, so the
    // divergence from the backend survived a restart.
    it('leaves the store at the ORIGINAL value when a double tap both fail', async () => {
        let stored = true
        mocks.setAccountEnabled.mockImplementation(
            (_address: string, enabled: boolean) => {
                stored = enabled
            },
        )

        // Both requests hang, then fail in flight order. Without the guard the
        // rollbacks run `!enabled` against each other: #1 restores `true`, #2
        // then overwrites it with `false`, leaving the store disabled while
        // the backend still holds enabled.
        const rejecters: ((reason: Error) => void)[] = []
        mocks.registerDevice.mockImplementation(
            () =>
                new Promise((_resolve, reject) => {
                    rejecters.push(reject)
                }),
        )

        const { result } = renderHook(() => useAccountNotificationToggle())

        const taps: Promise<boolean>[] = []
        await act(async () => {
            taps.push(result.current.toggleAccountNotification('ADDR1', false))
        })
        await act(async () => {
            taps.push(result.current.toggleAccountNotification('ADDR1', true))
        })

        await act(async () => {
            rejecters.forEach(reject => reject(new Error('boom')))
            await Promise.all(taps)
        })

        expect(await taps[1]).toBe(false)
        expect(stored).toBe(true)
        expect(mocks.registerDevice).toHaveBeenCalledTimes(1)
        // R1: the guard is released in a `finally`, even on failure. Without
        // that release this assertion would fail and the address would stay
        // wedged pending forever — switch stuck disabled, no recovery short
        // of remounting.
        expect(result.current.isTogglePending('ADDR1')).toBe(false)
    })

    it('early-returns a concurrent call for the same address without writing the store', async () => {
        let resolveFirst: ((value: unknown) => void) | undefined
        mocks.registerDevice.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveFirst = resolve
                }),
        )

        const { result } = renderHook(() => useAccountNotificationToggle())

        let firstTap: Promise<boolean> | undefined
        await act(async () => {
            firstTap = result.current.toggleAccountNotification('ADDR1', false)
        })

        expect(mocks.setAccountEnabled).toHaveBeenCalledTimes(1)

        let secondTap: boolean | undefined
        await act(async () => {
            secondTap = await result.current.toggleAccountNotification(
                'ADDR1',
                true,
            )
        })

        expect(secondTap).toBe(false)
        expect(mocks.setAccountEnabled).toHaveBeenCalledTimes(1)
        expect(mocks.showToast).not.toHaveBeenCalled()

        await act(async () => {
            resolveFirst?.({})
            await firstTap
        })
    })

    // R2: the in-flight guard is module scope, shared by every hook
    // instance — not per hook instance. Three real call sites
    // (useAccountOptions, and NotificationSettingsList mounted from two
    // separate screens) can each mount their own instance of this hook, so
    // the guard must hold across instances or the divergence R1/R2 guard
    // against can reappear via a second screen instead of a second tap.
    it('early-returns a concurrent call for the same address from a second hook instance', async () => {
        let resolveFirst: ((value: unknown) => void) | undefined
        mocks.registerDevice.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveFirst = resolve
                }),
        )

        const instanceA = renderHook(() => useAccountNotificationToggle())
        const instanceB = renderHook(() => useAccountNotificationToggle())

        let firstTap: Promise<boolean> | undefined
        await act(async () => {
            firstTap = instanceA.result.current.toggleAccountNotification(
                'ADDR1',
                false,
            )
        })

        expect(mocks.setAccountEnabled).toHaveBeenCalledTimes(1)

        let secondTap: boolean | undefined
        await act(async () => {
            secondTap =
                await instanceB.result.current.toggleAccountNotification(
                    'ADDR1',
                    true,
                )
        })

        // The second instance's request never started: no second registration, no
        // second optimistic write.
        expect(secondTap).toBe(false)
        expect(mocks.registerDevice).toHaveBeenCalledTimes(1)
        expect(mocks.setAccountEnabled).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveFirst?.({})
            await firstTap
        })
    })

    it('does not block a concurrent toggle for a different address', async () => {
        let resolveFirst: ((value: unknown) => void) | undefined
        mocks.registerDevice.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveFirst = resolve
                }),
        )

        const { result } = renderHook(() => useAccountNotificationToggle())

        let firstTap: Promise<boolean> | undefined
        await act(async () => {
            firstTap = result.current.toggleAccountNotification('ADDR1', false)
        })

        await act(async () => {
            await result.current.toggleAccountNotification('ADDR2', false)
        })

        expect(mocks.setAccountEnabled).toHaveBeenNthCalledWith(
            2,
            'ADDR2',
            false,
        )

        await act(async () => {
            resolveFirst?.({})
            await firstTap
        })
    })

    it('reports the toggle as pending only while the request is in flight', async () => {
        let resolveFirst: ((value: unknown) => void) | undefined
        mocks.registerDevice.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveFirst = resolve
                }),
        )

        const { result } = renderHook(() => useAccountNotificationToggle())

        expect(result.current.isTogglePending('ADDR1')).toBe(false)

        let firstTap: Promise<boolean> | undefined
        await act(async () => {
            firstTap = result.current.toggleAccountNotification('ADDR1', false)
        })

        expect(result.current.isTogglePending('ADDR1')).toBe(true)
        expect(result.current.isTogglePending('ADDR2')).toBe(false)

        await act(async () => {
            resolveFirst?.({})
            await firstTap
        })

        expect(result.current.isTogglePending('ADDR1')).toBe(false)
    })

    it('shows generic copy when the failure is not connectivity', async () => {
        mocks.registerDevice.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useAccountNotificationToggle())

        await act(async () => {
            await result.current.toggleAccountNotification('ADDR1', true)
        })

        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: expect.not.stringContaining('no_connection'),
            }),
            undefined,
        )
    })

    // v3 has no per-account route: the toggle re-registers the whole device
    // with every account's flag inline, not just the one that changed.
    it('re-registers the device with the toggled flag applied', async () => {
        seedAccounts([
            { id: '1', address: 'ADDR_A', type: 'algo25', keyPairId: 'kp' },
            { id: '2', address: 'ADDR_B', type: 'quantum', keyPairId: 'kp' },
        ])

        const { result } = renderHook(() => useAccountNotificationToggle())

        await act(async () => {
            await result.current.toggleAccountNotification('ADDR_A', false)
        })

        expect(mocks.registerDevice).toHaveBeenCalledWith([
            {
                address: 'ADDR_A',
                accountType: 'algo25',
                receiveNotifications: false,
            },
            {
                address: 'ADDR_B',
                accountType: 'quantum',
                receiveNotifications: true,
            },
        ])
    })

    it('rolls the local preference back and shows an error when re-registration fails', async () => {
        seedAccounts([
            { id: '1', address: 'ADDR_A', type: 'algo25', keyPairId: 'kp' },
        ])
        mocks.registerDevice.mockRejectedValueOnce(new Error('boom'))

        const { result } = renderHook(() => useAccountNotificationToggle())

        let accepted: boolean | undefined
        await act(async () => {
            accepted = await result.current.toggleAccountNotification(
                'ADDR_A',
                false,
            )
        })

        expect(accepted).toBe(false)
        expect(mocks.setAccountEnabled).toHaveBeenLastCalledWith('ADDR_A', true)
        expect(mocks.showToast).toHaveBeenCalled()
    })

    // Review Finding 2: with `disabledAccounts` fixed at `[]` (as it was
    // before this test), the `enabled === true` branch's filter is only ever
    // evaluated against an empty array — un-muting was untestable. Seed a
    // pre-muted account so the filter has something to actually remove.
    it('removes the address from the disabled set when re-enabling a muted account', async () => {
        seedAccounts([
            { id: '1', address: 'ADDR_A', type: 'algo25', keyPairId: 'kp' },
        ])
        mocks.disabledAccounts = ['ADDR_A']

        const { result } = renderHook(() => useAccountNotificationToggle())

        await act(async () => {
            await result.current.toggleAccountNotification('ADDR_A', true)
        })

        expect(mocks.registerDevice).toHaveBeenCalledWith([
            {
                address: 'ADDR_A',
                accountType: 'algo25',
                receiveNotifications: true,
            },
        ])
    })
})
