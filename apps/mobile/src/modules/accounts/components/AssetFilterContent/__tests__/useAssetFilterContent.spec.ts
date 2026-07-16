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
import { useAssetFilterContent } from '../useAssetFilterContent'

const h = vi.hoisted(() => ({
    state: {
        hideZeroBalance: false,
        displayNfts: true,
        displayOptedInNfts: false,
        setHideZeroBalance: vi.fn(),
        setDisplayNfts: vi.fn(),
        setDisplayOptedInNfts: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPreferencesStore: (selector: (state: unknown) => unknown) =>
        selector(h.state),
}))

describe('useAssetFilterContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        h.state.hideZeroBalance = false
        h.state.displayNfts = true
        h.state.displayOptedInNfts = false
    })

    it('initialises the draft from the stored preferences', () => {
        const { result } = renderHook(() => useAssetFilterContent())

        expect(result.current.hideZeroBalance).toBe(false)
        expect(result.current.displayNfts).toBe(true)
        expect(result.current.displayOptedInNfts).toBe(false)
    })

    it('toggles update the draft without writing to the store', () => {
        const { result } = renderHook(() => useAssetFilterContent())

        act(() => result.current.handleToggleHideZeroBalance())
        act(() => result.current.handleToggleDisplayNfts())

        expect(result.current.hideZeroBalance).toBe(true)
        expect(result.current.displayNfts).toBe(false)
        expect(h.state.setHideZeroBalance).not.toHaveBeenCalled()
        expect(h.state.setDisplayNfts).not.toHaveBeenCalled()
    })

    it('writes all draft toggles to the store only on commit', () => {
        const { result } = renderHook(() => useAssetFilterContent())

        act(() => result.current.handleToggleHideZeroBalance())
        act(() => result.current.handleToggleDisplayOptedInNfts())
        act(() => result.current.commitChanges())

        expect(h.state.setHideZeroBalance).toHaveBeenCalledWith(true)
        expect(h.state.setDisplayNfts).toHaveBeenCalledWith(true)
        expect(h.state.setDisplayOptedInNfts).toHaveBeenCalledWith(true)
    })
})
