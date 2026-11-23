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

import { createElement, type ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'
import { PWScreenNestedContext } from '../nestedContext'
import { useScrollEndGap } from '../useScrollEndGap'

const inTabs = ({ children }: { children: ReactNode }) =>
    createElement(BottomTabBarHeightContext.Provider, { value: 49 }, children)

const inPWScreen = ({ children }: { children: ReactNode }) =>
    createElement(PWScreenNestedContext.Provider, { value: true }, children)

describe('useScrollEndGap', () => {
    beforeEach(() => {
        vi.mocked(useSafeAreaInsets).mockReturnValue({
            top: 47,
            bottom: 34,
            left: 0,
            right: 0,
        })
    })

    it('clears the home indicator on a bare screen but not under the tab bar', () => {
        const bare = renderHook(() => useScrollEndGap()).result.current
        const tab = renderHook(() => useScrollEndGap(), { wrapper: inTabs })
            .result.current

        expect(tab).toBeGreaterThan(0)
        expect(bare).toBe(tab + 34)
    })

    it('adds nothing inside a PWScreen, whose body already ends with the gap', () => {
        const { result } = renderHook(() => useScrollEndGap(), {
            wrapper: inPWScreen,
        })

        expect(result.current).toBe(0)
    })

    it('clears the home indicator in a sheet, but not twice inside a PWScreen there', () => {
        const bare = renderHook(() => useScrollEndGap()).result.current
        const sheet = renderHook(() => useScrollEndGap({ isInSheet: true }), {
            wrapper: inTabs,
        }).result.current
        const nestedInSheet = renderHook(
            () => useScrollEndGap({ isInSheet: true }),
            {
                wrapper: inPWScreen,
            },
        ).result.current

        expect(sheet).toBe(bare)
        expect(nestedInSheet).toBe(0)
    })

    it('keeps only the home-indicator inset for a full-bleed body', () => {
        const bare = renderHook(() => useScrollEndGap({ hasGap: false })).result
            .current
        const tab = renderHook(() => useScrollEndGap({ hasGap: false }), {
            wrapper: inTabs,
        }).result.current

        expect(bare).toBe(34)
        expect(tab).toBe(0)
    })

    it('leaves the inset to whatever sits below when told to', () => {
        const tab = renderHook(() => useScrollEndGap(), { wrapper: inTabs })
            .result.current
        const sheet = renderHook(() =>
            useScrollEndGap({ isInSheet: true, hasBottomInset: false }),
        ).result.current

        expect(sheet).toBe(tab)
    })
})
