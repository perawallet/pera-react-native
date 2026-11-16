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
import { useRoute } from '@react-navigation/native'
import { generateUniqueId } from '@perawallet/wallet-core-shared'
import { DiscoverEvent, trackEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useOpenDapp } from '../../../hooks/useOpenDapp'
import { useDiscoverDirectory } from '../../../hooks/useDiscoverDirectory'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../../../types'
import { useDiscoverFolderScreen } from '../useDiscoverFolderScreen'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('@react-navigation/native', async () => ({
    ...(await vi.importActual<object>('@react-navigation/native')),
    useRoute: vi.fn(),
}))
vi.mock('@hooks/useAppNavigation', () => ({ useAppNavigation: vi.fn() }))
vi.mock('../../../hooks/useOpenDapp', () => ({ useOpenDapp: vi.fn() }))
vi.mock('../../../hooks/useDiscoverDirectory', () => ({
    useDiscoverDirectory: vi.fn(),
}))

const goBack = vi.fn()
const openDapp = vi.fn()

const dapp = (url: string, name: string): DiscoverDapp => ({
    url,
    name,
    logo: null,
    categories: [],
    chains: [],
})

const store = () => useDiscoverFavoritesStore.getState()

const route = (folderId: string) =>
    vi.mocked(useRoute).mockReturnValue({ params: { folderId } } as never)

describe('useDiscoverFolderScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        let next = 0
        vi.mocked(generateUniqueId).mockImplementation(() => `folder-${++next}`)
        vi.mocked(useAppNavigation).mockReturnValue({ goBack } as never)
        vi.mocked(useOpenDapp).mockReturnValue({ openDapp } as never)
        vi.mocked(useDiscoverDirectory).mockReturnValue({
            verifiedUrls: new Set(['https://b.io']),
        } as never)
        useDiscoverFavoritesStore.setState({
            favorites: {},
            favoriteOrder: [],
            folders: {},
            folderOrder: [],
        })
    })

    it("lists the folder's dApps in folder order with its name and count", () => {
        // Arrange
        store().addFavorite(dapp('https://a.io', 'A'))
        store().addFavorite(dapp('https://b.io', 'B'))
        const id = store().createFolder('Swap', 'https://b.io')
        store().setDappInFolder(id, 'https://a.io', true)
        route(id)

        // Act
        const { result } = renderHook(() => useDiscoverFolderScreen())

        // Assert
        expect(result.current.folder).toEqual({ id, name: 'Swap', count: 2 })
        expect(result.current.dapps.map(d => d.name)).toEqual(['B', 'A'])
        expect(result.current.isVerified('https://B.io/')).toBe(true)
        expect(result.current.isVerified('https://a.io')).toBe(false)
    })

    it('goes back once when the folder no longer exists', () => {
        // Arrange
        route('gone')

        // Act
        const { result, rerender } = renderHook(() => useDiscoverFolderScreen())
        rerender()

        // Assert
        expect(result.current.folder).toBeNull()
        expect(goBack).toHaveBeenCalledTimes(1)
    })

    it('unfavorite removes the dApp everywhere and tracks it', () => {
        // Arrange
        store().addFavorite(dapp('https://a.io', 'A'))
        const id = store().createFolder('Swap', 'https://a.io')
        route(id)
        const { result } = renderHook(() => useDiscoverFolderScreen())

        // Act
        act(() => result.current.unfavorite(result.current.dapps[0]!))

        // Assert
        expect(store().isFavorite('https://a.io')).toBe(false)
        expect(result.current.dapps).toEqual([])
        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.DappUnfavoriteTap,
            expect.anything(),
        )
    })

    it('opens a dApp in the in-app browser', () => {
        store().addFavorite(dapp('https://a.io', 'A'))
        const id = store().createFolder('Swap', 'https://a.io')
        route(id)
        const { result } = renderHook(() => useDiscoverFolderScreen())

        result.current.openDapp(result.current.dapps[0]!)

        expect(openDapp).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://a.io' }),
            null,
        )
    })
})
