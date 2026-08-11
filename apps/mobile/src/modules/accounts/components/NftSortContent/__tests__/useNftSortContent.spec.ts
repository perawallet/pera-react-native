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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@test-utils/render'
import { useNftSortContent } from '../useNftSortContent'

const h = vi.hoisted(() => ({
    state: {
        collectibleSortMode: 'newestFirst',
        setCollectibleSortMode: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useCollectiblePreferencesStore: (selector: (state: unknown) => unknown) =>
        selector(h.state),
}))

describe('useNftSortContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        h.state.collectibleSortMode = 'newestFirst'
    })

    it('initialises the draft from the stored sort mode', () => {
        const { result } = renderHook(() => useNftSortContent())

        expect(result.current.sortMode).toBe('newestFirst')
    })

    it('updates the draft without writing to the store on selection', () => {
        const { result } = renderHook(() => useNftSortContent())

        act(() => result.current.handleSortModeChange('titleAsc'))

        expect(result.current.sortMode).toBe('titleAsc')
        expect(h.state.setCollectibleSortMode).not.toHaveBeenCalled()
    })

    it('writes the draft to the store only on commit', () => {
        const { result } = renderHook(() => useNftSortContent())

        act(() => result.current.handleSortModeChange('recentlyAdded'))
        act(() => result.current.commitChanges())

        expect(h.state.setCollectibleSortMode).toHaveBeenCalledTimes(1)
        expect(h.state.setCollectibleSortMode).toHaveBeenCalledWith(
            'recentlyAdded',
        )
    })
})
