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

import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBackupSyncActivityStore } from '../syncActivityStore'

beforeEach(() => {
    act(() => useBackupSyncActivityStore.getState().resetState())
})

describe('useBackupSyncActivityStore', () => {
    test('starts idle and follows setIsSyncing', () => {
        const { result } = renderHook(() => useBackupSyncActivityStore())
        expect(result.current.isSyncing).toBe(false)

        act(() => result.current.setIsSyncing(true))

        expect(result.current.isSyncing).toBe(true)
    })

    test('holds no persist middleware, so a sync cannot outlive the process', () => {
        act(() => useBackupSyncActivityStore.getState().setIsSyncing(true))

        expect(
            (useBackupSyncActivityStore as unknown as { persist?: unknown })
                .persist,
        ).toBeUndefined()
    })

    test('resetState clears the flag', () => {
        const { result } = renderHook(() => useBackupSyncActivityStore())
        act(() => result.current.setIsSyncing(true))

        act(() => result.current.resetState())

        expect(result.current.isSyncing).toBe(false)
    })
})
