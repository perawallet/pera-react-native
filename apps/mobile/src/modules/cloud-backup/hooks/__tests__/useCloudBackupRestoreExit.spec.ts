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

const { resetMock } = vi.hoisted(() => ({ resetMock: vi.fn() }))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ reset: resetMock }),
}))

import { useCloudBackupRestoreExit } from '../useCloudBackupRestoreExit'

describe('useCloudBackupRestoreExit', () => {
    beforeEach(() => vi.clearAllMocks())

    it('resets the cloud-backup stack onto the overview', () => {
        const { result } = renderHook(() => useCloudBackupRestoreExit())

        act(() => result.current.exitToOverview())

        expect(resetMock).toHaveBeenCalledWith({
            index: 0,
            routes: [{ name: 'CloudBackupOverview' }],
        })
    })
})
