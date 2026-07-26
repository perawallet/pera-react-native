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
import type { Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheetStore } from '../../store/bottomSheetStore'
import { useBottomSheet } from '../useBottomSheet'

describe('useBottomSheet', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
    })

    it('exposes request, requestByType, dismiss, dismissAll', () => {
        const { result } = renderHook(() => useBottomSheet())
        expect(typeof result.current.request).toBe('function')
        expect(typeof result.current.requestByType).toBe('function')
        expect(typeof result.current.dismiss).toBe('function')
        expect(typeof result.current.dismissAll).toBe('function')
    })

    it('request() pushes onto the store and returns a promise', () => {
        const { result } = renderHook(() => useBottomSheet())
        let promise: Optional<Promise<unknown>>
        act(() => {
            promise = result.current.request({ contents: 'A' })
        })
        expect(useBottomSheetStore.getState().requests).toHaveLength(1)
        expect(promise).toBeInstanceOf(Promise)
    })

    it('dismiss() defers to the store', () => {
        const { result } = renderHook(() => useBottomSheet())
        act(() => {
            result.current.request({ id: 'x', contents: 'A' })
        })
        act(() => {
            result.current.dismiss('x')
        })
        const req = useBottomSheetStore
            .getState()
            .requests.find(r => r.id === 'x')
        expect(req?.isVisible).toBe(false)
    })
})
