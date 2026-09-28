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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
    isDarkMode: false,
    getTheme: vi.fn((mode: 'light' | 'dark') => ({ mode })),
}))

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: () => mocks.isDarkMode,
}))
vi.mock('@theme/theme', () => ({
    getTheme: mocks.getTheme,
}))

import { useAppTheme } from '../useAppTheme'

describe('useAppTheme', () => {
    beforeEach(() => {
        mocks.isDarkMode = false
        mocks.getTheme.mockClear()
    })

    it('keeps the same theme object across renders while the mode is unchanged', () => {
        const { result, rerender } = renderHook(() => useAppTheme())
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
        expect(mocks.getTheme).toHaveBeenCalledTimes(1)
        expect(mocks.getTheme).toHaveBeenCalledWith('light')
    })

    it('rebuilds the theme when dark mode flips', () => {
        const { result, rerender } = renderHook(() => useAppTheme())
        const light = result.current

        mocks.isDarkMode = true
        rerender()

        expect(result.current).not.toBe(light)
        expect(mocks.getTheme).toHaveBeenLastCalledWith('dark')
    })
})
