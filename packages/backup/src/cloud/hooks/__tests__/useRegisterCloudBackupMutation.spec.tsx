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
    registerCloudBackupMock,
    setRegistrationMock,
    readDraftMnemonicMock,
    deviceIdMock,
    draftState,
} = vi.hoisted(() => ({
    MNEMONIC: ['abandon', 'ability', 'able'],
    registerCloudBackupMock: vi.fn(),
    setRegistrationMock: vi.fn(),
    readDraftMnemonicMock: vi.fn(),
    deviceIdMock: vi.fn(),
    draftState: { salt: null as string | null },
}))

vi.mock('../../credentials/registerCloudBackup', () => ({
    registerCloudBackup: registerCloudBackupMock,
}))

vi.mock('../../store/draftStore', () => {
    const useCloudBackupDraftStoreMock = (
        selector: (s: {
            setRegistration: (r: unknown, salt: string) => boolean
        }) => unknown,
    ) => selector({ setRegistration: setRegistrationMock })
    useCloudBackupDraftStoreMock.getState = () => ({ salt: draftState.salt })

    return {
        readCloudBackupDraftMnemonic: readDraftMnemonicMock,
        useCloudBackupDraftStore: useCloudBackupDraftStoreMock,
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: deviceIdMock,
}))

import { isExpectedError } from '@perawallet/wallet-core-shared'
import {
    BackupDeviceIdUnavailableError,
    BackupDraftMissingError,
} from '../../../errors'
import { useRegisterCloudBackupMutation } from '../useRegisterCloudBackupMutation'

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
    draftState.salt = SALT
    setRegistrationMock.mockReturnValue(true)
    readDraftMnemonicMock.mockReturnValue(MNEMONIC)
    deviceIdMock.mockReturnValue('device-123')
    registerCloudBackupMock.mockResolvedValue({
        backupId: 'did:pera:abc',
        encryptionKey: ENCRYPTION_KEY,
        authSecretKey: AUTH_SECRET_KEY,
    })
})

describe('useRegisterCloudBackupMutation', () => {
    test('registers the drafted credentials and retains the key material', async () => {
        const { result } = renderHook(() => useRegisterCloudBackupMutation(), {
            wrapper: createWrapper(),
        })

        act(() => result.current.mutate())

        await waitFor(() => expect(setRegistrationMock).toHaveBeenCalled())
        expect(registerCloudBackupMock).toHaveBeenCalledWith({
            mnemonic: MNEMONIC,
            salt: SALT,
            deviceId: 'device-123',
            network: 'mainnet',
        })
        expect(setRegistrationMock).toHaveBeenCalledWith(
            {
                backupId: 'did:pera:abc',
                deviceId: 'device-123',
                encryptionKey: ENCRYPTION_KEY,
                authSecretKey: AUTH_SECRET_KEY,
            },
            SALT,
        )
    })

    test('rejects without a request when the draft is already gone', async () => {
        readDraftMnemonicMock.mockReturnValue(null)
        draftState.salt = null
        const onError = vi.fn()

        const { result } = renderHook(
            () => useRegisterCloudBackupMutation({ onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(readDraftMnemonicMock).toHaveBeenCalled()
        expect(draftState.salt).toBeNull()
        expect(registerCloudBackupMock).not.toHaveBeenCalled()
        expect(setRegistrationMock).not.toHaveBeenCalled()
        // A lost race, so it must not file a crash report.
        expect(onError.mock.calls[0][0]).toBeInstanceOf(BackupDraftMissingError)
        expect(isExpectedError(onError.mock.calls[0][0])).toBe(true)
    })

    test('rejects without a request when the device id is unavailable', async () => {
        deviceIdMock.mockReturnValue(undefined)
        const onError = vi.fn()

        const { result } = renderHook(
            () => useRegisterCloudBackupMutation({ onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(registerCloudBackupMock).not.toHaveBeenCalled()
        expect(setRegistrationMock).not.toHaveBeenCalled()
        // Registration is addressed to a device, so a missing id is our bug and
        // has to keep reporting.
        expect(onError.mock.calls[0][0]).toBeInstanceOf(
            BackupDeviceIdUnavailableError,
        )
        expect(isExpectedError(onError.mock.calls[0][0])).toBe(false)
    })

    // Reporting success would navigate the user onto a store-key screen with
    // no key to show and nothing to enable.
    test('fails when the store refuses the keys for a cleared draft', async () => {
        // The draft moves on mid-flight, so this also pins that the keys are
        // offered under the salt they were derived with rather than a re-read.
        registerCloudBackupMock.mockImplementation(async () => {
            draftState.salt = 'a-later-draft'
            return {
                backupId: 'did:pera:abc',
                encryptionKey: ENCRYPTION_KEY,
                authSecretKey: AUTH_SECRET_KEY,
            }
        })
        setRegistrationMock.mockReturnValue(false)
        const onSuccess = vi.fn()
        const onError = vi.fn()

        const { result } = renderHook(
            () => useRegisterCloudBackupMutation({ onSuccess, onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(setRegistrationMock).toHaveBeenCalledWith(
            expect.anything(),
            SALT,
        )
        expect(onSuccess).not.toHaveBeenCalled()
        expect(onError.mock.calls[0][0]).toBeInstanceOf(BackupDraftMissingError)
    })

    test('retains nothing when registration fails', async () => {
        registerCloudBackupMock.mockRejectedValue(new Error('network down'))
        const onError = vi.fn()

        const { result } = renderHook(
            () => useRegisterCloudBackupMutation({ onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(setRegistrationMock).not.toHaveBeenCalled()
    })
})
