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
import { act, renderHook, waitFor } from '@testing-library/react'

const {
    importAccountFn,
    createHdWalletAccountFn,
    createHDWalletKeyFn,
    hasSeedWithEntropyFn,
    markAccountBackedUpFn,
    migrationService,
    dismissFn,
    setSkippedFn,
    requestLockFn,
} = vi.hoisted(() => ({
    importAccountFn: vi.fn(),
    createHdWalletAccountFn: vi.fn(),
    createHDWalletKeyFn: vi.fn(),
    hasSeedWithEntropyFn: vi.fn(),
    markAccountBackedUpFn: vi.fn(),
    migrationService: { tag: 'migration-service' },
    dismissFn: vi.fn(),
    setSkippedFn: vi.fn(),
    requestLockFn: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useImportAccount: () => importAccountFn,
    useCreateAccount: () => ({
        createHdWalletAccountForSeed: createHdWalletAccountFn,
    }),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        createHDWalletKey: createHDWalletKeyFn,
        hasSeedWithEntropy: hasSeedWithEntropyFn,
    }),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useMarkMnemonicBackupComplete: () => markAccountBackedUpFn,
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    useSecurityStore: (
        selector: (state: { requestLock: () => void }) => unknown,
    ) => selector({ requestLock: requestLockFn }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ migration: migrationService }),
}))

vi.mock('@perawallet/wallet-core-migrate', () => ({
    runMigration: vi.fn(),
    useNeedsMigration: () => ({
        isChecking: false,
        needsMigration: true,
        dismiss: dismissFn,
        setSkipped: setSkippedFn,
    }),
}))

import { useMigrationSplashScreen } from '../useMigrationSplashScreen'
import { runMigration } from '@perawallet/wallet-core-migrate'

const successfulResult = {
    completed: true,
    incompleteReason: null,
    accounts: { imported: 2, skipped: 0, failed: [] },
    extras: null,
    error: null,
}

const accountsFailedResult = {
    completed: false,
    incompleteReason: 'accounts-failed' as const,
    accounts: {
        imported: 1,
        skipped: 0,
        failed: [
            { address: 'A', name: 'one', reason: 'oops' },
            { address: 'B', name: 'two', reason: 'oops' },
        ],
    },
    extras: null,
    error: null,
}

const otherFailureResult = {
    completed: false,
    incompleteReason: 'get-legacy-data-threw' as const,
    accounts: null,
    extras: null,
    error: new Error('disk'),
}

beforeEach(() => {
    dismissFn.mockReset()
    setSkippedFn.mockReset()
    requestLockFn.mockReset()
    vi.mocked(runMigration).mockReset()
})

describe('useMigrationSplashScreen', () => {
    it('starts in the running status', () => {
        vi.mocked(runMigration).mockReturnValue(new Promise(() => {}))
        const { result } = renderHook(() => useMigrationSplashScreen())

        expect(result.current.status).toBe('running')
        expect(result.current.failedAccountCount).toBe(0)
    })

    it('transitions to success and dismisses after 3 seconds', async () => {
        vi.useFakeTimers()
        try {
            vi.mocked(runMigration).mockResolvedValue(successfulResult as never)
            const { result } = renderHook(() => useMigrationSplashScreen())

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0)
            })
            expect(result.current.status).toBe('success')
            expect(dismissFn).not.toHaveBeenCalled()

            act(() => {
                vi.advanceTimersByTime(3000)
            })

            expect(dismissFn).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
        }
    })

    it('transitions to failure with the account failure count', async () => {
        vi.mocked(runMigration).mockResolvedValue(accountsFailedResult as never)
        const { result } = renderHook(() => useMigrationSplashScreen())

        await waitFor(() => {
            expect(result.current.status).toBe('failure')
        })
        expect(result.current.failedAccountCount).toBe(2)
        expect(dismissFn).not.toHaveBeenCalled()
    })

    it('reports zero failed accounts for non-account failure modes', async () => {
        vi.mocked(runMigration).mockResolvedValue(otherFailureResult as never)
        const { result } = renderHook(() => useMigrationSplashScreen())

        await waitFor(() => {
            expect(result.current.status).toBe('failure')
        })
        expect(result.current.failedAccountCount).toBe(0)
    })

    it('moves to failure when runMigration itself throws', async () => {
        vi.mocked(runMigration).mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => useMigrationSplashScreen())

        await waitFor(() => {
            expect(result.current.status).toBe('failure')
        })
        expect(result.current.failedAccountCount).toBe(0)
    })

    it('handleContinue calls dismiss', async () => {
        vi.mocked(runMigration).mockResolvedValue(accountsFailedResult as never)
        const { result } = renderHook(() => useMigrationSplashScreen())

        await waitFor(() => {
            expect(result.current.status).toBe('failure')
        })
        act(() => {
            result.current.handleContinue()
        })

        expect(dismissFn).toHaveBeenCalledTimes(1)
    })

    it('handleSkipPermanently sets the skipped flag and dismisses', async () => {
        vi.mocked(runMigration).mockResolvedValue(accountsFailedResult as never)
        const { result } = renderHook(() => useMigrationSplashScreen())

        await waitFor(() => {
            expect(result.current.status).toBe('failure')
        })
        act(() => {
            result.current.handleSkipPermanently()
        })

        expect(setSkippedFn).toHaveBeenCalledTimes(1)
        expect(dismissFn).toHaveBeenCalledTimes(1)
    })

    it('requests an app-lock re-check when auto-dismissing after a successful migration', async () => {
        vi.useFakeTimers()
        try {
            vi.mocked(runMigration).mockResolvedValue(successfulResult as never)
            renderHook(() => useMigrationSplashScreen())

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0)
            })
            expect(requestLockFn).not.toHaveBeenCalled()

            act(() => {
                vi.advanceTimersByTime(3000)
            })

            expect(requestLockFn).toHaveBeenCalledTimes(1)
            expect(dismissFn).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
        }
    })

    it('requests an app-lock re-check on handleContinue', async () => {
        vi.mocked(runMigration).mockResolvedValue(accountsFailedResult as never)
        const { result } = renderHook(() => useMigrationSplashScreen())

        await waitFor(() => {
            expect(result.current.status).toBe('failure')
        })
        act(() => {
            result.current.handleContinue()
        })

        expect(requestLockFn).toHaveBeenCalledTimes(1)
        expect(dismissFn).toHaveBeenCalledTimes(1)
    })

    it('requests an app-lock re-check on handleSkipPermanently', async () => {
        vi.mocked(runMigration).mockResolvedValue(accountsFailedResult as never)
        const { result } = renderHook(() => useMigrationSplashScreen())

        await waitFor(() => {
            expect(result.current.status).toBe('failure')
        })
        act(() => {
            result.current.handleSkipPermanently()
        })

        expect(setSkippedFn).toHaveBeenCalledTimes(1)
        expect(requestLockFn).toHaveBeenCalledTimes(1)
        expect(dismissFn).toHaveBeenCalledTimes(1)
    })

    it('does not dismiss after success if the screen unmounts within the 3s window', async () => {
        vi.useFakeTimers()
        try {
            vi.mocked(runMigration).mockResolvedValue(successfulResult as never)
            const { result, unmount } = renderHook(() =>
                useMigrationSplashScreen(),
            )

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0)
            })
            expect(result.current.status).toBe('success')

            unmount()
            act(() => {
                vi.advanceTimersByTime(3000)
            })

            expect(dismissFn).not.toHaveBeenCalled()
        } finally {
            vi.useRealTimers()
        }
    })

    it('passes the migration service and hook deps into runMigration', async () => {
        vi.mocked(runMigration).mockResolvedValue(successfulResult as never)
        renderHook(() => useMigrationSplashScreen())

        await waitFor(() => {
            expect(runMigration).toHaveBeenCalledTimes(1)
        })

        expect(runMigration).toHaveBeenCalledWith(migrationService, {
            importAccount: importAccountFn,
            createHdWalletAccount: createHdWalletAccountFn,
            createHDWalletKey: createHDWalletKeyFn,
            hasSeedWithEntropy: hasSeedWithEntropyFn,
            markAccountBackedUp: markAccountBackedUpFn,
        })
    })
})
