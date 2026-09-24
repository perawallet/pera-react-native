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
    ICloudUnavailableError,
    NoBackupCredentialsError,
} from '@perawallet/wallet-core-backup'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useSaveCredentialsFile } from '../useSaveCredentialsFile'

const { mockShowToast, mockShowError, mockLoggerError, saveCredentialsFile } =
    vi.hoisted(() => ({
        mockShowToast: vi.fn(),
        mockShowError: vi.fn(),
        mockLoggerError: vi.fn(),
        saveCredentialsFile: vi.fn(),
    }))

// errors.ts extends AppError from this package, so the real exports (not the
// global unit-test stub) must survive here.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
    logger: { error: mockLoggerError },
}))
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))
vi.mock('@hooks/useLanguage')
vi.mock('../../storage', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
    saveCredentialsFile,
}))

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='
const BACKUP_ID = `did:pera:VQBGR${'A'.repeat(53)}`
const CREDENTIALS = { salt: SALT, backupId: BACKUP_ID }

beforeEach(() => {
    vi.clearAllMocks()
    saveCredentialsFile.mockResolvedValue('saved')
})

const renderSaveHook = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    return renderHook(() => useSaveCredentialsFile(), {
        wrapper: ({ children }: { children: ReactNode }) =>
            createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            ),
    })
}

const save = async (destination: 'device' | 'icloud' | 'googleDrive') => {
    const { result } = renderSaveHook()
    await result.current.saveCredentials(destination, CREDENTIALS)
}

describe('useSaveCredentialsFile', () => {
    test.each(['device', 'icloud', 'googleDrive'] as const)(
        'saves to %s and confirms',
        async destination => {
            await save(destination)

            expect(saveCredentialsFile).toHaveBeenCalledWith(
                destination,
                CREDENTIALS,
            )
            expect(mockShowToast).toHaveBeenCalledWith(
                {
                    title: 'cloud_backup.store_credentials.success',
                    body: '',
                    type: 'success',
                },
                { delayLength: 'short' },
            )
        },
    )

    // A file holding a blank key under a valid backup id is worse than no
    // file, and every caller reads both halves out of a store that can lose
    // one of them mid-flow.
    test.each([
        ['the salt', { salt: null, backupId: BACKUP_ID }],
        ['the backup id', { salt: SALT, backupId: null }],
    ])('refuses to write when %s is gone', async (_, incomplete) => {
        const { result } = renderSaveHook()

        await result.current.saveCredentials('device', incomplete)

        expect(saveCredentialsFile).not.toHaveBeenCalled()
        expect(mockShowToast).not.toHaveBeenCalled()
        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(NoBackupCredentialsError),
            'cloud_backup.store_credentials.error',
        )
        expect(JSON.stringify(mockLoggerError.mock.calls)).not.toContain(SALT)
    })

    test('stays silent when the user backs out inside the destination', async () => {
        saveCredentialsFile.mockResolvedValueOnce('cancelled')

        await save('googleDrive')

        expect(mockShowToast).not.toHaveBeenCalled()
        expect(mockShowError).not.toHaveBeenCalled()
    })

    test('passes a destination error through so it can show its own copy', async () => {
        const error = new ICloudUnavailableError()
        saveCredentialsFile.mockRejectedValueOnce(error)

        await save('icloud')

        expect(mockShowError).toHaveBeenCalledWith(
            error,
            'cloud_backup.store_credentials.error',
        )
    })

    test('logs a failure without leaking the key', async () => {
        const error = new Error('disk full')
        saveCredentialsFile.mockRejectedValueOnce(error)

        await save('device')

        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ destination: 'device', error }),
        )
        expect(JSON.stringify(mockLoggerError.mock.calls)).not.toContain(SALT)
    })

    test('ignores a second call while one is in flight', async () => {
        let finishSave: (value: string) => void = () => {}
        saveCredentialsFile.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finishSave = resolve
                }),
        )
        const { result } = renderSaveHook()

        const first = result.current.saveCredentials('device', CREDENTIALS)
        await result.current.saveCredentials('icloud', CREDENTIALS)
        finishSave('saved')
        await first

        expect(saveCredentialsFile).toHaveBeenCalledTimes(1)
    })

    // The destination rows disable themselves off this, so a save in a picker
    // or a cloud sign-in is visible rather than a row that silently does
    // nothing.
    test('reports that a save is in flight until it settles', async () => {
        let finishSave: (value: string) => void = () => {}
        saveCredentialsFile.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finishSave = resolve
                }),
        )
        const { result } = renderSaveHook()

        expect(result.current.isSaving).toBe(false)

        const pending = result.current.saveCredentials('device', CREDENTIALS)
        await waitFor(() => expect(result.current.isSaving).toBe(true))

        finishSave('saved')
        await pending

        await waitFor(() => expect(result.current.isSaving).toBe(false))
    })
})
