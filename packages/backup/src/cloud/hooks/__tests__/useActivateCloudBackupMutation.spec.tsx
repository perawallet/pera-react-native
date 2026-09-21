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

import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const SALT = 'c2FsdA=='
const ENCRYPTION_KEY = Uint8Array.from([5, 5, 5])
const AUTH_SECRET_KEY = Uint8Array.from([4, 4, 4])

const {
    MNEMONIC,
    persistBackupKeysMock,
    setConfiguredMock,
    clearDraftMock,
    readDraftMnemonicMock,
    draftState,
} = vi.hoisted(() => ({
    MNEMONIC: ['abandon', 'ability', 'able'],
    persistBackupKeysMock: vi.fn(async () => undefined),
    setConfiguredMock: vi.fn(),
    clearDraftMock: vi.fn(),
    readDraftMnemonicMock: vi.fn(),
    draftState: {
        salt: null as string | null,
        registration: null as {
            backupId: string
            deviceId: string
            encryptionKey: Uint8Array
            authSecretKey: Uint8Array
        } | null,
    },
}))

vi.mock('../../credentials/keyStorage', () => ({
    persistBackupKeys: persistBackupKeysMock,
}))

const { useCloudBackupDraftStoreMock } = vi.hoisted(() => {
    const useCloudBackupDraftStoreMock = (
        selector: (s: { clearDraft: () => void }) => unknown,
    ) => selector({ clearDraft: clearDraftMock })
    Object.assign(useCloudBackupDraftStoreMock, {
        getState: () => ({
            salt: draftState.salt,
            registration: draftState.registration,
        }),
    })
    return { useCloudBackupDraftStoreMock }
})

vi.mock('../../store/draftStore', () => ({
    readCloudBackupDraftMnemonic: readDraftMnemonicMock,
    useCloudBackupDraftStore: useCloudBackupDraftStoreMock,
}))

vi.mock('../../store/store', () => ({
    useCloudBackupStore: (
        selector: (s: {
            setConfigured: (params: {
                backupId: string
                salt: string
                deviceId: string
            }) => void
        }) => unknown,
    ) => selector({ setConfigured: setConfiguredMock }),
}))

import { isExpectedError } from '@perawallet/wallet-core-shared'
import { BackupDraftMissingError } from '../../../errors'
import { useActivateCloudBackupMutation } from '../useActivateCloudBackupMutation'

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    persistBackupKeysMock.mockResolvedValue(undefined)
    readDraftMnemonicMock.mockReturnValue(MNEMONIC)
    draftState.salt = SALT
    draftState.registration = {
        backupId: 'did:pera:abc',
        deviceId: 'device-123',
        encryptionKey: ENCRYPTION_KEY,
        authSecretKey: AUTH_SECRET_KEY,
    }
})

describe('useActivateCloudBackupMutation', () => {
    test('persists the retained keys and promotes the backup to the store', async () => {
        const { result } = renderHook(() => useActivateCloudBackupMutation(), {
            wrapper: createWrapper(),
        })

        act(() => result.current.mutate())

        await waitFor(() => expect(setConfiguredMock).toHaveBeenCalled())
        expect(persistBackupKeysMock).toHaveBeenCalledWith({
            encryptionKey: ENCRYPTION_KEY,
            authSecretKey: AUTH_SECRET_KEY,
            mnemonic: MNEMONIC,
        })
        expect(setConfiguredMock).toHaveBeenCalledWith({
            backupId: 'did:pera:abc',
            salt: SALT,
            deviceId: 'device-123',
        })
        expect(clearDraftMock).toHaveBeenCalled()
    })

    // The keystore write is the consent boundary: it must not happen unless the
    // backup was actually registered first.
    test('rejects without touching the keystore when nothing was registered', async () => {
        draftState.registration = null
        const onError = vi.fn()

        const { result } = renderHook(
            () => useActivateCloudBackupMutation({ onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(persistBackupKeysMock).not.toHaveBeenCalled()
        expect(setConfiguredMock).not.toHaveBeenCalled()
        // A draft dropped mid-setup is a lost race, so it files no crash report.
        expect(onError.mock.calls[0][0]).toBeInstanceOf(BackupDraftMissingError)
        expect(isExpectedError(onError.mock.calls[0][0])).toBe(true)
    })

    test('leaves the store unconfigured and the draft intact when the keystore write fails', async () => {
        persistBackupKeysMock.mockRejectedValue(new Error('keystore busy'))
        const onError = vi.fn()

        const { result } = renderHook(
            () => useActivateCloudBackupMutation({ onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(setConfiguredMock).not.toHaveBeenCalled()
        expect(clearDraftMock).not.toHaveBeenCalled()
    })

    // A replaced draft has already zeroed the old registration's buffers, so
    // reading it a render late would persist zeroed keys and configure a
    // backup nobody can open.
    test('rejects when the draft was replaced after the last render', async () => {
        draftState.registration = null
        readDraftMnemonicMock.mockReturnValue(MNEMONIC)
        const onError = vi.fn()

        const { result } = renderHook(
            () => useActivateCloudBackupMutation({ onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(persistBackupKeysMock).not.toHaveBeenCalled()
    })
})
