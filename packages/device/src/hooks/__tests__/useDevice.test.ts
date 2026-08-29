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

//'s orphaning telemetry: replacing a migrated device id loses its
// device-keyed server state, and the only signal is this event.
const mockLogEvent = vi.fn()

vi.mock('@perawallet/wallet-core-analytics', () => ({
    logEvent: (...args: unknown[]) => mockLogEvent(...args),
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

/**
 * Per-test setup shared by everything that registers.
 *
 * 1. The registration queue is module scope — shared across every
 * `useDevice()` consumer, not just the instance a test mounts — so a
 * leaked, never-settled entry from an earlier test would wedge every later
 * registration on the same network.
 * 2. The mocked `useNetwork` is a module-scope `vi.fn()`. `vi.clearAllMocks()`
 * clears its recorded calls but keeps its return value, and
 * `vi.resetModules()` does not re-run the `vi.mock` factory — so a test
 * that switches to testnet leaks testnet into every test after it. Pin it
 * back to mainnet here; the two tests that need a switch set it themselves
 * afterwards.
 */
const importUseDevice = async () => {
    const { useNetwork } = await import('@perawallet/wallet-core-blockchain')
    vi.mocked(useNetwork).mockReturnValue({
        network: 'mainnet',
        setNetwork: vi.fn(),
    } as never)

    const { useDevice, clearRegistrationQueuesForTests } =
        await import('../useDevice')
    clearRegistrationQueuesForTests()
    return useDevice
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
        const useDevice = await importUseDevice()

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
            network: 'mainnet',
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
        const useDevice = await importUseDevice()

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'DEV-1')

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.registerDevice(accounts)
        })

        expect(mockedRegisterDeviceMutation).toHaveBeenCalledWith({
            network: 'mainnet',
            data: expect.objectContaining({ id: 'DEV-1' }),
        })
    })

    test('sends an empty push token rather than omitting the field', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

        useDeviceStore.getState().resetState()
        await seedPushToken(null)

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.registerDevice(accounts)
        })

        expect(mockedRegisterDeviceMutation).toHaveBeenCalledWith({
            network: 'mainnet',
            data: expect.objectContaining({ pushToken: '' }),
        })
    })

    test('rejects when the create response carries no id', async () => {
        vi.resetModules()
        mockedRegisterDeviceMutation.mockResolvedValue({})

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

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
        const useDevice = await importUseDevice()

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
            network: 'mainnet',
            data: expect.not.objectContaining({ id: expect.anything() }),
        })
        expect(useDeviceStore.getState().deviceIDs.get('mainnet')).toBe('FRESH')
    })

    // Carried onto the v3 flow: only the 404 recreate can replace
    // an id under v3 — a 400 is a push-token race that retries with the same
    // id (see `isPushTokenClaimedError`), so `device_already_exists` is no
    // longer a replacement reason and the two tests asserting it were dropped.
    test('emits the replacement event and flips the origin when the 404 recreate replaces a migrated id', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'MIGRATED-1')
        useDeviceStore.getState().setDeviceIdOrigin('mainnet', 'migrated')

        mockedRegisterDeviceMutation
            .mockRejectedValueOnce(
                new PeraNetworkError('client', { status: 404 }),
            )
            .mockResolvedValueOnce({ id: 'FRESH-1' })

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.registerDevice(accounts)
        })

        expect(useDeviceStore.getState().deviceIDs.get('mainnet')).toBe(
            'FRESH-1',
        )
        expect(useDeviceStore.getState().deviceIdOrigins.mainnet).toBe(
            'recreated',
        )
        expect(mockLogEvent).toHaveBeenCalledExactlyOnceWith(
            'migrated_device_id_replaced',
            { network: 'mainnet', reason: 'not_found' },
        )
    })

    test('emits no replacement event when the recreated id did not come from migration', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'stale-id')

        mockedRegisterDeviceMutation
            .mockRejectedValueOnce(
                new PeraNetworkError('client', { status: 404 }),
            )
            .mockResolvedValueOnce({ id: 'FRESH-3' })

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.registerDevice(accounts)
        })

        expect(useDeviceStore.getState().deviceIDs.get('mainnet')).toBe(
            'FRESH-3',
        )
        expect(mockLogEvent).not.toHaveBeenCalled()
        expect(
            useDeviceStore.getState().deviceIdOrigins.mainnet,
        ).toBeUndefined()
    })

    test('a successful registration preserves the migrated id and its origin without emitting', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'MIGRATED-1')
        useDeviceStore.getState().setDeviceIdOrigin('mainnet', 'migrated')

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        let outcome: { createdNew: boolean } | undefined
        await act(async () => {
            outcome = await result.current.registerDevice(accounts)
        })

        expect(outcome).toEqual({ createdNew: false })
        expect(useDeviceStore.getState().deviceIDs.get('mainnet')).toBe(
            'MIGRATED-1',
        )
        expect(useDeviceStore.getState().deviceIdOrigins.mainnet).toBe(
            'migrated',
        )
        expect(mockLogEvent).not.toHaveBeenCalled()
    })

    // A 400 retries with the SAME id, so a migrated id survives it untouched
    // and nothing is orphaned — the inverse of the 404 case above.
    test('a push-token race does not replace or re-flag a migrated id', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'MIGRATED-1')
        useDeviceStore.getState().setDeviceIdOrigin('mainnet', 'migrated')

        mockedRegisterDeviceMutation
            .mockRejectedValueOnce(
                new PeraNetworkError('client', { status: 400 }),
            )
            .mockResolvedValueOnce({ id: 'MIGRATED-1' })

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await result.current.registerDevice(accounts)
        })

        expect(useDeviceStore.getState().deviceIDs.get('mainnet')).toBe(
            'MIGRATED-1',
        )
        expect(useDeviceStore.getState().deviceIdOrigins.mainnet).toBe(
            'migrated',
        )
        expect(mockLogEvent).not.toHaveBeenCalled()
    })

    test('retries once with the same id when the push token was claimed in a race', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

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
            network: 'mainnet',
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

    // (final review, Finding 5): the Global Constraint reads
    // "400 → retry once", unqualified, but the retry lived only on the
    // id-carrying update path. The id-less create path is the one every
    // upgrading user traverses — a v1-issued id v3 doesn't recognise 404s,
    // the re-create then collides with the old device row still holding this
    // FCM token and comes back 400. Without the retry there is no self-heal:
    // every reconnect and foreground repeats the same create and the same
    // 400, forever.
    test('retries once when the id-less re-create after a 404 hits a claimed push token', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'V1-ISSUED')
        await seedPushToken('test-fcm-token')

        mockedRegisterDeviceMutation
            // the v1-issued id is unknown to v3
            .mockRejectedValueOnce(
                new PeraNetworkError('client', { status: 404 }),
            )
            // the id-less re-create races the old row's push-token claim
            .mockRejectedValueOnce(
                new PeraNetworkError('client', { status: 400 }),
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
        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(3)
        // The retry replays the same id-less create — not a fresh payload,
        // and emphatically not the stale id again.
        const idLessCreate = {
            network: 'mainnet',
            data: {
                accounts,
                platform: 'ios',
                pushToken: 'test-fcm-token',
                locale: 'en-US',
                appVersion: '7.0.1',
            },
        }
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(
            2,
            idLessCreate,
        )
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(
            3,
            idLessCreate,
        )
        // The device healed: the id from the retry is persisted, so the next
        // registration takes the update path instead of creating again.
        expect(useDeviceStore.getState().deviceIDs.get('mainnet')).toBe('FRESH')
    })

    test('surfaces a 422 without retrying and without re-creating', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

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

    test('does not retry timeouts or network errors at the application layer', async () => {
        vi.resetModules()

        mockedRegisterDeviceMutation.mockRejectedValue(
            Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
        )

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

        useDeviceStore.getState().resetState()

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await expect(
            act(async () => {
                await result.current.registerDevice(accounts)
            }),
        ).rejects.toThrow('timeout')

        // One attempt, full stop. Note this is *not* "ky will retry it for
        // us": ky's shared pera client leaves `retry.methods` at its default,
        // which excludes `post`, and v3's only write verb is POST — so a
        // transient failure here gets no transport retry either. Recovery is
        // `useDeviceRegistration`'s reconnect/foreground re-fire. Adding
        // `'post'` to `peraRetryConfig` is not the fix: that config is shared
        // by every pera-backend POST, swap submission included.
        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(1)
    })

    // (final review, Finding 1): `registerDevice` captures the
    // network at *enqueue* time, but the write used to resolve its URL from
    // the mutation's own `useNetwork()` at *execution* time. Queued behind an
    // in-flight request, a mainnet registration could therefore run after the
    // user switched to testnet, POST mainnet's device id to the testnet
    // backend (unknown id → 404 → re-create) and write the resulting testnet
    // id back into mainnet's store slot.
    test('targets the network captured when the call was enqueued, not the one current when it runs', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()
        const { useNetwork } =
            await import('@perawallet/wallet-core-blockchain')

        vi.mocked(useNetwork).mockReturnValue({
            network: 'mainnet',
            setNetwork: vi.fn(),
        } as never)

        useDeviceStore.getState().resetState()
        await seedDeviceId('mainnet', 'MAINNET-DEV')

        let resolveFirst: (value: { id: string }) => void = () => {}
        const firstResponse = new Promise<{ id: string }>(resolve => {
            resolveFirst = resolve
        })

        mockedRegisterDeviceMutation
            .mockImplementationOnce(() => firstResponse) // hangs, holding the queue
            .mockResolvedValueOnce({ id: 'MAINNET-DEV' })

        const { result, rerender } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        // Both calls are made while the app is on mainnet; the second queues
        // behind the first.
        let firstAttempt: Promise<{ createdNew: boolean }> = Promise.resolve({
            createdNew: false,
        })
        let secondAttempt: Promise<{ createdNew: boolean }> = Promise.resolve({
            createdNew: false,
        })
        act(() => {
            firstAttempt = result.current.registerDevice(accounts)
            secondAttempt = result.current.registerDevice(accounts)
        })

        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(1)

        // The user switches networks while the second call is still queued.
        vi.mocked(useNetwork).mockReturnValue({
            network: 'testnet',
            setNetwork: vi.fn(),
        } as never)
        rerender()

        await act(async () => {
            resolveFirst({ id: 'MAINNET-DEV' })
            await firstAttempt
            await secondAttempt
        })

        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(2)
        // The queued write still goes to mainnet, carrying mainnet's id.
        // Resolving the network at execution time would send this id to the
        // testnet backend instead.
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(2, {
            network: 'mainnet',
            data: expect.objectContaining({ id: 'MAINNET-DEV' }),
        })
        // ...and no id leaked into the other network's slot.
        expect(
            useDeviceStore.getState().deviceIDs.get('testnet') ?? null,
        ).toBeNull()
    })

    // The one-create-per-network guarantee comes from the registration queue
    // (`registrationQueues`/`enqueueRegistration`), not from any lock on the
    // create path: the second call is chained behind the first, so by the time
    // it runs the first has already persisted the id and it takes the update
    // branch.'s final review removed a separate `pendingDeviceCreates`
    // join lock that could never fire for exactly this reason — every caller
    // reaches the create path from inside a queue slot.
    test('queues a concurrent id-less registration from a separate hook instance behind the first, yielding one create plus a follow-up carrying the second call’s accounts', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

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
        // registration and the notification toggle, each its own
        // component. The queue has to be shared across these, not just
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

        // Only one POST has gone out so far — instance B is queued behind
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
            network: 'mainnet',
            data: expect.not.objectContaining({ id: expect.anything() }),
        })
        // ...and instance B's own accounts still reach the backend, via a
        // follow-up carrying the id instance A's create minted — because B's
        // queued task re-reads the store and finds it.
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(2, {
            network: 'mainnet',
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

    // The queue must span the *whole*
    // registration, not just the id-less create. Once an id exists — the
    // steady state for every real toggle — `registerDevice` goes straight to
    // the update path. Two independent callers both hold the id already (e.g.
    // the account/network-driven registrar and a notification-preference
    // toggle, each its own `useDevice()` instance): without serialization
    // their writes can land in either order, and a later corrective call (a
    // toggle's rollback) can lose to an earlier, stale one still in flight.
    test('serializes registrations for an already-registered device, not just id-less creates', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

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
        // steady state a create-only lock would never cover.
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
            network: 'mainnet',
            data: expect.objectContaining({
                accounts: accountsA,
                id: 'DEV-1',
            }),
        })
        expect(mockedRegisterDeviceMutation).toHaveBeenNthCalledWith(2, {
            network: 'mainnet',
            data: expect.objectContaining({
                accounts: accountsB,
                id: 'DEV-1',
            }),
        })
        expect(firstOutcome).toEqual({ createdNew: false })
        expect(secondOutcome).toEqual({ createdNew: false })
    })

    test('a failed id-less create does not wedge the queue for later hook instances', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

        useDeviceStore.getState().resetState()

        mockedRegisterDeviceMutation
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({ id: 'RECOVERED' })

        // Two DISTINCT instances: the failure happens on instance A, the
        // retry comes from instance B — proving the queue's always-resolving
        // tail is not scoped to the instance that failed.
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

        // If the queue tail propagated the rejection, instance B would hang
        // forever behind a promise that never settles.
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
        const useDevice = await importUseDevice()
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

        // The network switches to testnet — a different queue key, so this
        // fires its own independent (fast) create rather than waiting on
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
        const useDevice = await importUseDevice()

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
        // scenario the fix targets: the id can land in the store between
        // two calls issued off one closure).
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
            network: 'mainnet',
            data: expect.objectContaining({ id: 'FRESH-ID' }),
        })
    })

    test('clears the previous network push token via a register carrying that id', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const useDevice = await importUseDevice()

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
        const useDevice = await importUseDevice()

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
        const useDevice = await importUseDevice()

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
