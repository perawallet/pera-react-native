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
import { useBottomSheetSize } from '../useBottomSheetSize'

import type { ReactNode } from 'react'

const wrapWithId = (id: string | null) =>
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <BottomSheetIdContext.Provider value={id}>
                {children}
            </BottomSheetIdContext.Provider>
        )
    }

describe('useBottomSheetSize', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
    })

    it('returns the size the host sheet was opened with', () => {
        useBottomSheetStore.getState().request({
            id: 'x',
            contents: 'A',
            options: { size: 'modal' },
        })
        const { result } = renderHook(() => useBottomSheetSize(), {
            wrapper: wrapWithId('x'),
        })
        expect(result.current).toBe('modal')
    })

    it('returns undefined when no size was set', () => {
        useBottomSheetStore.getState().request({ id: 'x', contents: 'A' })
        const { result } = renderHook(() => useBottomSheetSize(), {
            wrapper: wrapWithId('x'),
        })
        expect(result.current).toBeUndefined()
    })

    it('returns undefined outside a managed sheet', () => {
        const { result } = renderHook(() => useBottomSheetSize(), {
            wrapper: wrapWithId(null),
        })
        expect(result.current).toBeUndefined()
    })
})
