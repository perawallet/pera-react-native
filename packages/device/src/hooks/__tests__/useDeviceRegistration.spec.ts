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

import { describe, test, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { onlineManager, focusManager } from '@tanstack/react-query'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import type { DeviceAccountRegistration } from '../../models'

const mockRegisterDevice = vi.fn()
const registrationApi = vi.hoisted(() => ({ isV4: false }))

vi.mock('../registrationApi', () => ({
    isDeviceRegistrationV4Enabled: () => registrationApi.isV4,
}))
const mockClearDevicePushToken = vi.fn()

vi.mock('../useDevice', () => ({
    useDevice: () => ({
        registerDevice: mockRegisterDevice,
        clearDevicePushToken: mockClearDevicePushToken,
        deviceIDs: undefined,
        setDeviceID: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            critical: vi.fn(),
        },
    }
})

// Builds a registration entry. Defaults to the most common real-world
// shape (a signing account, notifications on) so each test only spells out the field
// it cares about.
const registration = (
    address: string,
    overrides: Partial<DeviceAccountRegistration> = {},
): DeviceAccountRegistration => ({
    chainId: 'algorand',
    address,
    accountType: 'signing-kind',
    rank: 2,
    receiveNotifications: true,
    ...overrides,
})

describe('useDeviceRegistration', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        registrationApi.isV4 = false
        mockRegisterDevice.mockResolvedValue({ createdNew: false })
        mockClearDevicePushToken.mockResolvedValue(undefined)
        useNetworkStore.getState().resetState()
        onlineManager.setOnline(true)
        const { useDeviceStore } = await import('../../store')
        useDeviceStore.getState().resetState()
    })

    afterEach(() => {
        onlineManager.setOnline(true)
        focusManager.setFocused(undefined)
    })

    test('registers device on mount without clearing push token (no prior deployment)', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const accounts = [registration('acct-1')]
        renderHook(() => useDeviceRegistration(accounts))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledWith(accounts)
        })
        expect(mockClearDevicePushToken).not.toHaveBeenCalled()
    })

    test('clears the previous deployment push token before re-registering on a deployment switch', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const accounts = [registration('acct-1')]
        const { rerender } = renderHook(() => useDeviceRegistration(accounts))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        act(() => useNetworkStore.getState().setMode('developer'))
        rerender()

        await waitFor(() => {
            expect(mockClearDevicePushToken).toHaveBeenCalledWith('live')
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
    })

    test('registers on the developer deployment after a live to developer flip', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { rerender } = renderHook(() =>
            useDeviceRegistration([registration('acct-1')]),
        )
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        act(() => useNetworkStore.getState().setMode('developer'))
        rerender()

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        expect(mockClearDevicePushToken).toHaveBeenCalledTimes(1)
    })

    test('does not clear or re-register when only the network changes inside developer mode', async () => {
        act(() => useNetworkStore.getState().setMode('developer'))
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { rerender } = renderHook(() =>
            useDeviceRegistration([registration('acct-1')]),
        )
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        // setState, not selectNetwork: that resolves the chain registry, which
        // this package's tests do not populate.
        act(() =>
            useNetworkStore.setState({
                selectedNetworkByChain: { algorand: 'betanet' },
            }),
        )
        rerender()

        expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        expect(mockClearDevicePushToken).not.toHaveBeenCalled()
    })

    test('re-registers when the app language changes, and not when it is set to the same one', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { setActiveLocale } =
            await import('@perawallet/wallet-core-shared')
        setActiveLocale('en')

        renderHook(() => useDeviceRegistration([registration('acct-1')]))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        act(() => setActiveLocale('de'))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })

        act(() => setActiveLocale('de'))

        expect(mockRegisterDevice).toHaveBeenCalledTimes(2)

        setActiveLocale('en')
    })

    test('does not re-register when a new array carries the same accounts', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(
            ({ accounts }: { accounts: DeviceAccountRegistration[] }) =>
                useDeviceRegistration(accounts),
            {
                initialProps: {
                    accounts: [registration('acct-1'), registration('acct-2')],
                },
            },
        )

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        rerender({
            accounts: [registration('acct-1'), registration('acct-2')],
        })

        expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
    })

    test('does not re-register when the same accounts arrive reordered', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(
            ({ accounts }: { accounts: DeviceAccountRegistration[] }) =>
                useDeviceRegistration(accounts),
            {
                initialProps: {
                    accounts: [registration('acct-1'), registration('acct-2')],
                },
            },
        )

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        rerender({
            accounts: [registration('acct-2'), registration('acct-1')],
        })

        expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
    })

    test('re-registers when the account set changes', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(
            ({ accounts }: { accounts: DeviceAccountRegistration[] }) =>
                useDeviceRegistration(accounts),
            { initialProps: { accounts: [registration('acct-1')] } },
        )

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        const nextAccounts = [registration('acct-1'), registration('acct-2')]
        rerender({ accounts: nextAccounts })

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        expect(mockRegisterDevice).toHaveBeenLastCalledWith(nextAccounts)
    })

    test('re-registers when an account gains and then loses an address on another chain', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const algorandOnly = [registration('ACCT')]
        const withEthereum = [
            ...algorandOnly,
            registration('0xacct', { chainId: 'ethereum', rank: 0 }),
        ]

        const { rerender } = renderHook(
            ({ accounts }: { accounts: DeviceAccountRegistration[] }) =>
                useDeviceRegistration(accounts),
            { initialProps: { accounts: algorandOnly } },
        )
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        rerender({ accounts: withEthereum })
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        expect(mockRegisterDevice).toHaveBeenLastCalledWith(withEthereum)

        rerender({ accounts: [...algorandOnly] })
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(3)
        })
        expect(mockRegisterDevice).toHaveBeenLastCalledWith(algorandOnly)
    })

    test('re-registers when one address moves to another chain', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(
            ({ accounts }: { accounts: DeviceAccountRegistration[] }) =>
                useDeviceRegistration(accounts),
            { initialProps: { accounts: [registration('0xshared')] } },
        )
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        rerender({
            accounts: [registration('0xshared', { chainId: 'ethereum' })],
        })

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
    })

    test('re-registers the same accounts when the v4 switch flips', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useRemoteConfigStore } =
            await import('@perawallet/wallet-core-remote-config')
        const accounts = [registration('ACCT')]

        renderHook(() => useDeviceRegistration(accounts))
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        act(() => {
            registrationApi.isV4 = true
            useRemoteConfigStore
                .getState()
                .setConfigOverride('enable_device_registration_v4', true)
        })

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        expect(mockRegisterDevice).toHaveBeenLastCalledWith(accounts)
        useRemoteConfigStore.getState().resetState()
    })

    test('registers with an empty list when no accounts exist', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        renderHook(() => useDeviceRegistration([]))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledWith([])
        })
    })

    test('swallows push-token cleanup failures on a deployment switch', async () => {
        mockClearDevicePushToken.mockRejectedValueOnce(new Error('boom'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(() =>
            useDeviceRegistration([registration('acct-1')]),
        )
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        act(() => useNetworkStore.getState().setMode('developer'))
        rerender()

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
    })

    test('retries a failed registration when connectivity returns', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('offline'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')
        const accounts = [registration('acct-1')]
        renderHook(() => useDeviceRegistration(accounts))

        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationDeployments,
            ).toContain('live')
        })

        act(() => onlineManager.setOnline(false))
        act(() => onlineManager.setOnline(true))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationDeployments,
            ).toEqual([])
        })
    })

    test('stays pending after a create that saved an id but registered no accounts, and retries on reconnect', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore, deviceIdForDeployment } =
            await import('../../store')
        // What useDevice does on an empty create: save the id, then fail.
        mockRegisterDevice.mockImplementationOnce(async () => {
            useDeviceStore.getState().setDeviceID('live', 'DEV-EMPTY')
            throw new Error('chain refused')
        })
        const accounts = [registration('0xacct', { chainId: 'ethereum' })]
        renderHook(() => useDeviceRegistration(accounts))

        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationDeployments,
            ).toContain('live')
        })
        expect(deviceIdForDeployment(useDeviceStore.getState(), 'live')).toBe(
            'DEV-EMPTY',
        )

        act(() => onlineManager.setOnline(false))
        act(() => onlineManager.setOnline(true))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        expect(mockRegisterDevice).toHaveBeenLastCalledWith(accounts)
    })

    test('retries a failed registration on an edge the caller supplies', async () => {
        mockRegisterDevice.mockRejectedValueOnce(
            new Error('no integrity token'),
        )
        let fireEdge: () => void = () => undefined
        const subscribeToRetryEdge = (onEdge: () => void) => {
            fireEdge = onEdge
            return () => {
                fireEdge = () => undefined
            }
        }

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')
        const accounts = [registration('acct-1')]
        renderHook(() =>
            useDeviceRegistration(accounts, { subscribeToRetryEdge }),
        )
        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationDeployments,
            ).toContain('live')
        })

        act(() => fireEdge())

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
    })

    test('retries a failed registration when the app is foregrounded', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('degraded link'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')
        const accounts = [registration('acct-1')]
        renderHook(() => useDeviceRegistration(accounts))

        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationDeployments,
            ).toContain('live')
        })

        act(() => focusManager.setFocused(false))
        act(() => focusManager.setFocused(true))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
    })

    test('suppresses reconnect retry while a mount registration is in flight', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('first attempt'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')

        let accounts = [registration('acct-1')]
        const { rerender } = renderHook(() => useDeviceRegistration(accounts))

        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationDeployments,
            ).toContain('live')
        })

        // Account-set change fires a second mount registration that hangs.
        let resolveHanging = () => {}
        mockRegisterDevice.mockImplementationOnce(
            () =>
                new Promise<{ createdNew: boolean }>(resolve => {
                    resolveHanging = () => resolve({ createdNew: false })
                }),
        )
        accounts = [registration('acct-1'), registration('acct-2')]
        rerender()
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })

        // A reconnect edge during the in-flight attempt must not stack a third.
        act(() => onlineManager.setOnline(false))
        act(() => onlineManager.setOnline(true))
        expect(mockRegisterDevice).toHaveBeenCalledTimes(2)

        act(() => resolveHanging())
        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationDeployments,
            ).toEqual([])
        })
    })

    test('does not re-register on reconnect once registration succeeded', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const accounts = [registration('acct-1')]
        renderHook(() => useDeviceRegistration(accounts))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        act(() => onlineManager.setOnline(false))
        act(() => onlineManager.setOnline(true))

        expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
    })

    // Note: the effect's re-run key is a sorted digest used purely to decide
    // *whether* to fire — the payload actually sent is always the caller's
    // array in the order it was passed (see "passes the registrations
    // through unflattened" below), because a three-field key can't be
    // losslessly unsorted back into per-account type/notification flags.
    // What this test verifies is that the mount attempt and the retry
    // attempt send the exact same list, not that either is alphabetized.
    test('retries with the same account list the mount path registers', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('offline'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')
        const accounts = [registration('acct-2'), registration('acct-1')]
        renderHook(() => useDeviceRegistration(accounts))

        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationDeployments,
            ).toContain('live')
        })
        expect(mockRegisterDevice).toHaveBeenLastCalledWith(accounts)

        act(() => onlineManager.setOnline(false))
        act(() => onlineManager.setOnline(true))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        expect(mockRegisterDevice).toHaveBeenLastCalledWith(accounts)
    })

    test('ignores a stale success settling after a newer attempt failed', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')

        let resolveFirst = () => {}
        mockRegisterDevice.mockImplementationOnce(
            () =>
                new Promise<{ createdNew: boolean }>(resolve => {
                    resolveFirst = () => resolve({ createdNew: false })
                }),
        )

        const { rerender } = renderHook(
            ({ accounts }: { accounts: DeviceAccountRegistration[] }) =>
                useDeviceRegistration(accounts),
            { initialProps: { accounts: [registration('acct-1')] } },
        )
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        // Account-set change: the newer attempt fails and marks pending.
        mockRegisterDevice.mockRejectedValueOnce(new Error('newer failed'))
        rerender({
            accounts: [registration('acct-1'), registration('acct-2')],
        })
        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationDeployments,
            ).toContain('live')
        })

        // The stale first attempt settles late — it must not mark the newer
        // failure as healed.
        await act(async () => resolveFirst())
        expect(
            useDeviceStore.getState().pendingRegistrationDeployments,
        ).toContain('live')
    })

    test('a stale settle does not release the lock a newer attempt owns', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('first failed'))
        let rejectSecond = (_reason?: unknown) => {}
        mockRegisterDevice.mockImplementationOnce(
            () =>
                new Promise<void>((_resolve, reject) => {
                    rejectSecond = reject
                }),
        )
        mockRegisterDevice.mockImplementationOnce(() => new Promise(() => {}))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')
        const { useDeviceStore } = await import('../../store')

        const { rerender } = renderHook(
            ({ accounts }: { accounts: DeviceAccountRegistration[] }) =>
                useDeviceRegistration(accounts),
            { initialProps: { accounts: [registration('acct-1')] } },
        )
        await waitFor(() => {
            expect(
                useDeviceStore.getState().pendingRegistrationDeployments,
            ).toContain('live')
        })

        // Two further attempts: #2 hangs, then #3 starts and owns the lock.
        rerender({
            accounts: [registration('acct-1'), registration('acct-2')],
        })
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
        rerender({
            accounts: [
                registration('acct-1'),
                registration('acct-2'),
                registration('acct-3'),
            ],
        })
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(3)
        })

        // #2 settles late; its finally must not release #3's lock, so a
        // reconnect edge cannot stack a retry on the in-flight attempt.
        await act(async () => rejectSecond(new Error('stale failure')))
        act(() => onlineManager.setOnline(false))
        act(() => onlineManager.setOnline(true))
        expect(mockRegisterDevice).toHaveBeenCalledTimes(3)
    })

    test('swallows registration failures (best-effort)', async () => {
        mockRegisterDevice.mockRejectedValueOnce(new Error('boom'))

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const accounts = [registration('acct-1')]
        const result = renderHook(() => useDeviceRegistration(accounts))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalled()
        })

        // Hook never re-throws; the unhandled rejection guard would fire
        // otherwise. The render stays clean.
        expect(result.result.current).toBeUndefined()
    })

    test('invokes onDeviceCreated when registration created a new device', async () => {
        mockRegisterDevice.mockResolvedValue({ createdNew: true })
        const onDeviceCreated = vi.fn()

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        renderHook(() =>
            useDeviceRegistration([registration('ADDR')], { onDeviceCreated }),
        )
        await waitFor(() =>
            expect(onDeviceCreated).toHaveBeenCalledWith('live'),
        )
    })

    test('does not invoke onDeviceCreated on a plain update', async () => {
        mockRegisterDevice.mockResolvedValue({ createdNew: false })
        const onDeviceCreated = vi.fn()

        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        renderHook(() =>
            useDeviceRegistration([registration('ADDR')], { onDeviceCreated }),
        )
        await waitFor(() => expect(mockRegisterDevice).toHaveBeenCalled())
        expect(onDeviceCreated).not.toHaveBeenCalled()
    })

    it('does not re-register when only the array reference changed', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(
            ({ accounts }: { accounts: DeviceAccountRegistration[] }) =>
                useDeviceRegistration(accounts),
            { initialProps: { accounts: [registration('ADDR_A')] } },
        )

        rerender({ accounts: [registration('ADDR_A')] })

        expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
    })

    it('re-registers when an account type changes', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(
            ({ accounts }: { accounts: DeviceAccountRegistration[] }) =>
                useDeviceRegistration(accounts),
            { initialProps: { accounts: [registration('ADDR_A')] } },
        )
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        rerender({
            accounts: [
                registration('ADDR_A', {
                    accountType: 'other-kind',
                    rank: 3,
                }),
            ],
        })

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
    })

    it('re-registers when an account is muted', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const { rerender } = renderHook(
            ({ accounts }: { accounts: DeviceAccountRegistration[] }) =>
                useDeviceRegistration(accounts),
            { initialProps: { accounts: [registration('ADDR_A')] } },
        )
        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(1)
        })

        rerender({
            accounts: [registration('ADDR_A', { receiveNotifications: false })],
        })

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledTimes(2)
        })
    })

    it('passes the registrations through unflattened', async () => {
        const { useDeviceRegistration } =
            await import('../useDeviceRegistration')

        const accounts = [
            registration('ADDR_A', { accountType: 'other-kind', rank: 3 }),
        ]

        renderHook(() => useDeviceRegistration(accounts))

        await waitFor(() => {
            expect(mockRegisterDevice).toHaveBeenCalledWith(accounts)
        })
    })
})
