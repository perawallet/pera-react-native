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

// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const registerStoreMock = vi.fn()

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        defaultNetwork: 'mainnet',
    },
    peraDeploymentOf: (scope: { networkId: string }) =>
        ({ mainnet: 'live', testnet: 'developer' })[scope.networkId],
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: registerStoreMock,
        createPersistStorage: createMockPersistStorage,
    }
})

describe('device/store', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    test('initial state is empty', async () => {
        const { useDeviceStore } = await import('../index')
        const { result } = renderHook(() => useDeviceStore())

        expect(result.current.deviceIDs).toBeInstanceOf(Map)
        expect(result.current.deviceIDs.size).toBe(0)
        expect(result.current.pushToken).toBeNull()
    })

    test('setRegistrationPending tracks pending registrations per deployment', async () => {
        const { useDeviceStore } = await import('../index')
        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setRegistrationPending('live', true)
            result.current.setRegistrationPending('developer', true)
        })
        expect(result.current.pendingRegistrationDeployments).toEqual([
            'live',
            'developer',
        ])

        act(() => {
            result.current.setRegistrationPending('live', true)
        })
        expect(result.current.pendingRegistrationDeployments).toEqual([
            'live',
            'developer',
        ])

        act(() => {
            result.current.setRegistrationPending('live', false)
        })
        expect(result.current.pendingRegistrationDeployments).toEqual([
            'developer',
        ])
    })

    test('setPushToken stores the token', async () => {
        const { useDeviceStore } = await import('../index')
        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setPushToken('test-token-123')
        })

        expect(result.current.pushToken).toBe('test-token-123')
    })

    test('setDeviceID overwrites existing and keeps other networks intact', async () => {
        const { useDeviceStore, deviceIdForDeployment } =
            await import('../index')
        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setDeviceID('live', 'live-1')
            result.current.setDeviceID('developer', 'developer-1')
            result.current.setDeviceID('live', 'live-2')
        })

        expect(deviceIdForDeployment(result.current, 'live')).toBe('live-2')
        expect(deviceIdForDeployment(result.current, 'developer')).toBe(
            'developer-1',
        )
    })

    test('a developer id is read back by deployment and persists under algorand/testnet', async () => {
        const { useDeviceStore, deviceIdForDeployment } =
            await import('../index')
        act(() => {
            useDeviceStore.getState().setDeviceID('developer', 'id-1')
        })

        const state = useDeviceStore.getState()
        expect(deviceIdForDeployment(state, 'developer')).toBe('id-1')
        const { partialize } = useDeviceStore.persist.getOptions()
        expect(partialize?.(state)).toMatchObject({
            deviceIDs: { 'algorand/testnet': 'id-1' },
        })
    })

    test('an id stored under algorand/mainnet reads as the live deployment', async () => {
        const { useDeviceStore, deviceIdForDeployment } =
            await import('../index')
        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        getProvider().keyValueStorage.setItem(
            'device-store',
            JSON.stringify({
                state: { deviceIDs: { 'algorand/mainnet': 'stored-id' } },
                version: 2,
            }),
        )

        await useDeviceStore.persist.rehydrate()

        expect(deviceIdForDeployment(useDeviceStore.getState(), 'live')).toBe(
            'stored-id',
        )
    })

    test('setDeviceID produces a new Map reference (immutability)', async () => {
        const { useDeviceStore } = await import('../index')
        const { result } = renderHook(() => useDeviceStore())

        const original = result.current.deviceIDs
        act(() => {
            result.current.setDeviceID('live', 'id')
        })

        expect(result.current.deviceIDs).not.toBe(original)
    })

    test('setDeviceIdOrigin tracks origins per deployment', async () => {
        const { useDeviceStore } = await import('../index')
        const { result } = renderHook(() => useDeviceStore())

        expect(result.current.deviceIdOrigins).toEqual({})

        act(() => {
            result.current.setDeviceIdOrigin('live', 'migrated')
            result.current.setDeviceIdOrigin('developer', 'migrated')
            result.current.setDeviceIdOrigin('live', 'recreated')
        })

        expect(result.current.deviceIdOrigins).toEqual({
            'algorand/mainnet': 'recreated',
            'algorand/testnet': 'migrated',
        })
    })

    test('persists deviceIdOrigins', async () => {
        const { useDeviceStore } = await import('../index')
        act(() => {
            useDeviceStore.getState().setDeviceIdOrigin('live', 'migrated')
        })

        const { partialize } = useDeviceStore.persist.getOptions()
        const persisted = partialize?.(useDeviceStore.getState())

        expect(persisted).toMatchObject({
            deviceIdOrigins: { 'algorand/mainnet': 'migrated' },
        })
    })

    test('resetState clears deviceIdOrigins', async () => {
        const { useDeviceStore } = await import('../index')
        act(() => {
            useDeviceStore.getState().setDeviceIdOrigin('live', 'migrated')
        })

        act(() => useDeviceStore.getState().resetState())

        expect(useDeviceStore.getState().deviceIdOrigins).toEqual({})
    })

    test('does not persist pendingRegistrationDeployments', async () => {
        const { useDeviceStore } = await import('../index')
        act(() => {
            useDeviceStore.getState().setRegistrationPending('live', true)
        })

        const { partialize } = useDeviceStore.persist.getOptions()
        const persisted = partialize?.(useDeviceStore.getState())

        expect(persisted).not.toHaveProperty('pendingRegistrationDeployments')
    })

    test('resetState clears pendingRegistrationDeployments', async () => {
        const { useDeviceStore } = await import('../index')
        act(() => {
            useDeviceStore.getState().setRegistrationPending('live', true)
        })

        act(() => useDeviceStore.getState().resetState())

        expect(
            useDeviceStore.getState().pendingRegistrationDeployments,
        ).toEqual([])
    })

    test('registers a resetState and clearStorage callback with the store registry', async () => {
        await import('../index')
        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('device-store')

        const { useDeviceStore } = await import('../index')
        act(() => {
            useDeviceStore.getState().setDeviceID('live', 'id')
            useDeviceStore.getState().setPushToken('tok')
        })

        act(() => registration.resetState())
        expect(useDeviceStore.getState().deviceIDs.size).toBe(0)
        expect(useDeviceStore.getState().pushToken).toBeNull()

        expect(() => registration.clearStorage()).not.toThrow()
    })

    test('hydrates a v1 mainnet device id under the Algorand mainnet key', async () => {
        const { getProvider } =
            await import('@perawallet/wallet-extension-provider')
        const { useDeviceStore, deviceIdForDeployment } =
            await import('../index')
        getProvider().keyValueStorage.setItem(
            'device-store',
            JSON.stringify({
                state: {
                    deviceIDs: { mainnet: 'device-main', testnet: null },
                    pushToken: 'tok',
                    deviceIdOrigins: { mainnet: 'migrated' },
                },
                version: 1,
            }),
        )

        await useDeviceStore.persist.rehydrate()

        const state = useDeviceStore.getState()
        expect(state.deviceIDs).toEqual(
            new Map([
                ['algorand/mainnet', 'device-main'],
                ['algorand/testnet', null],
            ]),
        )
        expect(deviceIdForDeployment(state, 'live')).toBe('device-main')
        expect(state.deviceIdOrigins).toEqual({
            'algorand/mainnet': 'migrated',
        })
        expect(state.pushToken).toBe('tok')
        const rewritten = JSON.parse(
            getProvider().keyValueStorage.getItem('device-store') as string,
        )
        expect(rewritten.version).toBe(2)
        expect(rewritten.state.deviceIDs).toEqual({
            'algorand/mainnet': 'device-main',
            'algorand/testnet': null,
        })
    })
})

describe('device/store - migrateDeviceState', () => {
    test('re-keys v1 ids and origins by scope key, values unchanged', async () => {
        const { migrateDeviceState } = await import('../store')

        const migrated = migrateDeviceState(
            {
                deviceIDs: { mainnet: 'device-main', testnet: 'device-test' },
                pushToken: 'tok',
                deviceIdOrigins: { mainnet: 'migrated', testnet: 'recreated' },
            },
            1,
        )

        expect(migrated).toEqual({
            deviceIDs: {
                'algorand/mainnet': 'device-main',
                'algorand/testnet': 'device-test',
            },
            pushToken: 'tok',
            deviceIdOrigins: {
                'algorand/mainnet': 'migrated',
                'algorand/testnet': 'recreated',
            },
        })
    })

    test('migrates a v1 state persisted before origins were tracked', async () => {
        const { migrateDeviceState } = await import('../store')

        const migrated = migrateDeviceState(
            { deviceIDs: { mainnet: 'device-main' }, pushToken: null },
            1,
        )

        expect(migrated.deviceIDs).toEqual({
            'algorand/mainnet': 'device-main',
        })
        expect(migrated.deviceIdOrigins).toEqual({})
    })

    test('leaves v2 state untouched', async () => {
        const { migrateDeviceState } = await import('../store')
        const state = {
            deviceIDs: { 'algorand/mainnet': 'device-main' },
            pushToken: null,
            deviceIdOrigins: {},
        }

        expect(migrateDeviceState(state, 2)).toEqual(state)
    })
})
