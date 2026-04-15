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

import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useSettingsStore } from '../../store'
import { useTooltipSeen } from '../useTooltipSeen'
import { usePreferences } from '../usePreferences'

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

describe('services/settings/useTooltipSeen', () => {
    beforeEach(() => {
        useSettingsStore.getState().resetState()
    })

    test('hasSeen returns false for unseen tooltip', () => {
        const { result } = renderHook(() => useTooltipSeen())

        expect(result.current.hasSeen('swap-intro')).toBe(false)
    })

    test('markSeen persists tooltip id and hasSeen returns true', () => {
        const { result } = renderHook(() => useTooltipSeen())

        act(() => {
            result.current.markSeen('swap-intro')
        })

        expect(result.current.hasSeen('swap-intro')).toBe(true)
    })

    test('reset clears a previously seen tooltip', () => {
        const { result } = renderHook(() => useTooltipSeen())

        act(() => {
            result.current.markSeen('swap-intro')
        })
        expect(result.current.hasSeen('swap-intro')).toBe(true)

        act(() => {
            result.current.reset('swap-intro')
        })
        expect(result.current.hasSeen('swap-intro')).toBe(false)
    })

    test('different ids are tracked independently', () => {
        const { result } = renderHook(() => useTooltipSeen())

        act(() => {
            result.current.markSeen('swap-intro')
        })

        expect(result.current.hasSeen('swap-intro')).toBe(true)
        expect(result.current.hasSeen('privacy-mode')).toBe(false)
    })

    test('tooltip keys are namespaced and do not collide with raw preferences', () => {
        const { result: tooltipResult } = renderHook(() => useTooltipSeen())
        const { result: prefResult } = renderHook(() => usePreferences())

        act(() => {
            tooltipResult.current.markSeen('swap-intro')
        })

        expect(prefResult.current.hasPreference('swap-intro')).toBe(false)
        expect(
            prefResult.current.hasPreference('tooltip-seen:swap-intro'),
        ).toBe(true)
    })
})
