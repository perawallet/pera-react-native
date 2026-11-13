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
import { generateUniqueId } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import { useDiscoverAllFoldersScreen } from '../useDiscoverAllFoldersScreen'

vi.mock('@hooks/useAppNavigation', () => ({ useAppNavigation: vi.fn() }))

const navigate = vi.fn()

describe('useDiscoverAllFoldersScreen', () => {
    beforeEach(() => {
        let next = 0
        vi.mocked(generateUniqueId).mockImplementation(() => `folder-${++next}`)
        vi.mocked(useAppNavigation).mockReturnValue({ navigate } as never)
        useDiscoverFavoritesStore.setState({
            favorites: {},
            favoriteOrder: [],
            folders: {},
            folderOrder: [],
        })
    })

    it('lists every folder newest first with counts and opens one', () => {
        // Arrange
        const store = useDiscoverFavoritesStore.getState()
        ;['A', 'B', 'C', 'D', 'E'].forEach(name => store.createFolder(name))

        // Act
        const { result } = renderHook(() => useDiscoverAllFoldersScreen())
        result.current.openFolder('folder-2')

        // Assert
        expect(result.current.folders.map(f => f.name)).toEqual([
            'E',
            'D',
            'C',
            'B',
            'A',
        ])
        expect(result.current.folders[0]).toEqual({
            id: 'folder-5',
            name: 'E',
            count: 0,
        })
        expect(navigate).toHaveBeenCalledWith('DiscoverFolder', {
            folderId: 'folder-2',
        })
    })
})
