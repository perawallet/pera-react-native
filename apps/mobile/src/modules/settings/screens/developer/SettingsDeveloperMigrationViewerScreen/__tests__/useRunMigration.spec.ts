/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { act, renderHook } from '@testing-library/react'

const {
    importAccountFn,
    createHdWalletAccountFn,
    createHDWalletKeyFn,
    migrationService,
} = vi.hoisted(() => ({
    importAccountFn: vi.fn(),
    createHdWalletAccountFn: vi.fn(),
    createHDWalletKeyFn: vi.fn(),
    migrationService: { tag: 'migration-service' },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useImportAccount: () => importAccountFn,
    useCreateAccount: () => ({
        createHdWalletAccountForSeed: createHdWalletAccountFn,
    }),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({ createHDWalletKey: createHDWalletKeyFn }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ migration: migrationService }),
}))

vi.mock('@perawallet/wallet-core-migrate', () => ({
    runMigration: vi.fn(),
}))

import { useRunMigration } from '../useRunMigration'
import { runMigration } from '@perawallet/wallet-core-migrate'

const successfulRun = {
    completed: true,
    incompleteReason: null,
    accounts: { imported: 1, skipped: 0, failed: [] },
    extras: null,
    error: null,
}

beforeEach(() => {
    vi.mocked(runMigration).mockReset()
    vi.mocked(runMigration).mockResolvedValue(successfulRun as never)
})

describe('useRunMigration', () => {
    it('starts in an idle state', () => {
        const { result } = renderHook(() => useRunMigration())

        expect(result.current.isMigrating).toBe(false)
        expect(result.current.result).toBeNull()
        expect(result.current.error).toBeNull()
    })

    it('passes provider.migration and hook deps into runMigration', async () => {
        const { result } = renderHook(() => useRunMigration())

        await act(async () => {
            await result.current.run()
        })

        expect(runMigration).toHaveBeenCalledWith(migrationService, {
            importAccount: importAccountFn,
            createHdWalletAccount: createHdWalletAccountFn,
            createHDWalletKey: createHDWalletKeyFn,
        })
    })

    it('stores the migration result on success', async () => {
        const { result } = renderHook(() => useRunMigration())

        await act(async () => {
            await result.current.run()
        })

        expect(result.current.result).toEqual(successfulRun)
        expect(result.current.error).toBeNull()
        expect(result.current.isMigrating).toBe(false)
    })

    it('toggles isMigrating during the in-flight call', async () => {
        let resolveRun: (value: unknown) => void = () => {}
        vi.mocked(runMigration).mockImplementationOnce(
            () =>
                new Promise(
                    resolve =>
                        (resolveRun = resolve as (value: unknown) => void),
                ),
        )
        const { result } = renderHook(() => useRunMigration())

        let runPromise!: Promise<unknown>
        act(() => {
            runPromise = result.current.run()
        })
        expect(result.current.isMigrating).toBe(true)

        await act(async () => {
            resolveRun(successfulRun)
            await runPromise
        })
        expect(result.current.isMigrating).toBe(false)
    })

    it('captures and rethrows when runMigration rejects with an Error', async () => {
        const boom = new Error('unexpected')
        vi.mocked(runMigration).mockRejectedValueOnce(boom)
        const { result } = renderHook(() => useRunMigration())

        let caught: unknown = null
        await act(async () => {
            try {
                await result.current.run()
            } catch (e) {
                caught = e
            }
        })

        expect(caught).toBe(boom)
        expect(result.current.error).toBe(boom)
        expect(result.current.result).toBeNull()
        expect(result.current.isMigrating).toBe(false)
    })

    it('wraps non-Error rejections via String()', async () => {
        vi.mocked(runMigration).mockRejectedValueOnce('string-failure')
        const { result } = renderHook(() => useRunMigration())

        let caught: unknown = null
        await act(async () => {
            try {
                await result.current.run()
            } catch (e) {
                caught = e
            }
        })

        expect(caught).toBeInstanceOf(Error)
        expect((caught as Error).message).toBe('string-failure')
        expect(result.current.error?.message).toBe('string-failure')
    })

    it('resets prior result and error at the start of a new run', async () => {
        const { result } = renderHook(() => useRunMigration())
        await act(async () => {
            await result.current.run()
        })
        expect(result.current.result).not.toBeNull()

        let resolveRun: (value: unknown) => void = () => {}
        vi.mocked(runMigration).mockImplementationOnce(
            () =>
                new Promise(
                    resolve =>
                        (resolveRun = resolve as (value: unknown) => void),
                ),
        )
        let runPromise!: Promise<unknown>
        act(() => {
            runPromise = result.current.run()
        })
        expect(result.current.result).toBeNull()
        expect(result.current.error).toBeNull()

        await act(async () => {
            resolveRun(successfulRun)
            await runPromise
        })
    })
})
