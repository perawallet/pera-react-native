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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, beforeEach } from 'vitest'
import { useBottomSheetStore } from '../../store/bottomSheetStore'
import { useBottomSheetStack } from '../useBottomSheetStack'

describe('useBottomSheetStack', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
    })

    it('reflects requests and exposes remove + dismissAll', () => {
        const { result } = renderHook(() => useBottomSheetStack())
        expect(result.current.requests).toEqual([])
        expect(typeof result.current.remove).toBe('function')
        expect(typeof result.current.dismissAll).toBe('function')
    })

    it('updates as requests are pushed', () => {
        const { result } = renderHook(() => useBottomSheetStack())
        act(() => {
            useBottomSheetStore.getState().request({ id: 'A', contents: 'A' })
        })
        expect(result.current.requests).toHaveLength(1)
        expect(result.current.requests[0].id).toBe('A')
    })

    it('remove() pops the entry through the store', () => {
        const { result } = renderHook(() => useBottomSheetStack())
        act(() => {
            useBottomSheetStore.getState().request({ id: 'A', contents: 'A' })
        })
        act(() => {
            result.current.remove('A')
        })
        expect(result.current.requests).toHaveLength(0)
    })
})
