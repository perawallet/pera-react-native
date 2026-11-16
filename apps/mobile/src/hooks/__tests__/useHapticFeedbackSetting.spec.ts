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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { UserPreferences } from '@constants/user-preferences'

const mocks = vi.hoisted(() => ({
    getPreference: vi.fn(),
    setPreference: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: () => ({
        getPreference: mocks.getPreference,
        setPreference: mocks.setPreference,
    }),
    useSettingsStore: {
        getState: () => ({ getPreference: mocks.getPreference }),
    },
}))

import {
    isHapticFeedbackEnabled,
    useHapticFeedbackSetting,
} from '../useHapticFeedbackSetting'

describe('useHapticFeedbackSetting', () => {
    beforeEach(() => {
        mocks.getPreference.mockReset()
        mocks.setPreference.mockReset()
    })

    it('is on when nothing is stored', () => {
        mocks.getPreference.mockReturnValue(null)

        const { result } = renderHook(() => useHapticFeedbackSetting())

        expect(result.current.isEnabled).toBe(true)
    })

    it('is off only for a stored false', () => {
        mocks.getPreference.mockImplementation((key: string) =>
            key === UserPreferences.hapticFeedbackEnabled ? false : null,
        )

        const { result } = renderHook(() => useHapticFeedbackSetting())

        expect(result.current.isEnabled).toBe(false)
    })

    it('writes the choice to the persisted preference', () => {
        const { result } = renderHook(() => useHapticFeedbackSetting())

        result.current.setIsEnabled(false)
        result.current.setIsEnabled(true)

        expect(mocks.setPreference.mock.calls).toEqual([
            [UserPreferences.hapticFeedbackEnabled, false],
            [UserPreferences.hapticFeedbackEnabled, true],
        ])
    })

    it('reads the stored value on demand: on when unset, off only for false', () => {
        mocks.getPreference.mockReturnValue(null)
        expect(isHapticFeedbackEnabled()).toBe(true)

        mocks.getPreference.mockReturnValue(false)
        expect(isHapticFeedbackEnabled()).toBe(false)

        mocks.getPreference.mockReturnValue(true)
        expect(isHapticFeedbackEnabled()).toBe(true)
    })
})
