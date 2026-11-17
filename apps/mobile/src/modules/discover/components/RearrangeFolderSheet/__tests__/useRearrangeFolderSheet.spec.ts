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
import { generateUniqueId } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import { useRearrangeFolderSheet } from '../useRearrangeFolderSheet'

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(),
}))

const resolve = vi.fn()
const dismiss = vi.fn()
const K1 = 'https://one.example'
const K2 = 'https://two.example'

const store = () => useDiscoverFavoritesStore.getState()
const keysOf = (entries: { key: string }[]) => entries.map(e => e.key)

describe('useRearrangeFolderSheet', () => {
    let folderId: string

    beforeEach(() => {
        vi.clearAllMocks()
        let next = 0
        vi.mocked(generateUniqueId).mockImplementation(() => `folder-${++next}`)
        vi.mocked(useBottomSheetResult).mockReturnValue({
            resolve,
            dismiss,
        } as never)
        useDiscoverFavoritesStore.setState({
            favorites: {},
            favoriteOrder: [],
            folders: {},
            folderOrder: [],
        })
        for (const url of [K1, K2]) {
            store().addFavorite({
                url,
                name: url,
                logo: null,
                categories: [],
                chains: [],
            })
        }
        folderId = store().createFolder('Swap')
        store().setDappInFolder(folderId, K1, true)
        store().setDappInFolder(folderId, K2, true)
    })

    it('starts with the folder dApps in folder order', () => {
        const { result } = renderHook(() =>
            useRearrangeFolderSheet({ folderId }),
        )

        expect(keysOf(result.current.entries)).toEqual([K1, K2])
    })

    it('reorders the working list', () => {
        const { result } = renderHook(() =>
            useRearrangeFolderSheet({ folderId }),
        )

        act(() => result.current.reorder([K2, K1]))

        expect(keysOf(result.current.entries)).toEqual([K2, K1])
        expect(store().folders[folderId]?.items).toEqual([K1, K2])
    })

    it('removes a dApp from the working list only', () => {
        const { result } = renderHook(() =>
            useRearrangeFolderSheet({ folderId }),
        )

        act(() => result.current.remove(K1))

        expect(keysOf(result.current.entries)).toEqual([K2])
        expect(store().folders[folderId]?.items).toEqual([K1, K2])
        expect(store().isFavorite(K1)).toBe(true)
    })

    it('resolves the working order on done', () => {
        const { result } = renderHook(() =>
            useRearrangeFolderSheet({ folderId }),
        )

        act(() => result.current.reorder([K2, K1]))
        act(() => result.current.remove(K1))
        act(() => result.current.done())

        expect(resolve).toHaveBeenCalledWith([K2])
    })

    it('waits for a settling drop before resolving done', () => {
        // Done tapped between finger lift and onDragEnd must save the dropped
        // order, not the order from before the drag.
        const { result } = renderHook(() =>
            useRearrangeFolderSheet({ folderId }),
        )

        act(() => result.current.beginDrag())
        act(() => result.current.done())
        expect(resolve).not.toHaveBeenCalled()

        act(() => result.current.reorder([K2, K1]))

        expect(resolve).toHaveBeenCalledTimes(1)
        expect(resolve).toHaveBeenCalledWith([K2, K1])
    })

    it('resolves at once when no drag is settling', () => {
        const { result } = renderHook(() =>
            useRearrangeFolderSheet({ folderId }),
        )

        act(() => result.current.beginDrag())
        act(() => result.current.reorder([K2, K1]))
        act(() => result.current.done())

        expect(resolve).toHaveBeenCalledTimes(1)
        expect(resolve).toHaveBeenCalledWith([K2, K1])
    })

    it("resolves the folder's own keys, even when a url no longer normalises to its key", () => {
        // A stored favorite whose url would not normalise back to its key.
        useDiscoverFavoritesStore.setState(state => ({
            favorites: {
                ...state.favorites,
                'legacy-key': {
                    url: 'not a url',
                    name: 'Legacy',
                    logo: null,
                    categories: [],
                    chains: [],
                    addedAt: 1,
                },
            },
            folders: {
                ...state.folders,
                [folderId]: {
                    ...state.folders[folderId]!,
                    items: ['legacy-key', K1],
                },
            },
        }))
        const { result } = renderHook(() =>
            useRearrangeFolderSheet({ folderId }),
        )

        act(() => result.current.done())

        expect(resolve).toHaveBeenCalledWith(['legacy-key', K1])
    })

    it('dismisses on cancel without touching the store', () => {
        const { result } = renderHook(() =>
            useRearrangeFolderSheet({ folderId }),
        )

        act(() => result.current.remove(K1))
        act(() => result.current.cancel())

        expect(dismiss).toHaveBeenCalledTimes(1)
        expect(resolve).not.toHaveBeenCalled()
        expect(store().folders[folderId]?.items).toEqual([K1, K2])
    })
})
