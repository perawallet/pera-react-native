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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createWrapper } from '@test-utils'
import { PeraNetworkError, type Network } from '@perawallet/wallet-core-shared'
import {
    DeviceAccountTypes,
    type DeviceAccountRegistration,
} from '../../models'

// Mock the registration transport and the raw endpoint separately:
// `registerDevice` (the hook return value) always goes through the mutation,
// `clearDevicePushToken` deliberately bypasses it to target a network that
// isn't the current one (see the JSDoc on that function in useDevice.ts).
const mockedRegisterDeviceMutation = vi.fn()
const mockedRegisterDeviceEndpoint = vi.fn()

vi.mock('../useRegisterDeviceMutation', () => ({
    useRegisterDeviceMutation: () => ({
        mutateAsync: mockedRegisterDeviceMutation,
    }),
}))

vi.mock('../endpoints', () => ({
    registerDevice: (...args: unknown[]) =>
        mockedRegisterDeviceEndpoint(...args),
}))

// Mock device info service via provider. v3 no longer sends `model`, but
// requires `appVersion` on every payload.
const mockDeviceInfoService = {
    getDevicePlatform: vi.fn().mockReturnValue('ios'),
    getDeviceLocale: vi.fn().mockReturnValue('en-US'),
    getAppVersion: vi.fn().mockReturnValue('7.0.1'),
}

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: mockDeviceInfoService,
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn().mockReturnValue({
        network: 'mainnet',
        setNetwork: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        defaultNetwork: 'mainnet',
    },
    Networks: {
        testnet: 'testnet',
        mainnet: 'mainnet',
    },
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

const accounts: DeviceAccountRegistration[] = [
    {
        address: 'ADDR_A',
        accountType: DeviceAccountTypes.quantum,
        receiveNotifications: true,
    },
]

/** Seed helpers written against the real store surface (`useDeviceStore.getState()`). */
const seedDeviceId = async (network: Network, id: string): Promise<void> => {
    const { useDeviceStore } = await import('../../store')
    useDeviceStore.getState().setDeviceID(network, id)
}

const seedPushToken = async (token: string | null): Promise<void> => {
    const { useDeviceStore } = await import('../../store')
    useDeviceStore.getState().setPushToken(token)
}

describe('services/device/hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockedRegisterDeviceMutation.mockResolvedValue({ id: 'new-device-id' })
        mockedRegisterDeviceEndpoint.mockResolvedValue({ id: 'cleared' })
    })

    test('useFcmToken exposes fcmToken and setter', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { usePushToken } = await import('../usePushToken')

        useDeviceStore.getState().resetState()

        const { result } = renderHook(() => usePushToken())

        act(() => {
            result.current.setPushToken('OLD_TOKEN')
        })

        expect(result.current.pushToken).toBe('OLD_TOKEN')

        act(() => {
            result.current.setPushToken('NEW_TOKEN')
        })

        expect(result.current.pushToken).toBe('NEW_TOKEN')
    })

    test('useDeviceID returns correct device ID for network', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useDeviceID } = await import('../useDeviceID')

        useDeviceStore.getState().resetState()

        const { result: store } = renderHook(() => useDeviceStore())

        act(() => {
            store.current.setDeviceID('mainnet', 'test-id-mainnet')
            store.current.setDeviceID('testnet', 'test-id-testnet')
        })

        const { result: resultMainnet } = renderHook(() =>
            useDeviceID('mainnet'),
        )
        expect(resultMainnet.current).toBe('test-id-mainnet')

        const { result: resultTestnet } = renderHook(() =>
            useDeviceID('testnet'),
        )
        expect(resultTestnet.current).toBe('test-id-testnet')
    })

    test('registers without an id when no device id is stored', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()
        await seedPushToken('test-fcm-token')

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        let outcome: { createdNew: boolean } | undefined
        await act(async () => {
            outcome = await result.current.registerDevice(accounts)
        })

        expect(mockedRegisterDeviceMutation).toHaveBeenCalledWith({
            data: {
                accounts,
                platform: 'ios',
                pushToken: 'test-fcm-token',
                locale: 'en-US',
                appVersion: '7.0.1',
            },
        })
        // This is the no-id create path's own `createdNew: true` return —
        // distinct from the 404-recreate path's, which has its own coverage
        // below. Tasks 8/12 branch on this flag.
        expect(outcome).toEqual({ createdNew: true })
    })

    test('sends the stored id on every subsequent registration', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'DEV-1')

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.registerDevice(accounts)
        })

        expect(mockedRegisterDeviceMutation).toHaveBeenCalledWith({
            data: expect.objectContaining({ id: 'DEV-1' }),
        })
    })

    test('sends an empty push token rather than omitting the field', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()
        await seedPushToken(null)

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.registerDevice(accounts)
        })

        expect(mockedRegisterDeviceMutation).toHaveBeenCalledWith({
            data: expect.objectContaining({ pushToken: '' }),
        })
    })

    test('rejects when the create response carries no id', async () => {
        vi.resetModules()
        mockedRegisterDeviceMutation.mockResolvedValue({})

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        // Rejecting (instead of storing a null id) keeps the registration on
        // the pending/retry path rather than reporting a healed device.
        await expect(result.current.registerDevice(accounts)).rejects.toThrow(
            'Device create response carried no id',
        )
        expect(
            useDeviceStore.getState().deviceIDs.get('mainnet') ?? null,
        ).toBeNull()
    })

    test('re-registers without an id when the stored id 404s', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'STALE')

        mockedRegisterDeviceMutation
            .mockRejectedValueOnce(
                new PeraNetworkError('client', { status: 404 }),
            )
            .mockResolvedValueOnce({ id: 'FRESH' })

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        let outcome: { createdNew: boolean } | undefined
        await act(async () => {
            outcome = await result.current.registerDevice(accounts)
        })

        expect(outcome).toEqual({ createdNew: true })
        expect(mockedRegisterDeviceMutation).toHaveBeenLastCalledWith({
            data: expect.not.objectContaining({ id: expect.anything() }),
        })
        expect(useDeviceStore.getState().deviceIDs.get('mainnet')).toBe('FRESH')
    })

    test('retries once with the same id when the push token was claimed in a race', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'DEV-1')
        await seedPushToken('test-fcm-token')

        mockedRegisterDeviceMutation
            .mockRejectedValueOnce(
                new PeraNetworkError('client', { status: 400 }),
            )
            .mockResolvedValueOnce({ id: 'DEV-1' })

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        let outcome: { createdNew: boolean } | undefined
        await act(async () => {
            outcome = await result.current.registerDevice(accounts)
        })

        const expectedPayload = {
            data: {
                accounts,
                platform: 'ios',
                pushToken: 'test-fcm-token',
                locale: 'en-US',
                appVersion: '7.0.1',
                id: 'DEV-1',
            },
        }

        expect(outcome).toEqual({ createdNew: false })
        // Exactly two calls — not a third, and not a re-create (which would
        // have sent a payload without `id`). Both calls carry the identical
        // payload, proving the retry replays the same write rather than
        // building a fresh one.
        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(2)
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(
            1,
            expectedPayload,
        )
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(
            2,
            expectedPayload,
        )
    })

    test('surfaces a 422 without retrying and without re-creating', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'DEV-1')

        mockedRegisterDeviceMutation.mockRejectedValueOnce(
            new PeraNetworkError('client', { status: 422 }),
        )

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await expect(
            act(async () => {
                await result.current.registerDevice(accounts)
            }),
        ).rejects.toThrow()
        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(1)
    })

    test('does not retry at the application layer (delegated to ky)', async () => {
        vi.resetModules()

        mockedRegisterDeviceMutation.mockRejectedValue(
            Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
        )

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await expect(
            act(async () => {
                await result.current.registerDevice(accounts)
            }),
        ).rejects.toThrow('timeout')

        // Single attempt at this layer — transient retries belong to ky in
        // the shared query-client. Layering retries here would compound to 6
        // requests (3 outer x 2 inner) per call.
        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(1)
    })

    test('serializes concurrent id-less registrations across separate hook instances into one create plus a follow-up carrying the second call’s accounts', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()

        const accountsB: DeviceAccountRegistration[] = [
            {
                address: 'ADDR_B',
                accountType: DeviceAccountTypes.watch,
                receiveNotifications: false,
            },
        ]

        let resolveCreate: (value: { id: string }) => void = () => {}
        const createResponse = new Promise<{ id: string }>(resolve => {
            resolveCreate = resolve
        })

        mockedRegisterDeviceMutation
            .mockImplementationOnce(() => createResponse) // the shared create
            .mockResolvedValueOnce({ id: 'SHARED-ID' }) // instance B's follow-up update

        // Two DISTINCT mounted hook instances — e.g. the mount-time
        // registration and Task 12's notification toggle, each its own
        // component. The lock has to be shared across these, not just
        // within one, or this is exactly the race the fix was for.
        const { result: instanceA } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })
        const { result: instanceB } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        // Instance A fires the create and is left hanging.
        let firstOutcome: { createdNew: boolean } | undefined
        let firstAttempt: Promise<{ createdNew: boolean }> = Promise.resolve({
            createdNew: false,
        })
        act(() => {
            firstAttempt = instanceA.current.registerDevice(accounts)
        })

        // Instance B arrives before instance A's create resolves.
        let secondOutcome: { createdNew: boolean } | undefined
        let secondAttempt: Promise<{ createdNew: boolean }> = Promise.resolve({
            createdNew: false,
        })
        act(() => {
            secondAttempt = instanceB.current.registerDevice(accountsB)
        })

        // Only one POST has gone out so far — instance B is awaiting
        // instance A's in-flight create rather than issuing its own, even
        // though they are two completely separate mounted hook instances.
        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveCreate({ id: 'SHARED-ID' })
            firstOutcome = await firstAttempt
            secondOutcome = await secondAttempt
        })

        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(2)
        // Exactly one id-less create...
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(1, {
            data: expect.not.objectContaining({ id: expect.anything() }),
        })
        // ...and instance B's own accounts still reach the backend, via a
        // follow-up carrying the id instance A's create minted.
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(2, {
            data: expect.objectContaining({
                id: 'SHARED-ID',
                accounts: accountsB,
            }),
        })
        expect(firstOutcome).toEqual({ createdNew: true })
        expect(secondOutcome).toEqual({ createdNew: false })
        expect(useDeviceStore.getState().deviceIDs.get('mainnet')).toBe(
            'SHARED-ID',
        )
    })

    // PERA-4705 (Task 12 review, Finding 1): the id-less create lock above
    // only ever protects the *first* registration for a network. Once an id
    // exists — the steady state for every real toggle — `registerDevice`
    // goes straight to `registerWithId`, which had no serialization at all.
    // Two independent callers both hold the id already (e.g. the
    // account/network-driven registrar and a notification-preference
    // toggle, each its own `useDevice()` instance): without a lock spanning
    // the *whole* registration, not just the id-less path, their writes can
    // land in either order, and a later corrective call (a toggle's
    // rollback) can lose to an earlier, stale one still in flight.
    test('serializes registrations for an already-registered device, not just id-less creates', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'DEV-1')

        const accountsA: DeviceAccountRegistration[] = [
            {
                address: 'ADDR_A',
                accountType: DeviceAccountTypes.algo25,
                receiveNotifications: false,
            },
        ]
        const accountsB: DeviceAccountRegistration[] = [
            {
                address: 'ADDR_A',
                accountType: DeviceAccountTypes.algo25,
                receiveNotifications: true,
            },
        ]

        let resolveFirst: (value: { id: string }) => void = () => {}
        const firstResponse = new Promise<{ id: string }>(resolve => {
            resolveFirst = resolve
        })

        mockedRegisterDeviceMutation
            .mockImplementationOnce(() => firstResponse) // instance A, hangs
            .mockResolvedValueOnce({ id: 'DEV-1' }) // instance B's follow-up

        // Two DISTINCT mounted instances, both already holding the id — the
        // steady state the id-less lock never covers.
        const { result: instanceA } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })
        const { result: instanceB } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        let firstOutcome: { createdNew: boolean } | undefined
        let firstAttempt: Promise<{ createdNew: boolean }> = Promise.resolve({
            createdNew: false,
        })
        act(() => {
            firstAttempt = instanceA.current.registerDevice(accountsA)
        })

        let secondOutcome: { createdNew: boolean } | undefined
        let secondAttempt: Promise<{ createdNew: boolean }> = Promise.resolve({
            createdNew: false,
        })
        act(() => {
            secondAttempt = instanceB.current.registerDevice(accountsB)
        })

        // The second, contradictory write must not fire while the first is
        // still in flight — without the fix this assertion fails (both
        // fire immediately, 2 calls here).
        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveFirst({ id: 'DEV-1' })
            firstOutcome = await firstAttempt
            secondOutcome = await secondAttempt
        })

        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(2)
        // Strict arrival order: B's payload — the later, "corrective" one in
        // the scenario this guards — is always the last write the server
        // sees.
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(1, {
            data: expect.objectContaining({
                accounts: accountsA,
                id: 'DEV-1',
            }),
        })
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(2, {
            data: expect.objectContaining({
                accounts: accountsB,
                id: 'DEV-1',
            }),
        })
        expect(firstOutcome).toEqual({ createdNew: false })
        expect(secondOutcome).toEqual({ createdNew: false })
    })

    test('a failed id-less create releases the shared lock for every hook instance', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()

        mockedRegisterDeviceMutation
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({ id: 'RECOVERED' })

        // Two DISTINCT instances: the failure happens on instance A, the
        // retry comes from instance B — proving the lock release is not
        // scoped to the instance that failed.
        const { result: instanceA } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })
        const { result: instanceB } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await expect(
            act(async () => {
                await instanceA.current.registerDevice(accounts)
            }),
        ).rejects.toThrow('boom')

        // If the lock weren't released on failure, instance B would hang
        // forever awaiting a create that already rejected on instance A.
        let outcome: { createdNew: boolean } | undefined
        await act(async () => {
            outcome = await instanceB.current.registerDevice(accounts)
        })

        expect(outcome).toEqual({ createdNew: true })
        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(2)
        expect(useDeviceStore.getState().deviceIDs.get('mainnet')).toBe(
            'RECOVERED',
        )
    })

    test('concurrent id-less creates for different networks do not interfere with each other', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()
        const { useNetwork } =
            await import('@perawallet/wallet-core-blockchain')

        useDeviceStore.getState().resetState()
        vi.mocked(useNetwork).mockReturnValue({
            network: 'mainnet',
            setNetwork: vi.fn(),
        } as never)

        let resolveMainnet: (value: { id: string }) => void = () => {}
        const mainnetCreate = new Promise<{ id: string }>(resolve => {
            resolveMainnet = resolve
        })

        mockedRegisterDeviceMutation
            .mockImplementationOnce(() => mainnetCreate) // mainnet's create
            .mockImplementationOnce(() => Promise.resolve({ id: 'TESTNET-ID' })) // testnet's create

        const { result, rerender } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        // Fire a slow mainnet create but don't await it yet.
        let mainnetAttempt: Promise<{ createdNew: boolean }> = Promise.resolve({
            createdNew: false,
        })
        act(() => {
            mainnetAttempt = result.current.registerDevice(accounts)
        })

        // The network switches to testnet — a different dedup-lock key, so
        // this fires its own independent (fast) create rather than joining
        // mainnet's.
        vi.mocked(useNetwork).mockReturnValue({
            network: 'testnet',
            setNetwork: vi.fn(),
        } as never)
        rerender()

        await act(async () => {
            await result.current.registerDevice(accounts)
        })

        expect(useDeviceStore.getState().deviceIDs.get('testnet')).toBe(
            'TESTNET-ID',
        )
        // Mainnet's create hasn't resolved yet — still pending, not
        // discarded.
        expect(
            useDeviceStore.getState().deviceIDs.get('mainnet') ?? null,
        ).toBeNull()

        // Once it resolves, mainnet's id is persisted too. A late write for
        // a DIFFERENT network is never discarded: store writes are keyed by
        // network, and only one create can ever be in flight per network,
        // so there is no fresher write for this same slot to lose to.
        await act(async () => {
            resolveMainnet({ id: 'MAINNET-ID' })
            await mainnetAttempt
        })

        expect(useDeviceStore.getState().deviceIDs.get('mainnet')).toBe(
            'MAINNET-ID',
        )
    })

    test('reads the device id from the store at call time, not a stale captured closure', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()

        mockedRegisterDeviceMutation
            .mockResolvedValueOnce({ id: 'FRESH-ID' }) // the create
            .mockResolvedValueOnce({ id: 'FRESH-ID' }) // the follow-up update

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        // Capture this render's `registerDevice` once, before any store
        // write — simulating a caller that grabbed the function and calls
        // it again without an intervening re-render landing first (the
        // scenario the fix targets: the lock can release, and the id can
        // land in the store, between two calls issued off one closure).
        const registerDevice = result.current.registerDevice

        await act(async () => {
            await registerDevice(accounts)
        })

        let secondOutcome: { createdNew: boolean } | undefined
        await act(async () => {
            secondOutcome = await registerDevice(accounts)
        })

        // A closure-scoped `deviceId` frozen at null (this render's original
        // value) would send this second call down the id-less branch again,
        // minting a second device row. Reading the store fresh instead means
        // it correctly finds the id the first call just persisted.
        expect(secondOutcome).toEqual({ createdNew: false })
        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(2)
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(2, {
            data: expect.objectContaining({ id: 'FRESH-ID' }),
        })
    })

    test('clears the previous network push token via a register carrying that id', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()
        await seedDeviceId('testnet', 'OLD-DEV')

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.clearDevicePushToken('testnet')
        })

        // Routed via the raw endpoint with the *target* network, not the
        // mutation hook (which captures the current network). `accounts` is
        // sent empty so the new network's address list can't accidentally
        // overwrite the old device record.
        expect(mockedRegisterDeviceEndpoint).toHaveBeenCalledWith('testnet', {
            id: 'OLD-DEV',
            pushToken: '',
            platform: 'ios',
            locale: 'en-US',
            appVersion: '7.0.1',
            accounts: [],
        })
    })

    test('clearDevicePushToken is a no-op when target network has no device ID', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.clearDevicePushToken('testnet')
        })

        expect(mockedRegisterDeviceEndpoint).not.toHaveBeenCalled()
    })

    test('clearDevicePushToken swallows endpoint failures (best-effort)', async () => {
        vi.resetModules()
        mockedRegisterDeviceEndpoint.mockRejectedValueOnce(
            new PeraNetworkError('client', { status: 404 }),
        )

        const { useDeviceStore } = await import('../../store')
        const {
            useDevice,
            clearPendingDeviceCreatesForTests,
            clearRegistrationQueuesForTests,
        } = await import('../useDevice')
        // The dedup lock is module scope (shared across every `useDevice()`
        // consumer, not just this test's instance) — clear it so a leaked
        // in-flight entry from an earlier test can't wedge this one.
        clearPendingDeviceCreatesForTests()
        clearRegistrationQueuesForTests()

        useDeviceStore.getState().resetState()
        await seedDeviceId('testnet', 'stale-id')

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await expect(
            act(async () => {
                await result.current.clearDevicePushToken('testnet')
            }),
        ).resolves.not.toThrow()
    })
})
