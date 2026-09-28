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

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStableIdList } from '../useStableIdList'

describe('useStableIdList', () => {
    it('keeps the first reference when a new array holds the same ids', () => {
        const { result, rerender } = renderHook(
            ({ ids }: { ids: string[] }) => useStableIdList(ids),
            { initialProps: { ids: ['1', '2', '3'] } },
        )
        const first = result.current

        rerender({ ids: ['1', '2', '3'] })

        expect(result.current).toBe(first)
    })

    it('adopts the new array when an id changes', () => {
        const { result, rerender } = renderHook(
            ({ ids }: { ids: string[] }) => useStableIdList(ids),
            { initialProps: { ids: ['1', '2', '3'] } },
        )

        rerender({ ids: ['1', '2', '4'] })

        expect(result.current).toEqual(['1', '2', '4'])
    })

    it('adopts the new array when the length changes', () => {
        const { result, rerender } = renderHook(
            ({ ids }: { ids: string[] }) => useStableIdList(ids),
            { initialProps: { ids: ['1', '2'] } },
        )

        rerender({ ids: ['1', '2', '3'] })

        expect(result.current).toEqual(['1', '2', '3'])
    })

    it('treats reordering as a change', () => {
        const { result, rerender } = renderHook(
            ({ ids }: { ids: string[] }) => useStableIdList(ids),
            { initialProps: { ids: ['1', '2'] } },
        )

        rerender({ ids: ['2', '1'] })

        expect(result.current).toEqual(['2', '1'])
    })
})
