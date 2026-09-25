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

import { useSettingsStore } from '../../store'
import { useSettings } from '../useSettings'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

describe('services/settings/useSettings', () => {
    beforeEach(() => {
        useSettingsStore.getState().resetState()
    })

    test('exposes theme and privacyMode', () => {
        const { result } = renderHook(() => useSettings())

        expect(result.current.theme).toBe('system')
        expect(result.current.privacyMode).toBe(false)
    })

    test('setTheme updates theme', () => {
        const { result } = renderHook(() => useSettings())

        act(() => {
            result.current.setTheme('dark')
        })

        expect(result.current.theme).toBe('dark')
    })

    test('setPrivacyMode updates privacy mode', () => {
        const { result } = renderHook(() => useSettings())

        act(() => {
            result.current.setPrivacyMode(true)
        })

        expect(result.current.privacyMode).toBe(true)
    })

    test('exposes language and setLanguage', () => {
        const { result } = renderHook(() => useSettings())

        expect(result.current.language).toBe('system')

        act(() => {
            result.current.setLanguage('de')
        })

        expect(result.current.language).toBe('de')
    })
})
