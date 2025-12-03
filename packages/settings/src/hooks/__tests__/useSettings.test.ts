/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { registerTestPlatform } from '@test-utils'

describe('services/settings/useSettings', () => {
    beforeEach(() => {
        vi.resetModules()
        registerTestPlatform()
    })

    test('exposes theme and privacyMode', async () => {
        const { initSettingsStore } = await import('../../store')
        const { useSettings } = await import('../useSettings')

        initSettingsStore()

        const { result } = renderHook(() => useSettings())

        expect(result.current.theme).toBe('system')
        expect(result.current.privacyMode).toBe(false)
    })

    test('setTheme updates theme', async () => {
        const { initSettingsStore } = await import('../../store')
        const { useSettings } = await import('../useSettings')

        initSettingsStore()

        const { result } = renderHook(() => useSettings())

        act(() => {
            result.current.setTheme('dark')
        })

        expect(result.current.theme).toBe('dark')
    })

    test('setPrivacyMode updates privacy mode', async () => {
        const { initSettingsStore } = await import('../../store')
        const { useSettings } = await import('../useSettings')

        initSettingsStore()

        const { result } = renderHook(() => useSettings())

        act(() => {
            result.current.setPrivacyMode(true)
        })

        expect(result.current.privacyMode).toBe(true)
    })
})
