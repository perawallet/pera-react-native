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
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
    consent: null as 'granted' | 'denied' | null,
    setConsent: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useAnalyticsConsent: () => ({
        consent: mocks.consent,
        setConsent: mocks.setConsent,
    }),
}))

import { useSettingsAdvancedScreen } from '../useSettingsAdvancedScreen'

describe('useSettingsAdvancedScreen', () => {
    beforeEach(() => {
        mocks.consent = null
        mocks.setConsent.mockClear()
    })

    it('shows analytics as off until consent is granted', () => {
        expect(
            renderHook(() => useSettingsAdvancedScreen()).result.current
                .isAnalyticsEnabled,
        ).toBe(false)

        mocks.consent = 'granted'
        expect(
            renderHook(() => useSettingsAdvancedScreen()).result.current
                .isAnalyticsEnabled,
        ).toBe(true)
    })

    it('stores the toggle as a consent answer', () => {
        const { result } = renderHook(() => useSettingsAdvancedScreen())

        act(() => result.current.handleAnalyticsToggle(true))
        act(() => result.current.handleAnalyticsToggle(false))

        expect(mocks.setConsent.mock.calls).toEqual([['granted'], ['denied']])
    })
})
