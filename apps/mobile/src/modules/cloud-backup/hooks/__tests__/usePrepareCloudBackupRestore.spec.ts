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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { mutateMock, navigateMock, lockMock, showToastMock, state } = vi.hoisted(
    () => ({
        mutateMock: vi.fn(),
        navigateMock: vi.fn(),
        lockMock: vi.fn(),
        showToastMock: vi.fn(),
        state: {
            options: null as null | {
                onSuccess: () => void
                onError: (error: unknown) => void
                onSettled: () => void
            },
        },
    }),
)

vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<object>()),
    usePrepareCloudBackupRestoreMutation: (
        options: NonNullable<typeof state.options>,
    ) => {
        state.options = options
        return { mutate: mutateMock, isPending: false }
    },
}))
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: navigateMock }),
}))
vi.mock('@hooks/useNavigationLock', () => ({
    useNavigationLock: (isLocked: boolean) => {
        lockMock(isLocked)
        return { allowProgrammaticNavigation: vi.fn() }
    },
}))
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { usePrepareCloudBackupRestore } from '../usePrepareCloudBackupRestore'

describe('usePrepareCloudBackupRestore', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        state.options = null
    })

    it('locks leaving the screen from the call until the prepare settles', () => {
        const { result } = renderHook(() => usePrepareCloudBackupRestore())
        expect(lockMock).toHaveBeenLastCalledWith(false)

        act(() =>
            result.current.prepare({
                salt: 'c2FsdA==',
                credentialsConfirmed: true,
            }),
        )

        expect(lockMock).toHaveBeenLastCalledWith(true)
        expect(mutateMock).toHaveBeenCalledWith({
            salt: 'c2FsdA==',
            credentialsConfirmed: true,
        })

        act(() => state.options?.onSettled())

        expect(lockMock).toHaveBeenLastCalledWith(false)
    })

    it('opens the account choice once the backup is downloaded', () => {
        renderHook(() => usePrepareCloudBackupRestore())

        act(() => state.options?.onSuccess())

        expect(navigateMock).toHaveBeenCalledWith(
            'CloudBackupRestoreSelectAccounts',
        )
    })

    it('toasts a failed prepare', () => {
        renderHook(() => usePrepareCloudBackupRestore())

        act(() => state.options?.onError(new Error('boom')))

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })
})
