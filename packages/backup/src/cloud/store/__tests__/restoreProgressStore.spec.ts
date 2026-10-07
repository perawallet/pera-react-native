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
import { act } from '@testing-library/react'
import { useCloudBackupRestoreProgressStore } from '../restoreProgressStore'

beforeEach(() => {
    act(() => useCloudBackupRestoreProgressStore.getState().resetState())
})

describe('useCloudBackupRestoreProgressStore', () => {
    test('starts with no restore running and follows setProgress', () => {
        expect(
            useCloudBackupRestoreProgressStore.getState().progress,
        ).toBeNull()

        act(() =>
            useCloudBackupRestoreProgressStore
                .getState()
                .setProgress({ phase: 'importing', done: 3, total: 10 }),
        )

        expect(useCloudBackupRestoreProgressStore.getState().progress).toEqual({
            phase: 'importing',
            done: 3,
            total: 10,
        })
    })

    test('resetState clears a running restore', () => {
        act(() =>
            useCloudBackupRestoreProgressStore
                .getState()
                .setProgress({ phase: 'unlocking' }),
        )

        act(() => useCloudBackupRestoreProgressStore.getState().resetState())

        expect(
            useCloudBackupRestoreProgressStore.getState().progress,
        ).toBeNull()
    })
})
