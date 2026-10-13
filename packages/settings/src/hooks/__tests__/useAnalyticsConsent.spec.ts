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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

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

import { useSettingsStore } from '../../store'
import { useAnalyticsConsent } from '../useAnalyticsConsent'

describe('useAnalyticsConsent', () => {
    beforeEach(() => {
        useSettingsStore.getState().resetState()
    })

    test('is unanswered by default', () => {
        const { result } = renderHook(() => useAnalyticsConsent())

        expect(result.current.consent).toBeNull()
    })

    test('stores the answer', () => {
        const { result } = renderHook(() => useAnalyticsConsent())

        act(() => result.current.setConsent('granted'))

        expect(result.current.consent).toBe('granted')
    })

    test('treats an unrecognised stored value as unanswered', () => {
        useSettingsStore.getState().setPreference('analyticsConsent', 'yes')
        const { result } = renderHook(() => useAnalyticsConsent())

        expect(result.current.consent).toBeNull()
    })
})
