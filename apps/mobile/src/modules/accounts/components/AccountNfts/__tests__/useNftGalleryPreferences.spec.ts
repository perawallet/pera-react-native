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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCollectiblePreferencesStore } from '@perawallet/wallet-core-assets'
import { useNftGalleryPreferences } from '../useNftGalleryPreferences'

// The shared setup stubs this store; the hook is only worth testing against the real one.
vi.mock('@perawallet/wallet-core-assets', async importOriginal =>
    importOriginal(),
)

describe('useNftGalleryPreferences', () => {
    beforeEach(() => {
        useCollectiblePreferencesStore.getState().resetState()
    })

    it('follows the stored preferences and writes them back through its setters', () => {
        const { result } = renderHook(() => useNftGalleryPreferences())

        act(() => {
            result.current.setSortMode('titleDesc')
            result.current.setGalleryLayout('list')
            result.current.setShowOptedIn(true)
            result.current.setShowWatchAccounts(true)
        })

        expect(result.current).toMatchObject({
            sortMode: 'titleDesc',
            galleryLayout: 'list',
            showOptedIn: true,
            showWatchAccounts: true,
        })
        expect(useCollectiblePreferencesStore.getState()).toMatchObject({
            collectibleSortMode: 'titleDesc',
            galleryLayout: 'list',
        })
    })
})
