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

import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
    useWalkPastHiddenRows,
    type UseWalkPastHiddenRowsParams,
} from '../useWalkPastHiddenRows'

const setup = (overrides: Partial<UseWalkPastHiddenRowsParams> = {}) => {
    const loadMore = vi.fn()
    const initialProps: UseWalkPastHiddenRowsParams = {
        isAllHidden: true,
        hasNextPage: true,
        isFetchingNextPage: false,
        loadedCount: 10,
        loadMore,
        ...overrides,
    }
    const hook = renderHook(
        (props: UseWalkPastHiddenRowsParams) => useWalkPastHiddenRows(props),
        { initialProps },
    )
    return { ...hook, loadMore, initialProps }
}

describe('useWalkPastHiddenRows', () => {
    it('asks for the next page while every row read is hidden', () => {
        const { loadMore } = setup()

        expect(loadMore).toHaveBeenCalledTimes(1)
    })

    it('asks once per page landed, not on every render', () => {
        const { loadMore, rerender, initialProps } = setup()

        rerender({ ...initialProps, isFetchingNextPage: true })
        rerender({ ...initialProps, isFetchingNextPage: false })
        expect(loadMore).toHaveBeenCalledTimes(1)

        rerender({ ...initialProps, loadedCount: 20 })
        expect(loadMore).toHaveBeenCalledTimes(2)
    })

    it('reads nothing while a row shows, or once the history has no more', () => {
        expect(setup({ isAllHidden: false }).loadMore).not.toHaveBeenCalled()
        expect(setup({ hasNextPage: false }).loadMore).not.toHaveBeenCalled()
    })

    it('pauses after a run of hidden pages, and Search Older resumes it', () => {
        const { loadMore, rerender, initialProps, result } = setup()
        for (const loadedCount of [20, 30, 40, 50, 60]) {
            rerender({ ...initialProps, loadedCount })
        }

        expect(loadMore).toHaveBeenCalledTimes(4)
        expect(result.current.isPaused).toBe(true)

        act(() => result.current.resume())

        expect(loadMore).toHaveBeenCalledTimes(5)
        expect(result.current.isPaused).toBe(false)
    })
})
