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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

const { mockInfoToast } = vi.hoisted(() => ({ mockInfoToast: vi.fn() }))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ infoToast: mockInfoToast }),
}))

vi.mock('@hooks/useLanguage')

import { useDatabaseResetNotice } from '../useDatabaseResetNotice'

const mockPreferences = (isPending: boolean) => {
    const deletePreference = vi.fn()
    vi.mocked(usePreferences).mockReturnValue({
        hasPreference: (key: string) =>
            isPending && key === UserPreferences.databaseResetNoticePending,
        deletePreference,
    } as unknown as ReturnType<typeof usePreferences>)
    return { deletePreference }
}

describe('useDatabaseResetNotice', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows the notice and clears the flag when a reset is pending', () => {
        const { deletePreference } = mockPreferences(true)

        renderHook(() => useDatabaseResetNotice())

        expect(mockInfoToast).toHaveBeenCalledWith(
            'vault.database_reset.title',
            'vault.database_reset.body',
        )
        expect(deletePreference).toHaveBeenCalledWith(
            UserPreferences.databaseResetNoticePending,
        )
    })

    it('shows nothing when no reset happened', () => {
        const { deletePreference } = mockPreferences(false)

        renderHook(() => useDatabaseResetNotice())

        expect(mockInfoToast).not.toHaveBeenCalled()
        expect(deletePreference).not.toHaveBeenCalled()
    })
})
