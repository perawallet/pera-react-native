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
        const { useDevice } = await import('../useDevice')

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
        const { useDevice } = await import('../useDevice')

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
        const { useDevice } = await import('../useDevice')

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
        const { useDevice } = await import('../useDevice')

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
        const { useDevice } = await import('../useDevice')

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
        const { useDevice } = await import('../useDevice')

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
        const { useDevice } = await import('../useDevice')

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
        const { useDevice } = await import('../useDevice')

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

    test('serializes concurrent id-less registrations into one create plus a follow-up carrying the second call’s accounts', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

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
            .mockResolvedValueOnce({ id: 'SHARED-ID' }) // call 2's follow-up update

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        // Call 1 fires the create and is left hanging.
        let firstOutcome: { createdNew: boolean } | undefined
        let firstAttempt: Promise<{ createdNew: boolean }> = Promise.resolve({
            createdNew: false,
        })
        act(() => {
            firstAttempt = result.current.registerDevice(accounts)
        })

        // Call 2 arrives before call 1's create resolves.
        let secondOutcome: { createdNew: boolean } | undefined
        let secondAttempt: Promise<{ createdNew: boolean }> = Promise.resolve({
            createdNew: false,
        })
        act(() => {
            secondAttempt = result.current.registerDevice(accountsB)
        })

        // Only one POST has gone out so far — call 2 is awaiting call 1's
        // in-flight create rather than issuing its own.
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
        // ...and call 2's own accounts still reach the backend, via a
        // follow-up carrying the id call 1's create minted.
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

    test('a failed id-less create releases the lock for a subsequent registration', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

        useDeviceStore.getState().resetState()

        mockedRegisterDeviceMutation
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({ id: 'RECOVERED' })

        const { result } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        await expect(
            act(async () => {
                await result.current.registerDevice(accounts)
            }),
        ).rejects.toThrow('boom')

        // If the lock weren't released on failure, this second call would
        // hang forever awaiting a create that already rejected.
        let outcome: { createdNew: boolean } | undefined
        await act(async () => {
            outcome = await result.current.registerDevice(accounts)
        })

        expect(outcome).toEqual({ createdNew: true })
        expect(mockedRegisterDeviceMutation).toHaveBeenCalledTimes(2)
        expect(useDeviceStore.getState().deviceIDs.get('mainnet')).toBe(
            'RECOVERED',
        )
    })

    test('does not persist a stale device id when a newer registration attempt supersedes it', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')
        const { useNetwork } =
            await import('@perawallet/wallet-core-blockchain')

        useDeviceStore.getState().resetState()
        vi.mocked(useNetwork).mockReturnValue({
            network: 'mainnet',
            setNetwork: vi.fn(),
        } as never)

        let resolveFirst: (value: { id: string }) => void = () => {}
        const firstCall = new Promise<{ id: string }>(resolve => {
            resolveFirst = resolve
        })

        mockedRegisterDeviceMutation
            .mockImplementationOnce(() => firstCall) // mainnet's create
            .mockImplementationOnce(() => Promise.resolve({ id: 'TESTNET-ID' })) // testnet's create

        const { result, rerender } = renderHook(() => useDevice(), {
            wrapper: createWrapper(),
        })

        // Fire a slow mainnet create but don't await it yet.
        let firstAttempt: Promise<{ createdNew: boolean }> = Promise.resolve({
            createdNew: false,
        })
        act(() => {
            firstAttempt = result.current.registerDevice(accounts)
        })

        // The network switches to testnet — a different pending-create key,
        // so this fires its own independent (fast) create rather than
        // joining mainnet's.
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

        // Now let the stale mainnet attempt resolve. A newer create (testnet)
        // has since bumped the in-flight ref, so this must not write back.
        await act(async () => {
            resolveFirst({ id: 'STALE-MAINNET-ID' })
            await firstAttempt
        })

        expect(
            useDeviceStore.getState().deviceIDs.get('mainnet') ?? null,
        ).toBeNull()
    })

    test('clears the previous network push token via a register carrying that id', async () => {
        vi.resetModules()

        const { useDeviceStore } = await import('../../store')
        const { useDevice } = await import('../useDevice')

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
        const { useDevice } = await import('../useDevice')

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
        const { useDevice } = await import('../useDevice')

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
