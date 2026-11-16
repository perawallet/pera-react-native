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

    it('lists folders newest first and marks the ones holding the dApp', () => {
        const holding = store().createFolder('Swap', URL)
        const other = store().createFolder('NFTs')

        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        expect(result.current.dappName).toBe('Tinyman')
        expect(result.current.folders).toEqual([
            { id: other, name: 'NFTs', holdsDapp: false },
            { id: holding, name: 'Swap', holdsDapp: true },
        ])
    })

    it('choose adds the dApp, tracks it and resolves with the folder name', () => {
        const id = store().createFolder('Swap')
        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        act(() => result.current.choose(id))

        expect(store().folders[id]?.items).toEqual([URL])
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.FolderDappAdd)
        expect(resolve).toHaveBeenCalledWith({ folderName: 'Swap' })
    })

    it('choose on a folder that already holds the dApp does nothing', () => {
        const id = store().createFolder('Swap', URL)
        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        act(() => result.current.choose(id))

        expect(store().folders[id]?.items).toEqual([URL])
        expect(trackEvent).not.toHaveBeenCalled()
        expect(resolve).not.toHaveBeenCalled()
    })

    it('choose on a folder that is gone does nothing', () => {
        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        act(() => result.current.choose('missing'))

        expect(trackEvent).not.toHaveBeenCalled()
        expect(resolve).not.toHaveBeenCalled()
    })

    it('never removes the dApp from a folder', () => {
        const first = store().createFolder('Swap', URL)
        const second = store().createFolder('NFTs')
        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        act(() => result.current.choose(second))

        expect(store().folders[first]?.items).toEqual([URL])
        expect(store().folders[second]?.items).toEqual([URL])
        expect(trackEvent).not.toHaveBeenCalledWith(
            DiscoverEvent.FolderDappRemove,
        )
    })

    it('a new folder is created holding the dApp and resolves with its name', async () => {
        request.mockResolvedValue('NFTs')
        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        await act(() => result.current.openNewFolder())

        expect(store().folders['folder-1']).toMatchObject({
            name: 'NFTs',
            items: [URL],
        })
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.FolderCreate)
        expect(resolve).toHaveBeenCalledWith({ folderName: 'NFTs' })
    })

    it('a dismissed name sheet creates nothing and keeps the sheet open', async () => {
        request.mockResolvedValue(undefined)
        const { result } = renderHook(() => useAddToFolderSheet({ url: URL }))

        await act(() => result.current.openNewFolder())

        expect(store().folderOrder).toEqual([])
        expect(resolve).not.toHaveBeenCalled()
        expect(dismiss).not.toHaveBeenCalled()
    })

    it('closes itself when the dApp is no longer a favorite', () => {
        renderHook(() => useAddToFolderSheet({ url: URL }))

        act(() => store().removeFavorite(URL))

        expect(dismiss).toHaveBeenCalledTimes(1)
    })
})
