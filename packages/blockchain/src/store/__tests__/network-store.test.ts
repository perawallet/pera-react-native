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

const registerStoreMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: registerStoreMock,
    }
})

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: { ...actual.config, defaultNetwork: 'mainnet' as const },
    }
})

describe('services/blockchain/network-store', () => {
    beforeEach(() => {
        vi.resetModules()
        registerStoreMock.mockClear()
    })

    test('initializes with config.defaultNetwork on first launch', async () => {
        const { useNetworkStore } = await import('../network-store')

        const { result } = renderHook(() => useNetworkStore())

        expect(result.current.network).toBe('mainnet')
    })

    test('setNetwork updates the network', async () => {
        const { useNetworkStore } = await import('../network-store')

        const { result } = renderHook(() => useNetworkStore())

        act(() => {
            result.current.setNetwork('testnet')
        })

        expect(result.current.network).toBe('testnet')
    })

    test('resetState restores the default network', async () => {
        const { useNetworkStore } = await import('../network-store')

        const { result } = renderHook(() => useNetworkStore())

        act(() => {
            result.current.setNetwork('testnet')
        })
        expect(result.current.network).toBe('testnet')

        act(() => {
            result.current.resetState()
        })
        expect(result.current.network).toBe('mainnet')
    })

    test('registers clearStorage and resetState with the store registry', async () => {
        const { useNetworkStore } = await import('../network-store')

        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('network-store')

        // resetState wired through the registration restores the default.
        act(() => {
            useNetworkStore.getState().setNetwork('testnet')
        })
        expect(useNetworkStore.getState().network).toBe('testnet')

        act(() => registration.resetState())
        expect(useNetworkStore.getState().network).toBe('mainnet')

        // clearStorage routes through persist.clearStorage — for "delete all
        // data" / sign-out flows. Just asserting it doesn't throw matches the
        // pattern in the currencies and settings stores; the underlying
        // persist storage is exercised by the resetState path above.
        expect(() => registration.clearStorage()).not.toThrow()
    })

    describe('mergePersistedNetwork', () => {
        test('a persisted network outside the union falls back to the default', async () => {
            // 'fnet' was a valid value before the union narrowed. A device that
            // selected it must not rehydrate an unknown string into
            // getNetworkConfig, which would return undefined and crash the
            // chain table lookup.
            const { mergePersistedNetwork } = await import('../network-store')

            const merged = mergePersistedNetwork({ network: 'fnet' })

            expect(merged.network).toBe('mainnet')
        })

        test('a persisted network inside the union is preserved', async () => {
            const { mergePersistedNetwork } = await import('../network-store')

            expect(mergePersistedNetwork({ network: 'betanet' }).network).toBe(
                'betanet',
            )
        })

        test.each([
            ['null', null],
            ['undefined', undefined],
            ['a non-string network', { network: 7 }],
            ['an empty object', {}],
        ])('%s falls back to the default', async (_label, persisted) => {
            const { mergePersistedNetwork } = await import('../network-store')

            expect(mergePersistedNetwork(persisted).network).toBe('mainnet')
        })

        test('rehydration keeps the store actions callable', async () => {
            // mergePersistedNetwork returns only { network }, so the persist
            // `merge` option must spread it over the current state. Returning it
            // directly would drop setNetwork and resetState from the rehydrated
            // store and every caller would crash.
            const { useNetworkStore } = await import('../network-store')

            const merged = useNetworkStore.persist
                .getOptions()
                .merge?.({ network: 'testnet' }, useNetworkStore.getState())

            expect(merged?.network).toBe('testnet')
            expect(typeof merged?.setNetwork).toBe('function')
            expect(typeof merged?.resetState).toBe('function')
        })

        test.each([
            ['undefined', undefined],
            ['null', null],
        ])(
            'rehydrating from empty storage (%s) leaves the current state alone',
            async (_label, persisted) => {
                // zustand calls `merge` even when storage held nothing, and
                // applies the result with replace:true. With nothing persisted
                // there is no value to guard, so the current state must survive
                // untouched rather than being forced to config.defaultNetwork.
                const { useNetworkStore } = await import('../network-store')

                act(() => {
                    useNetworkStore.getState().setNetwork('betanet')
                })

                const merged = useNetworkStore.persist
                    .getOptions()
                    .merge?.(persisted, useNetworkStore.getState())

                expect(merged?.network).toBe('betanet')
            },
        )
    })
})
