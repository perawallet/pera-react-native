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

import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useCloudBackupIntroduction } from '../useCloudBackupIntroduction'

describe('useCloudBackupIntroduction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reports isIntroductionSeen from the preference', () => {
        vi.mocked(usePreferences).mockReturnValue({
            hasPreference: vi.fn(() => false),
            getPreference: vi.fn(() => true),
            setPreference: vi.fn(),
            deletePreference: vi.fn(),
            clearAllPreferences: vi.fn(),
        })

        const { result } = renderHook(() => useCloudBackupIntroduction())

        expect(result.current.isIntroductionSeen).toBe(true)
    })

    it('calls setPreference when markIntroductionSeen is called', () => {
        const mockSetPreference = vi.fn()

        vi.mocked(usePreferences).mockReturnValue({
            hasPreference: vi.fn(() => false),
            getPreference: vi.fn(() => null),
            setPreference: mockSetPreference,
            deletePreference: vi.fn(),
            clearAllPreferences: vi.fn(),
        })

        const { result } = renderHook(() => useCloudBackupIntroduction())

        act(() => {
            result.current.markIntroductionSeen()
        })

        expect(mockSetPreference).toHaveBeenCalledWith(
            UserPreferences.cloudBackupIntroSeen,
            true,
        )
    })
})
