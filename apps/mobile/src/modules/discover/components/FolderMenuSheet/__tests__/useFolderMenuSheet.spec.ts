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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useFolderMenuSheet } from '../useFolderMenuSheet'

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(),
}))

const resolve = vi.fn()

describe('useFolderMenuSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useBottomSheetResult).mockReturnValue({
            resolve,
            dismiss: vi.fn(),
        } as never)
    })

    it('lists rename, rearrange, delete in that order', () => {
        const { result } = renderHook(() =>
            useFolderMenuSheet({ hasDapps: true }),
        )

        expect(result.current.items.map(i => i.choice)).toEqual([
            'rename',
            'rearrange',
            'delete',
        ])
        expect(result.current.items.map(i => i.isDestructive)).toEqual([
            false,
            false,
            true,
        ])
    })

    it('leaves out rearrange for an empty folder', () => {
        const { result } = renderHook(() =>
            useFolderMenuSheet({ hasDapps: false }),
        )

        expect(result.current.items.map(i => i.choice)).toEqual([
            'rename',
            'delete',
        ])
    })

    it('resolves the chosen item', () => {
        const { result } = renderHook(() =>
            useFolderMenuSheet({ hasDapps: true }),
        )

        act(() => result.current.choose('delete'))

        expect(resolve).toHaveBeenCalledWith('delete')
    })
})
