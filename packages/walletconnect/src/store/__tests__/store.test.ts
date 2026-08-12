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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockStorage = new Map<string, string>()
const registerStoreMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: registerStoreMock,
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: (key: string) => mockStorage.get(key) ?? null,
            setItem: (key: string, value: string) => {
                mockStorage.set(key, value)
            },
            removeItem: (key: string) => {
                mockStorage.delete(key)
            },
        },
    }),
}))

describe('WalletConnectStore', () => {
    beforeEach(() => {
        mockStorage.clear()
        vi.resetModules()
    })

    it('should initialize with default values', async () => {
        const { useWalletConnectStore } = await import('../store')

        const { result } = renderHook(() => useWalletConnectStore())

        expect(result.current.walletConnectConnections).toEqual([])
        expect(result.current.sessionRequests).toEqual([])
    })

    it('should update walletConnectConnections', async () => {
        const { useWalletConnectStore } = await import('../store')

        const { result } = renderHook(() => useWalletConnectStore())

        const sessions = [{ session: { clientId: '1' } }]
        act(() => {
            result.current.setWalletConnectConnections(sessions as any)
        })

        expect(result.current.walletConnectConnections).toEqual(sessions)
    })

    it('should update sessionRequests', async () => {
        const { useWalletConnectStore } = await import('../store')

        const { result } = renderHook(() => useWalletConnectStore())

        const requests = [{ id: 1 }]
        act(() => {
            result.current.setSessionRequests(requests as any)
        })

        expect(result.current.sessionRequests).toEqual(requests)
    })

    it('should only persist walletConnectConnections', async () => {
        const { useWalletConnectStore } = await import('../store')

        const { result } = renderHook(() => useWalletConnectStore())

        const sessions = [{ session: { clientId: '1' } }]
        const requests = [{ id: 1 }]
        act(() => {
            result.current.setWalletConnectConnections(sessions as any)
            result.current.setSessionRequests(requests as any)
        })

        // Access the persisted state via the mock storage
        const persisted = mockStorage.get('wallet-connect-store') ?? null
        expect(persisted).not.toBeNull()

        const parsed = JSON.parse(persisted!)
        expect(parsed.state.walletConnectConnections).toEqual(sessions)
        expect(parsed.state.sessionRequests).toBeUndefined()
    })

    it('should reset state to initial values', async () => {
        const { useWalletConnectStore } = await import('../store')

        const { result } = renderHook(() => useWalletConnectStore())

        act(() => {
            result.current.setWalletConnectConnections([
                { session: { clientId: '1' } },
            ] as any)
            result.current.setSessionRequests([{ id: 1 }] as any)
        })

        act(() => {
            result.current.resetState()
        })

        expect(result.current.walletConnectConnections).toEqual([])
        expect(result.current.sessionRequests).toEqual([])
    })

    describe('dappOrigins', () => {
        it('records and removes an origin keyed by clientId', async () => {
            const { useWalletConnectStore } = await import('../store')
            const { result } = renderHook(() => useWalletConnectStore())

            act(() => {
                result.current.setDappOrigin('client-1', {
                    source: 'external-browser',
                    browserName: 'Chrome',
                })
            })
            expect(result.current.dappOrigins['client-1']).toMatchObject({
                source: 'external-browser',
                browserName: 'Chrome',
            })

            act(() => {
                result.current.removeDappOrigin('client-1')
            })
            expect(result.current.dappOrigins['client-1']).toBeUndefined()
        })

        it('persists dappOrigins alongside connections', async () => {
            const { useWalletConnectStore } = await import('../store')
            const { result } = renderHook(() => useWalletConnectStore())

            act(() => {
                result.current.setDappOrigin('client-1', {
                    source: 'external-browser',
                })
            })

            const persisted = mockStorage.get('wallet-connect-store')
            const parsed = JSON.parse(persisted!)
            expect(parsed.state.dappOrigins['client-1']).toMatchObject({
                source: 'external-browser',
            })
        })

        it('records in-app and qr origins (post-action sheets key off these)', async () => {
            const { useWalletConnectStore } = await import('../store')
            const { result } = renderHook(() => useWalletConnectStore())

            act(() => {
                result.current.setDappOrigin('client-1', { source: 'in-app' })
                result.current.setDappOrigin('client-2', { source: 'qr' })
            })

            expect(result.current.dappOrigins['client-1'].source).toBe('in-app')
            expect(result.current.dappOrigins['client-2'].source).toBe('qr')
        })

        it('prunes origins whose clientId is not in the retained set', async () => {
            const { useWalletConnectStore } = await import('../store')
            const { result } = renderHook(() => useWalletConnectStore())

            act(() => {
                result.current.setDappOrigin('kept', {
                    source: 'external-browser',
                })
                result.current.setDappOrigin('dropped', {
                    source: 'external-browser',
                })
                result.current.pruneDappOrigins(['kept'])
            })

            expect(result.current.dappOrigins['kept']).toBeDefined()
            expect(result.current.dappOrigins['dropped']).toBeUndefined()
        })

        it('clears origins on resetState', async () => {
            const { useWalletConnectStore } = await import('../store')
            const { result } = renderHook(() => useWalletConnectStore())

            act(() => {
                result.current.setDappOrigin('client-1', {
                    source: 'external-browser',
                })
                result.current.resetState()
            })

            expect(result.current.dappOrigins).toEqual({})
        })
    })

    it('registers resetState and clearStorage callbacks', async () => {
        const { useWalletConnectStore } = await import('../store')

        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('wallet-connect-store')

        act(() => {
            useWalletConnectStore
                .getState()
                .setWalletConnectConnections([
                    { session: { clientId: '1' } },
                ] as any)
        })
        act(() => registration.resetState())
        expect(
            useWalletConnectStore.getState().walletConnectConnections,
        ).toEqual([])

        expect(() => registration.clearStorage()).not.toThrow()
    })
})
