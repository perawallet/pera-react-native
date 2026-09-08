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

/** Only the two callbacks the wrapper supplies; the mutation itself is covered
 *  by the package's own spec. */
type MutationCallbacks<TData> = {
    onSuccess?: (data: TData) => void
    onError?: (error: Error) => void
}
const { showToastMock, resetMock, mutateMock, capturedOptions } = vi.hoisted(
    () => ({
        showToastMock: vi.fn(),
        resetMock: vi.fn(),
        mutateMock: vi.fn(),
        capturedOptions: {
            value: null as MutationCallbacks<{ remoteOk: boolean }> | null,
        },
    }),
)

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ reset: resetMock }),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useRemoveCloudBackupMutation: (options: never) => {
        capturedOptions.value = options
        return { mutate: mutateMock, isPending: false }
    },
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useRemoveCloudBackup } from '../useRemoveCloudBackup'

const succeed = (remoteOk: boolean) =>
    act(() => capturedOptions.value?.onSuccess?.({ remoteOk }))

beforeEach(() => {
    vi.clearAllMocks()
    capturedOptions.value = null
})

describe('useRemoveCloudBackup', () => {
    test('confirms and navigates home when the remote backup is gone', () => {
        renderHook(() => useRemoveCloudBackup())

        succeed(true)

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.turn_off_and_remove.success',
                type: 'success',
            }),
        )
        expect(resetMock).toHaveBeenCalledWith({
            index: 0,
            routes: [{ name: 'CloudBackupHome' }],
        })
    })

    test('still navigates home but flags the orphaned remote backup', () => {
        renderHook(() => useRemoveCloudBackup())

        succeed(false)

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.turn_off_and_remove.partial',
                type: 'error',
            }),
        )
        expect(resetMock).toHaveBeenCalledWith({
            index: 0,
            routes: [{ name: 'CloudBackupHome' }],
        })
    })

    test('stays put when the local teardown itself fails', () => {
        renderHook(() => useRemoveCloudBackup())

        act(() => capturedOptions.value?.onError?.(new Error('keystore down')))

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.turn_off_and_remove.error',
                type: 'error',
            }),
        )
        expect(resetMock).not.toHaveBeenCalled()
    })
})
