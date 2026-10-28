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
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NoBackupCredentialsError } from '../../../errors'
import { backupCredentialsFileName } from '../../credentials/backupCredentialsFile'
import type { BackupId } from '../../models'

const { cloudSave } = vi.hoisted(() => ({ cloudSave: vi.fn() }))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ cloudFileStorage: { save: cloudSave } }),
}))

import {
    useSaveBackupCredentialsFileMutation,
    type SaveBackupCredentialsFileVariables,
} from '../useSaveBackupCredentialsFileMutation'

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='
const BACKUP_ID = `did:pera:VQBGR${'A'.repeat(53)}` as BackupId
const FILE_NAME = backupCredentialsFileName(BACKUP_ID)

const saveToDevice = vi.fn()
const onSuccess = vi.fn()
const onError = vi.fn()

const renderMutation = () => {
    const client = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    return renderHook(
        () =>
            useSaveBackupCredentialsFileMutation({
                saveToDevice,
                onSuccess,
                onError,
            }),
        {
            wrapper: ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={client}>
                    {children}
                </QueryClientProvider>
            ),
        },
    )
}

const variables = (
    overrides: Partial<SaveBackupCredentialsFileVariables> = {},
): SaveBackupCredentialsFileVariables => ({
    destination: 'device',
    salt: SALT,
    backupId: BACKUP_ID,
    ...overrides,
})

beforeEach(() => {
    vi.clearAllMocks()
    saveToDevice.mockResolvedValue('saved')
    cloudSave.mockResolvedValue('saved')
})

describe('useSaveBackupCredentialsFileMutation', () => {
    it('writes a device save through the app-supplied writer only', async () => {
        const { result } = renderMutation()

        await act(() => result.current.saveCredentialsFile(variables()))

        expect(saveToDevice).toHaveBeenCalledWith(
            FILE_NAME,
            expect.stringContaining(SALT),
        )
        expect(cloudSave).not.toHaveBeenCalled()
    })

    it.each(['icloud', 'googleDrive'] as const)(
        'writes to %s through the cloud store only',
        async destination => {
            const { result } = renderMutation()

            await act(() =>
                result.current.saveCredentialsFile(variables({ destination })),
            )

            expect(cloudSave).toHaveBeenCalledWith(
                destination,
                FILE_NAME,
                expect.stringContaining(SALT),
            )
            expect(saveToDevice).not.toHaveBeenCalled()
        },
    )

    it.each([
        ['salt', { salt: null }],
        ['backup id', { backupId: null }],
    ])(
        'refuses to write when the %s is gone',
        async (_, incomplete: Partial<SaveBackupCredentialsFileVariables>) => {
            const { result } = renderMutation()
            const input = variables(incomplete)

            await act(() =>
                result.current
                    .saveCredentialsFile(input)
                    .catch(() => undefined),
            )

            expect(saveToDevice).not.toHaveBeenCalled()
            expect(cloudSave).not.toHaveBeenCalled()
            expect(onError.mock.calls[0].slice(0, 2)).toEqual([
                expect.any(NoBackupCredentialsError),
                input,
            ])
        },
    )

    it('passes a cancel through to onSuccess', async () => {
        cloudSave.mockResolvedValue('cancelled')
        const { result } = renderMutation()
        const input = variables({ destination: 'icloud' })

        await act(() => result.current.saveCredentialsFile(input))

        expect(onSuccess.mock.calls[0].slice(0, 2)).toEqual([
            'cancelled',
            input,
        ])
    })

    it('reports a writer rejection with the destination it was for', async () => {
        const error = new Error('disk full')
        saveToDevice.mockRejectedValue(error)
        const { result } = renderMutation()
        const input = variables()

        await act(() =>
            result.current.saveCredentialsFile(input).catch(() => undefined),
        )

        expect(onError.mock.calls[0].slice(0, 2)).toEqual([error, input])
    })

    it('exposes pending and the destination while a save is in flight', async () => {
        let finish: (value: string) => void = () => undefined
        cloudSave.mockImplementation(
            () =>
                new Promise(resolve => {
                    finish = resolve
                }),
        )
        const { result } = renderMutation()

        expect(result.current.isPending).toBe(false)
        expect(result.current.destination).toBeUndefined()

        let pending: Promise<unknown> = Promise.resolve()
        act(() => {
            pending = result.current.saveCredentialsFile(
                variables({ destination: 'googleDrive' }),
            )
        })

        await waitFor(() => expect(result.current.isPending).toBe(true))
        expect(result.current.destination).toBe('googleDrive')

        await act(async () => {
            finish('saved')
            await pending
        })
        await waitFor(() => expect(result.current.isPending).toBe(false))
    })
})
