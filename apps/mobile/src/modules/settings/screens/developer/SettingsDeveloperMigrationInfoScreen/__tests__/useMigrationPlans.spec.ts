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

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MigrationPlanSummary } from '@perawallet/wallet-extension-platform'
import { useMigrationPlans } from '../useMigrationPlans'

const { mockGetMigrationPlans } = vi.hoisted(() => ({
    mockGetMigrationPlans: vi.fn<() => Promise<MigrationPlanSummary[]>>(),
}))

vi.mock('@perawallet/wallet-extension-provider', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-extension-provider')
    >()),
    getProvider: () => ({
        migration: { getMigrationPlans: mockGetMigrationPlans },
    }),
}))

const PLAN: MigrationPlanSummary = {
    dbName: 'accounts',
    targetVersion: 3,
    oldestSupported: 1,
    readerImpact: 'none',
    migrations: [],
}

const deferred = <T>() => {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

describe('useMigrationPlans', () => {
    beforeEach(() => {
        mockGetMigrationPlans.mockReset()
    })

    it('reports loading with no plans before the provider answers', () => {
        mockGetMigrationPlans.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useMigrationPlans())

        expect(result.current).toEqual({
            plans: [],
            isLoading: true,
            error: null,
        })
    })

    it('exposes the plans once they load', async () => {
        mockGetMigrationPlans.mockResolvedValue([PLAN])

        const { result } = renderHook(() => useMigrationPlans())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.plans).toEqual([PLAN])
        expect(result.current.error).toBeNull()
    })

    it('exposes the error the provider rejects with', async () => {
        const failure = new Error('db locked')
        mockGetMigrationPlans.mockRejectedValue(failure)

        const { result } = renderHook(() => useMigrationPlans())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.error).toBe(failure)
        expect(result.current.plans).toEqual([])
    })

    it('wraps a non-Error rejection in an Error', async () => {
        mockGetMigrationPlans.mockRejectedValue('timeout')

        const { result } = renderHook(() => useMigrationPlans())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.error).toBeInstanceOf(Error)
        expect(result.current.error?.message).toBe('timeout')
    })

    it('ignores plans that arrive after unmount', async () => {
        const pending = deferred<MigrationPlanSummary[]>()
        mockGetMigrationPlans.mockReturnValue(pending.promise)
        const { result, unmount } = renderHook(() => useMigrationPlans())

        unmount()
        pending.resolve([PLAN])
        await pending.promise

        expect(result.current.isLoading).toBe(true)
        expect(result.current.plans).toEqual([])
    })

    it('ignores a failure that arrives after unmount', async () => {
        const pending = deferred<MigrationPlanSummary[]>()
        mockGetMigrationPlans.mockReturnValue(pending.promise)
        const { result, unmount } = renderHook(() => useMigrationPlans())

        unmount()
        pending.reject(new Error('late'))
        await pending.promise.catch(() => undefined)

        expect(result.current.isLoading).toBe(true)
        expect(result.current.error).toBeNull()
    })
})
