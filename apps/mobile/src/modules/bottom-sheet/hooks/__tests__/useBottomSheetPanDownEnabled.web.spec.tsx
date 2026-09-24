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
// Import the exact web filename — vitest has no Metro platform resolution.
import { useBottomSheetPanDownEnabled } from '../useBottomSheetPanDownEnabled.web'

import type { ReactNode } from 'react'

const Wrapper = ({ children }: { children: ReactNode }) => (
    <BottomSheetIdContext.Provider value='x'>
        {children}
    </BottomSheetIdContext.Provider>
)

describe('useBottomSheetPanDownEnabled.web', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
    })

    it('reports pan-down off even when the sheet asked for it, since web has no swipe', () => {
        useBottomSheetStore.getState().request({
            id: 'x',
            contents: 'A',
            options: { enablePanDownToClose: true },
        })

        const { result } = renderHook(() => useBottomSheetPanDownEnabled(), {
            wrapper: Wrapper,
        })

        expect(result.current).toBe(false)
    })
})
