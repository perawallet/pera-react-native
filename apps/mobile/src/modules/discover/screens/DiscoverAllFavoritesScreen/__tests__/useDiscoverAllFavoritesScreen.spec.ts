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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOpenDapp } from '../../../hooks/useOpenDapp'
import { useDiscoverDirectory } from '../../../hooks/useDiscoverDirectory'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import { useDiscoverAllFavoritesScreen } from '../useDiscoverAllFavoritesScreen'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('../../../hooks/useOpenDapp', () => ({ useOpenDapp: vi.fn() }))
vi.mock('../../../hooks/useDiscoverDirectory', () => ({
    useDiscoverDirectory: vi.fn(),
}))

describe('useDiscoverAllFavoritesScreen', () => {
    beforeEach(() => {
        vi.mocked(useOpenDapp).mockReturnValue({ openDapp: vi.fn() } as never)
        vi.mocked(useDiscoverDirectory).mockReturnValue({
            verifiedUrls: new Set(),
        } as never)
        useDiscoverFavoritesStore.setState({
            favorites: {},
            favoriteOrder: [],
            folders: {},
            folderOrder: [],
        })
    })

    it('lists every favorite, newest first', () => {
        // Arrange
        const add = useDiscoverFavoritesStore.getState().addFavorite
        add({
            url: 'https://a.io',
            name: 'A',
            logo: null,
            categories: [],
            chains: [],
        })
        add({
            url: 'https://b.io',
            name: 'B',
            logo: null,
            categories: [],
            chains: [],
        })

        // Act
        const { result } = renderHook(() => useDiscoverAllFavoritesScreen())

        // Assert
        expect(result.current.dapps.map(d => d.name)).toEqual(['B', 'A'])
    })
})
