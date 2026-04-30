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

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@test-utils/render'
import { usePassphraseAcknowledgeBottomSheet } from '../usePassphraseAcknowledgeBottomSheet'

describe('usePassphraseAcknowledgeBottomSheet', () => {
    it('initializes with all rows unchecked and allChecked=false', () => {
        const { result } = renderHook(() =>
            usePassphraseAcknowledgeBottomSheet({
                rowCount: 4,
                isVisible: true,
            }),
        )
        expect(result.current.checked).toEqual([false, false, false, false])
        expect(result.current.allChecked).toBe(false)
    })

    it('toggles only the row at the given index', () => {
        const { result } = renderHook(() =>
            usePassphraseAcknowledgeBottomSheet({
                rowCount: 4,
                isVisible: true,
            }),
        )

        act(() => result.current.toggle(2))

        expect(result.current.checked).toEqual([false, false, true, false])
        expect(result.current.allChecked).toBe(false)
    })

    it('toggling the same row twice returns it to unchecked', () => {
        const { result } = renderHook(() =>
            usePassphraseAcknowledgeBottomSheet({
                rowCount: 4,
                isVisible: true,
            }),
        )

        act(() => result.current.toggle(1))
        act(() => result.current.toggle(1))

        expect(result.current.checked[1]).toBe(false)
    })

    it('reports allChecked=true only once every row is checked', () => {
        const { result } = renderHook(() =>
            usePassphraseAcknowledgeBottomSheet({
                rowCount: 4,
                isVisible: true,
            }),
        )

        act(() => result.current.toggle(0))
        act(() => result.current.toggle(1))
        act(() => result.current.toggle(2))
        expect(result.current.allChecked).toBe(false)

        act(() => result.current.toggle(3))
        expect(result.current.allChecked).toBe(true)
    })

    it('resets all rows when isVisible flips to false', () => {
        const { result, rerender } = renderHook(
            ({ isVisible }: { isVisible: boolean }) =>
                usePassphraseAcknowledgeBottomSheet({
                    rowCount: 4,
                    isVisible,
                }),
            { initialProps: { isVisible: true } },
        )

        act(() => result.current.toggle(0))
        act(() => result.current.toggle(1))
        expect(result.current.checked).toEqual([true, true, false, false])

        rerender({ isVisible: false })

        expect(result.current.checked).toEqual([false, false, false, false])
        expect(result.current.allChecked).toBe(false)
    })
})
