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
import { useCloudBackupStore } from '../store'

beforeEach(() => {
    act(() => useCloudBackupStore.getState().resetState())
})

describe('useCloudBackupStore', () => {
    test('starts unconfigured', () => {
        const { result } = renderHook(() => useCloudBackupStore())
        expect(result.current.isConfigured()).toBe(false)
        expect(result.current.backupId).toBeNull()
    })

    test('setConfigured stores identity and flips isConfigured', () => {
        const { result } = renderHook(() => useCloudBackupStore())
        act(() =>
            result.current.setConfigured({
                backupId: 'did:pera:abc',
                salt: 'c2FsdA==',
            }),
        )
        expect(result.current.backupId).toBe('did:pera:abc')
        expect(result.current.salt).toBe('c2FsdA==')
        expect(result.current.isConfigured()).toBe(true)
    })

    test('resetState clears identity', () => {
        const { result } = renderHook(() => useCloudBackupStore())
        act(() =>
            result.current.setConfigured({
                backupId: 'did:pera:abc',
                salt: 'c2FsdA==',
            }),
        )
        act(() => result.current.resetState())
        expect(result.current.isConfigured()).toBe(false)
    })
})
