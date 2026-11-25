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
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { discardMock, isConfiguredMock } = vi.hoisted(() => ({
    discardMock: vi.fn(),
    isConfiguredMock: vi.fn(),
}))

vi.mock('../../restore/restoreCloudBackup', async importOriginal => ({
    ...(await importOriginal<object>()),
    discardPreparedCloudBackupRestore: discardMock,
}))
vi.mock('../../store/store', () => ({
    useCloudBackupStore: {
        getState: () => ({ isConfigured: isConfiguredMock }),
    },
}))

import { useCloudBackupRestoreSessionStore } from '../../store/restoreSessionStore'
import { useDiscardCloudBackupRestore } from '../useDiscardCloudBackupRestore'

const holdSession = () =>
    useCloudBackupRestoreSessionStore.getState().setSession({
        prepared: {} as never,
        salt: 'c2FsdA==',
        credentialsConfirmed: true,
    })

describe('useDiscardCloudBackupRestore', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        discardMock.mockResolvedValue(undefined)
        isConfiguredMock.mockReturnValue(false)
        useCloudBackupRestoreSessionStore.getState().resetState()
    })

    test('ends a waiting restore and removes its stored keys', async () => {
        holdSession()
        const { result } = renderHook(() => useDiscardCloudBackupRestore())

        await result.current.discard()

        expect(useCloudBackupRestoreSessionStore.getState().session).toBeNull()
        expect(discardMock).toHaveBeenCalledTimes(1)
    })

    test('does nothing once no restore is waiting', async () => {
        const { result } = renderHook(() => useDiscardCloudBackupRestore())

        await result.current.discard()

        expect(discardMock).not.toHaveBeenCalled()
    })

    test('never removes the keys of a configured backup', async () => {
        holdSession()
        isConfiguredMock.mockReturnValue(true)
        const { result } = renderHook(() => useDiscardCloudBackupRestore())

        await result.current.discard()

        expect(discardMock).not.toHaveBeenCalled()
        expect(useCloudBackupRestoreSessionStore.getState().session).toBeNull()
    })
})
