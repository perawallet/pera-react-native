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

import { createElement } from 'react'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'
import { usePWScreenInsets } from '../usePWScreenInsets'

import type { ReactNode } from 'react'

describe('usePWScreenInsets', () => {
    beforeEach(() => {
        vi.mocked(useSafeAreaInsets).mockReturnValue({
            top: 47,
            bottom: 34,
            left: 0,
            right: 0,
        })
    })

    it('adds the safe-area bottom inset plus spacing outside a tab navigator', () => {
        const { result } = renderHook(() => usePWScreenInsets())

        expect(result.current.isInTabNavigator).toBe(false)
        // insets.bottom (34) + theme.spacing.lg (24 in vitest mock; 16 in production → 50)
        expect(result.current.bottomInset).toBe(58)
    })

    it('returns a zero inset inside a tab navigator to avoid double-padding', () => {
        const wrapper = ({ children }: { children: ReactNode }) =>
            createElement(
                BottomTabBarHeightContext.Provider,
                { value: 49 },
                children,
            )

        const { result } = renderHook(() => usePWScreenInsets(), { wrapper })

        expect(result.current.isInTabNavigator).toBe(true)
        expect(result.current.bottomInset).toBe(0)
    })
})
