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
import { createEmptySyncState } from '../../models'
import { useBackupSyncStateStore } from '../syncStateStore'

beforeEach(() => {
    act(() => useBackupSyncStateStore.getState().resetState())
})

describe('useBackupSyncStateStore', () => {
    test('starts with null sync state', () => {
        const { result } = renderHook(() => useBackupSyncStateStore())
        expect(result.current.syncState).toBeNull()
    })

    test('setSyncState stores the value', () => {
        const { result } = renderHook(() => useBackupSyncStateStore())
        const state = createEmptySyncState('did:pera:abc')
        act(() => result.current.setSyncState(state))
        expect(result.current.syncState?.backupId).toBe('did:pera:abc')
    })

    test('resetState clears it', () => {
        const { result } = renderHook(() => useBackupSyncStateStore())
        act(() =>
            result.current.setSyncState(createEmptySyncState('did:pera:abc')),
        )
        act(() => result.current.resetState())
        expect(result.current.syncState).toBeNull()
    })
})
