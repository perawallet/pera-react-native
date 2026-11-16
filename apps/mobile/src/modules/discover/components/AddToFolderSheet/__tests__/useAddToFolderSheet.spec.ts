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
import { DiscoverEvent, trackEvent } from '@analytics'
import { useBottomSheet, useBottomSheetResult } from '@modules/bottom-sheet'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import { useAddToFolderSheet } from '../useAddToFolderSheet'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: vi.fn(),
    useBottomSheetResult: vi.fn(),
}))

const request = vi.fn()
const resolve = vi.fn()
const dismiss = vi.fn()
const URL = 'https://tinyman.example'

const store = () => useDiscoverFavoritesStore.getState()

describe('useAddToFolderSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        let next = 0
        vi.mocked(generateUniqueId).mockImplementation(() => `folder-${++next}`)
        vi.mocked(useBottomSheet).mockReturnValue({ request } as never)
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
        store().addFavorite({
            url: URL,
            name: 'Tinyman',
            logo: null,
            categories: [],
            chains: [],
        })
    })

    it('lists folders newest first and checks the ones holding the dApp', () => {
        // Arrange
        const holding = store().createFolder('Swap', URL)
        const other = store().createFolder('NFTs')

        // Act
        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        // Assert
        expect(result.current.dappName).toBe('Tinyman')
        expect(result.current.folders).toEqual([
            { id: other, name: 'NFTs', checked: false },
            { id: holding, name: 'Swap', checked: true },
        ])
    })

    it('toggle files and unfiles the dApp immediately and tracks it', () => {
        // Arrange
        const id = store().createFolder('Swap')
        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        // Act
        act(() => result.current.toggle(id))

        // Assert
        expect(store().folders[id]?.items).toEqual([URL])
        expect(result.current.folders[0]?.checked).toBe(true)
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.FolderDappAdd)

        act(() => result.current.toggle(id))
        expect(store().folders[id]?.items).toEqual([])
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.FolderDappRemove)
    })

    it('a new folder is created holding the dApp', async () => {
        // Arrange
        request.mockResolvedValue('Swap')
        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        // Act
        await act(() => result.current.openNewFolder())

        // Assert
        expect(store().folders['folder-1']).toMatchObject({
            name: 'Swap',
            items: [URL],
        })
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.FolderCreate)
    })

    it('a dismissed name sheet creates nothing', async () => {
        request.mockResolvedValue(undefined)
        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        await act(() => result.current.openNewFolder())

        expect(store().folderOrder).toEqual([])
    })

    it('closes itself when the dApp is no longer a favorite', () => {
        // Arrange
        renderHook(() => useAddToFolderSheet({ url: URL }))

        // Act
        act(() => store().removeFavorite(URL))

        // Assert
        expect(dismiss).toHaveBeenCalledTimes(1)
    })

    it('done resolves the sheet', () => {
        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        result.current.done()

        expect(resolve).toHaveBeenCalledWith('done')
    })
})
