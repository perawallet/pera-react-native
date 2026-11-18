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

import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { act, renderHook } from '@test-utils/render'
import { PWSheetSizeContext } from '../../PWBottomSheet/sheetSizeContext'
import type { PWBottomSheetSize } from '../../PWBottomSheet'
import { usePWSheetLayoutFooter } from '../usePWSheetLayoutFooter'

const inSheet =
    (size: PWBottomSheetSize) =>
    ({ children }: { children: ReactNode }) => (
        <PWSheetSizeContext.Provider value={size}>
            {children}
        </PWSheetSizeContext.Provider>
    )

const layoutOf = (height: number) =>
    ({
        nativeEvent: { layout: { x: 0, y: 0, width: 300, height } },
    }) as LayoutChangeEvent

describe('usePWSheetLayoutFooter', () => {
    it('overlays a footer in an auto sheet and insets by its height', () => {
        const { result } = renderHook(() => usePWSheetLayoutFooter(true), {
            wrapper: inSheet('auto'),
        })
        expect(result.current.overlaysFooter).toBe(true)
        expect(result.current.footerInset).toBe(0)

        act(() => result.current.onFooterLayout(layoutOf(80)))

        expect(result.current.footerInset).toBe(80)
    })

    it('follows the footer when its height changes', () => {
        const { result } = renderHook(() => usePWSheetLayoutFooter(true), {
            wrapper: inSheet('auto'),
        })

        act(() => result.current.onFooterLayout(layoutOf(80)))
        act(() => result.current.onFooterLayout(layoutOf(124)))

        expect(result.current.footerInset).toBe(124)
    })

    it('keeps the stacked footer in a modal or full sheet', () => {
        for (const size of ['modal', 'full'] as const) {
            const { result } = renderHook(() => usePWSheetLayoutFooter(true), {
                wrapper: inSheet(size),
            })

            act(() => result.current.onFooterLayout(layoutOf(80)))

            expect(result.current.overlaysFooter).toBe(false)
            expect(result.current.footerInset).toBe(0)
        }
    })

    it('keeps the stacked footer outside a sheet', () => {
        const { result } = renderHook(() => usePWSheetLayoutFooter(true))
        expect(result.current.overlaysFooter).toBe(false)
    })

    it('has nothing to overlay without a footer', () => {
        const { result } = renderHook(() => usePWSheetLayoutFooter(false), {
            wrapper: inSheet('auto'),
        })
        expect(result.current.overlaysFooter).toBe(false)
    })
})
