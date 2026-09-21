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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
    InvalidCredentialsFileError,
    useCloudBackupRestoreDraftStore,
} from '@perawallet/wallet-core-backup'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useRestoreBackupOptions } from '../useRestoreBackupOptions'

const {
    mockRequest,
    mockShowError,
    mockLoggerError,
    mockIsFocused,
    readBackupCredentials,
} = vi.hoisted(() => ({
    mockRequest: vi.fn(),
    mockShowError: vi.fn(),
    mockLoggerError: vi.fn(),
    mockIsFocused: vi.fn(),
    readBackupCredentials: vi.fn(),
}))

// errors.ts extends AppError from this package, so the real exports must
// survive here — only logger is overridden.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
    logger: { error: mockLoggerError },
}))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ isFocused: mockIsFocused }),
}))
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))
vi.mock('../../components/RestoreBackupSheet', () => ({
    RestoreBackupSheet: () => null,
}))
vi.mock('../../storage', () => ({ readBackupCredentials }))

const KEY = {
    salt: 'q311Z4ReDNWpMVuH8XdvSw==',
    argon2id: {
        timeCost: 3,
        memoryCost: 256,
        parallelism: 1,
        outputLength: 32,
    },
}

beforeEach(() => {
    vi.clearAllMocks()
    mockIsFocused.mockReturnValue(true)
    readBackupCredentials.mockResolvedValue({ status: 'read', key: KEY })
})

const choose = async () => {
    const { result } = renderHook(() => useRestoreBackupOptions())
    let route: unknown
    await act(async () => {
        route = await result.current.chooseRestoreRoute()
    })
    return route
}

describe('useRestoreBackupOptions', () => {
    test('picks no route when the sheet is dismissed', async () => {
        mockRequest.mockResolvedValueOnce(undefined)

        expect(await choose()).toBeNull()
        expect(readBackupCredentials).not.toHaveBeenCalled()
    })

    test.each([
        ['scan', 'CloudBackupRestoreScan'],
        ['manual', 'CloudBackupRestorePassphrase'],
    ])('sends %s to its screen without a key', async (choice, route) => {
        mockRequest.mockResolvedValueOnce(choice)

        expect(await choose()).toEqual([route])
        expect(readBackupCredentials).not.toHaveBeenCalled()
    })

    test.each(['device', 'icloud', 'googleDrive'])(
        'reads the key from %s and hands it to the passphrase screen',
        async source => {
            mockRequest.mockResolvedValueOnce(source)

            expect(await choose()).toEqual(['CloudBackupRestorePassphrase'])
            // Through the draft store rather than a route param, so the key
            // never enters the navigation state tree.
            expect(
                useCloudBackupRestoreDraftStore.getState().importedKey,
            ).toEqual(KEY)
            expect(readBackupCredentials).toHaveBeenCalledWith(source, {
                onReading: expect.any(Function),
                chooseFile: expect.any(Function),
            })
        },
    )

    test('stays put without a toast when the user backs out of the picker', async () => {
        mockRequest.mockResolvedValueOnce('device')
        readBackupCredentials.mockResolvedValueOnce({ status: 'cancelled' })

        expect(await choose()).toBeNull()
        expect(mockShowError).not.toHaveBeenCalled()
    })

    test('picks no route when the user left the screen during the read', async () => {
        mockRequest.mockResolvedValueOnce('device')
        mockIsFocused.mockReturnValue(false)

        expect(await choose()).toBeNull()
    })

    test('shows the read error and stays put', async () => {
        mockRequest.mockResolvedValueOnce('device')
        const error = new InvalidCredentialsFileError()
        readBackupCredentials.mockRejectedValueOnce(error)

        expect(await choose()).toBeNull()
        expect(mockShowError).toHaveBeenCalledWith(
            error,
            'cloud_backup.restore.import_error',
        )
        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ source: 'device', error }),
        )
    })

    test('shows no progress while the reader has not called onReading', async () => {
        mockRequest.mockResolvedValueOnce('device')
        let finishRead: (value: unknown) => void = () => {}
        readBackupCredentials.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finishRead = resolve
                }),
        )
        const { result } = renderHook(() => useRestoreBackupOptions())

        let pending: Promise<unknown> = Promise.resolve()
        act(() => {
            pending = result.current.chooseRestoreRoute()
        })
        await waitFor(() => expect(readBackupCredentials).toHaveBeenCalled())
        expect(result.current.isReadingCredentials).toBe(false)

        await act(async () => {
            finishRead({ status: 'cancelled' })
            await pending
        })
    })

    test('shows progress once the reader calls onReading, then clears when it settles', async () => {
        mockRequest.mockResolvedValueOnce('icloud')
        let onReading: () => void = () => {}
        let finishRead: (value: unknown) => void = () => {}
        readBackupCredentials.mockImplementationOnce(
            (_source: string, options?: { onReading?: () => void }) =>
                new Promise(resolve => {
                    onReading = options?.onReading ?? (() => {})
                    finishRead = resolve
                }),
        )
        const { result } = renderHook(() => useRestoreBackupOptions())

        let pending: Promise<unknown> = Promise.resolve()
        act(() => {
            pending = result.current.chooseRestoreRoute()
        })
        await waitFor(() => expect(readBackupCredentials).toHaveBeenCalled())
        expect(result.current.isReadingCredentials).toBe(false)

        act(() => {
            onReading()
        })
        await waitFor(() =>
            expect(result.current.isReadingCredentials).toBe(true),
        )

        await act(async () => {
            finishRead({ status: 'cancelled' })
            await pending
        })
        expect(result.current.isReadingCredentials).toBe(false)
    })

    test('drops the progress overlay while the chooser is up, then restores it', async () => {
        mockRequest.mockResolvedValueOnce('icloud')
        let chooseFile: (
            fileNames: string[],
        ) => Promise<string | null> = async () => null
        readBackupCredentials.mockImplementationOnce(
            (
                _source: string,
                options?: {
                    onReading?: () => void
                    chooseFile?: typeof chooseFile
                },
            ) => {
                options?.onReading?.()
                chooseFile = options?.chooseFile ?? chooseFile
                return Promise.resolve({ status: 'cancelled' })
            },
        )
        const { result } = renderHook(() => useRestoreBackupOptions())

        await act(async () => {
            await result.current.chooseRestoreRoute()
        })

        // The chooser is a sheet; the overlay must not sit over it.
        mockRequest.mockResolvedValueOnce('pera-backup-ZZZZZ.json')
        await act(async () => {
            expect(await chooseFile(['a.json', 'b.json'])).toBe(
                'pera-backup-ZZZZZ.json',
            )
        })
        expect(result.current.isReadingCredentials).toBe(true)

        mockRequest.mockResolvedValueOnce(undefined)
        await act(async () => {
            expect(await chooseFile(['a.json', 'b.json'])).toBeNull()
        })
        expect(result.current.isReadingCredentials).toBe(false)
    })

    test('ignores a second call while one is in flight', async () => {
        let resolveSheet: (value: string | undefined) => void = () => {}
        mockRequest.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveSheet = resolve
                }),
        )
        const { result } = renderHook(() => useRestoreBackupOptions())

        await act(async () => {
            const first = result.current.chooseRestoreRoute()
            expect(await result.current.chooseRestoreRoute()).toBeNull()
            resolveSheet(undefined)
            await first
        })

        expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    test('releases the guard once settled, so a later call opens the sheet again', async () => {
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useRestoreBackupOptions())

        await act(async () => {
            await result.current.chooseRestoreRoute()
        })
        await act(async () => {
            await result.current.chooseRestoreRoute()
        })

        expect(mockRequest).toHaveBeenCalledTimes(2)
    })
})
