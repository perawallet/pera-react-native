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
import { AccountDetailsEvent } from '@analytics'

import { useAccountTabNavigator } from '../useAccountTabNavigator'

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn() }))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mocks.trackEvent,
}))

describe('useAccountTabNavigator', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('starts on the first tab with only that page mounted', () => {
        const { result } = renderHook(() => useAccountTabNavigator())

        expect(result.current.index).toBe(0)
        expect(result.current.isPageVisited(0)).toBe(true)
        expect(result.current.isPageVisited(1)).toBe(false)
        expect(result.current.isPageVisited(2)).toBe(false)
    })

    it('keeps a page mounted after leaving it, so returning is instant', () => {
        const { result } = renderHook(() => useAccountTabNavigator())

        act(() => result.current.handleIndexChange(1))
        act(() => result.current.handleIndexChange(2))

        expect(result.current.index).toBe(2)
        expect(result.current.isPageVisited(1)).toBe(true)
        expect(result.current.isPageVisited(2)).toBe(true)
    })

    it('reports the tab that was opened', () => {
        const { result } = renderHook(() => useAccountTabNavigator())

        act(() => result.current.handleIndexChange(2))

        expect(mocks.trackEvent).toHaveBeenCalledWith(
            AccountDetailsEvent.History,
        )
    })
})
