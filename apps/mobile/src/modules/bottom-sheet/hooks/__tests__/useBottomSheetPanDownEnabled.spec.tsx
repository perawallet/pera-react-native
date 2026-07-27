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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, beforeEach } from 'vitest'

import { useBottomSheetStore } from '../../store/bottomSheetStore'
import { BottomSheetIdContext } from '../../components/BottomSheetHost/BottomSheetIdContext'
import { useBottomSheetPanDownEnabled } from '../useBottomSheetPanDownEnabled'

import type { ReactNode } from 'react'

const wrapWithId = (id: string | null) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <BottomSheetIdContext.Provider value={id}>
                {children}
            </BottomSheetIdContext.Provider>
        )
    }

describe('useBottomSheetPanDownEnabled', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
    })

    it('returns true when the host sheet enabled pan-down', () => {
        useBottomSheetStore.getState().request({
            id: 'x',
            contents: 'A',
            options: { enablePanDownToClose: true },
        })
        const { result } = renderHook(() => useBottomSheetPanDownEnabled(), {
            wrapper: wrapWithId('x'),
        })
        expect(result.current).toBe(true)
    })

    it('returns false when pan-down is disabled or unset', () => {
        useBottomSheetStore.getState().request({ id: 'x', contents: 'A' })
        const { result } = renderHook(() => useBottomSheetPanDownEnabled(), {
            wrapper: wrapWithId('x'),
        })
        expect(result.current).toBe(false)
    })

    it('returns false outside a managed sheet', () => {
        const { result } = renderHook(() => useBottomSheetPanDownEnabled(), {
            wrapper: wrapWithId(null),
        })
        expect(result.current).toBe(false)
    })
})
