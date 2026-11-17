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

import { isValidElement, type ReactElement } from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateUniqueId } from '@perawallet/wallet-core-shared'
import { DiscoverEvent, trackEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { FolderNameSheet } from '../../components/FolderNameSheet'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import { useFolderMenu } from '../useFolderMenu'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('@modules/bottom-sheet', async () => ({
    ...(await vi.importActual<object>('@modules/bottom-sheet')),
    useBottomSheet: vi.fn(),
}))

const request = vi.fn()
const K1 = 'https://one.example'
const K2 = 'https://two.example'
const store = () => useDiscoverFavoritesStore.getState()

/** Queues what each opened sheet resolves with, in order. */
const sheetsResolve = (...values: unknown[]) => {
    for (const value of values) request.mockResolvedValueOnce(value)
}

describe('useFolderMenu', () => {
    let folderId: string

    beforeEach(() => {
        vi.clearAllMocks()
        request.mockReset()
        let next = 0
        vi.mocked(generateUniqueId).mockImplementation(() => `folder-${++next}`)
        vi.mocked(useBottomSheet).mockReturnValue({ request } as never)
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

    const openMenu = async () => {
        const { result } = renderHook(() => useFolderMenu(folderId))
        await act(() => result.current.openMenu())
    }

    it('renames with the name sheet prefilled', async () => {
        sheetsResolve('rename', 'New name')

        await openMenu()

        const contents = request.mock.calls[1]?.[0].contents as ReactElement<{
            mode: string
            initialName: string
        }>
        expect(isValidElement(contents) && contents.type).toBe(FolderNameSheet)
        expect(contents.props).toMatchObject({
            mode: 'rename',
            initialName: 'Swap',
        })
        expect(store().folders[folderId]?.name).toBe('New name')
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.FolderRename)
    })

    it('saves the rearranged order', async () => {
        sheetsResolve('rearrange', [K2])

        await openMenu()

        expect(store().folders[folderId]?.items).toEqual([K2])
        expect(store().isFavorite(K1)).toBe(true)
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.FolderRearrange, {
            removed_count: 1,
        })
    })

    it('deletes after confirm, keeping the favorites', async () => {
        sheetsResolve('delete', true)

        await openMenu()

        expect(store().folders[folderId]).toBeUndefined()
        expect(store().isFavorite(K1)).toBe(true)
        expect(store().isFavorite(K2)).toBe(true)
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.FolderDelete)
    })

    it.each([
        ['the menu', [undefined]],
        ['the name sheet', ['rename', undefined]],
        ['the rearrange sheet', ['rearrange', undefined]],
        ['the delete confirm', ['delete', undefined]],
    ])('does nothing when %s is dismissed', async (_, values) => {
        sheetsResolve(...values)
        const before = store().folders[folderId]

        await openMenu()

        expect(store().folders[folderId]).toBe(before)
        expect(trackEvent).not.toHaveBeenCalled()
    })

    it('is a no-op when the folder is gone before the action', async () => {
        request.mockResolvedValueOnce('rename').mockImplementationOnce(() => {
            store().deleteFolder(folderId)
            return Promise.resolve('New name')
        })

        await openMenu()

        expect(store().folders[folderId]).toBeUndefined()
        expect(trackEvent).not.toHaveBeenCalled()
    })
})
