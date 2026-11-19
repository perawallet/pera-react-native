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

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSharedValue } from 'react-native-reanimated'
import { isPageOnScreen, useIsPageOnScreen } from '../useIsPageOnScreen'

describe('isPageOnScreen', () => {
    it('shows only the settled page at rest', () => {
        expect(isPageOnScreen(1, 1)).toBe(true)
        expect(isPageOnScreen(1, 0)).toBe(false)
        expect(isPageOnScreen(1, 2)).toBe(false)
    })

    it('shows both neighbouring pages mid-swipe', () => {
        expect(isPageOnScreen(0.3, 0)).toBe(true)
        expect(isPageOnScreen(0.3, 1)).toBe(true)
        expect(isPageOnScreen(0.3, 2)).toBe(false)
    })
})

describe('useIsPageOnScreen', () => {
    it('starts on screen, as a page mounts on its first visit', () => {
        const { result } = renderHook(() =>
            useIsPageOnScreen(useSharedValue(1), 1),
        )

        expect(result.current).toBe(true)
    })
})
