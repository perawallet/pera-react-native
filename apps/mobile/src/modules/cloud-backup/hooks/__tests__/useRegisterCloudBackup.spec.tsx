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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

type MutationCallbacks = {
    onSuccess?: (data: { backupId: string }) => void
    onError?: (error: Error) => void
}

const { showToastMock, replaceMock, mutateMock, capturedOptions } = vi.hoisted(
    () => ({
        showToastMock: vi.fn(),
        replaceMock: vi.fn(),
        mutateMock: vi.fn(),
        capturedOptions: { value: null as MutationCallbacks | null },
    }),
)

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ replace: replaceMock }),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useRegisterCloudBackupMutation: (options: never) => {
        capturedOptions.value = options
        return { mutate: mutateMock, isPending: false }
    },
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('@hooks/useLanguage')

import { useRegisterCloudBackup } from '../useRegisterCloudBackup'

beforeEach(() => {
    vi.clearAllMocks()
    capturedOptions.value = null
})

describe('useRegisterCloudBackup', () => {
    test('replaces the verify screen with the store-key screen on success', () => {
        renderHook(() => useRegisterCloudBackup())

        act(() =>
            capturedOptions.value?.onSuccess?.({ backupId: 'did:pera:abc' }),
        )

        expect(replaceMock).toHaveBeenCalledWith(
            'CloudBackupStoreEncryptionKey',
        )
        expect(showToastMock).not.toHaveBeenCalled()
    })

    test('shows an error toast and stays put on failure', () => {
        renderHook(() => useRegisterCloudBackup())

        act(() => capturedOptions.value?.onError?.(new Error('network down')))

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.enable.error',
                type: 'error',
            }),
        )
        expect(replaceMock).not.toHaveBeenCalled()
    })
})
