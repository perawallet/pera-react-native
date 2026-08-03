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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { getSyncService } from '@perawallet/wallet-core-background'
import { useSyncRefresh } from '../useSyncRefresh'

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

const ADDRESSES = ['ADDR1', 'ADDR2']

const createDeferred = () => {
    let resolve: () => void = () => {}
    let reject: (error: Error) => void = () => {}
    const promise = new Promise<void>((res, rej) => {
        resolve = () => res()
        reject = rej
    })
    return { promise, resolve, reject }
}

describe('useSyncRefresh', () => {
    const refreshAccounts = vi.fn()
    const invalidateQueries = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        refreshAccounts.mockResolvedValue(undefined)
        ;(getSyncService as Mock).mockReturnValue({
            refreshAccounts,
            invalidateQueries,
        })
    })

    it('refreshes the given addresses on the active network without re-invalidating on top of refreshAccounts', async () => {
        const { result } = renderHook(() =>
            useSyncRefresh({ addresses: ADDRESSES }),
        )

        await act(async () => {
            result.current.refresh()
        })

        expect(refreshAccounts).toHaveBeenCalledWith(ADDRESSES, 'mainnet')
        expect(invalidateQueries).not.toHaveBeenCalled()
    })

    it('reports isRefreshing while the refresh is in flight and false once it settles', async () => {
        const deferred = createDeferred()
        refreshAccounts.mockReturnValue(deferred.promise)

        const { result } = renderHook(() =>
            useSyncRefresh({ addresses: ADDRESSES }),
        )
        expect(result.current.isRefreshing).toBe(false)

        act(() => {
            result.current.refresh()
        })
        expect(result.current.isRefreshing).toBe(true)

        await act(async () => {
            deferred.resolve()
            await deferred.promise
        })
        expect(result.current.isRefreshing).toBe(false)
    })

    it('clears isRefreshing when refreshAccounts rejects', async () => {
        const deferred = createDeferred()
        refreshAccounts.mockReturnValue(deferred.promise)

        const { result } = renderHook(() =>
            useSyncRefresh({ addresses: ADDRESSES }),
        )

        act(() => {
            result.current.refresh()
        })
        expect(result.current.isRefreshing).toBe(true)

        await act(async () => {
            deferred.reject(new Error('indexer unreachable'))
            await deferred.promise.catch(() => {})
        })

        expect(result.current.isRefreshing).toBe(false)
        expect(invalidateQueries).not.toHaveBeenCalled()
    })

    it('starts no second refreshAccounts while one is already in flight', async () => {
        const deferred = createDeferred()
        refreshAccounts.mockReturnValue(deferred.promise)

        const { result } = renderHook(() =>
            useSyncRefresh({ addresses: ADDRESSES }),
        )

        act(() => {
            result.current.refresh()
            result.current.refresh()
        })

        expect(refreshAccounts).toHaveBeenCalledTimes(1)

        await act(async () => {
            deferred.resolve()
            await deferred.promise
        })

        act(() => {
            result.current.refresh()
        })

        expect(refreshAccounts).toHaveBeenCalledTimes(2)
    })

    it('joins the in-flight refresh when another hook instance pulls the same addresses', async () => {
        const deferred = createDeferred()
        refreshAccounts.mockReturnValue(deferred.promise)
        const shared = ['SHARED_ADDR']

        const overview = renderHook(() => useSyncRefresh({ addresses: shared }))
        // A distinct array with the same contents: the key is the addresses,
        // not the array identity.
        const history = renderHook(() =>
            useSyncRefresh({ addresses: [...shared] }),
        )

        act(() => {
            overview.result.current.refresh()
        })
        act(() => {
            history.result.current.refresh()
        })

        expect(refreshAccounts).toHaveBeenCalledTimes(1)
        expect(overview.result.current.isRefreshing).toBe(true)
        expect(history.result.current.isRefreshing).toBe(true)

        await act(async () => {
            deferred.resolve()
            await deferred.promise
        })

        expect(overview.result.current.isRefreshing).toBe(false)
        expect(history.result.current.isRefreshing).toBe(false)
    })

    it('runs a separate refresh for a different account while one is in flight', async () => {
        const accountA = createDeferred()
        const accountB = createDeferred()
        refreshAccounts
            .mockReturnValueOnce(accountA.promise)
            .mockReturnValueOnce(accountB.promise)

        const a = renderHook(() => useSyncRefresh({ addresses: ['A_ADDR'] }))
        const b = renderHook(() => useSyncRefresh({ addresses: ['B_ADDR'] }))

        act(() => {
            a.result.current.refresh()
        })
        act(() => {
            b.result.current.refresh()
        })

        expect(refreshAccounts).toHaveBeenNthCalledWith(
            1,
            ['A_ADDR'],
            'mainnet',
        )
        expect(refreshAccounts).toHaveBeenNthCalledWith(
            2,
            ['B_ADDR'],
            'mainnet',
        )

        await act(async () => {
            accountA.resolve()
            accountB.resolve()
            await Promise.all([accountA.promise, accountB.promise])
        })

        expect(a.result.current.isRefreshing).toBe(false)
        expect(b.result.current.isRefreshing).toBe(false)
    })

    it('settles a refresh with no addresses', async () => {
        const { result } = renderHook(() => useSyncRefresh({ addresses: [] }))

        await act(async () => {
            result.current.refresh()
        })

        expect(refreshAccounts).toHaveBeenCalledWith([], 'mainnet')
        expect(result.current.isRefreshing).toBe(false)
    })

    it('swallows an uninitialized sync service and releases the in-flight guard', async () => {
        ;(getSyncService as Mock).mockImplementation(() => {
            throw new Error('SyncService not initialized')
        })

        const { result } = renderHook(() =>
            useSyncRefresh({ addresses: ADDRESSES }),
        )

        await act(async () => {
            expect(() => result.current.refresh()).not.toThrow()
        })

        expect(result.current.isRefreshing).toBe(false)
        expect(refreshAccounts).not.toHaveBeenCalled()

        // A later pull must still work once the service comes up.
        ;(getSyncService as Mock).mockReturnValue({
            refreshAccounts,
            invalidateQueries,
        })
        await act(async () => {
            result.current.refresh()
        })

        expect(refreshAccounts).toHaveBeenCalledTimes(1)
    })
})
