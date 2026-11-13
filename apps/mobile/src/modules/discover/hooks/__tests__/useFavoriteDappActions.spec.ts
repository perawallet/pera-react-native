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
import { DiscoverEvent, trackEvent } from '@analytics'
import { useToast } from '@hooks/useToast'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../../types'
import { useFavoriteDappActions } from '../useFavoriteDappActions'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('@hooks/useToast', () => ({ useToast: vi.fn() }))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: vi.fn() }),
}))
vi.mock('../useDiscoverDirectory', () => ({
    useDiscoverDirectory: () => ({ verifiedUrls: new Set<string>() }),
}))
vi.mock('../useOpenDapp', () => ({
    useOpenDapp: () => ({ openDapp: vi.fn() }),
}))

const successToast = vi.fn()

const dapp: DiscoverDapp = {
    url: 'https://a.io',
    name: 'A',
    logo: null,
    categories: [],
    chains: [],
}

describe('useFavoriteDappActions', () => {
    beforeEach(() => {
        useDiscoverFavoritesStore.setState({
            favorites: {},
            favoriteOrder: [],
            folders: {},
            folderOrder: [],
        })
        vi.clearAllMocks()
        vi.mocked(useToast).mockReturnValue({ successToast } as never)
    })

    it('unfavorite removes the dApp and tracks the unfavorite', () => {
        useDiscoverFavoritesStore.getState().toggleFavorite(dapp)
        const { result } = renderHook(() => useFavoriteDappActions())

        result.current.unfavorite(dapp)

        expect(useDiscoverFavoritesStore.getState().isFavorite(dapp.url)).toBe(
            false,
        )
        expect(trackEvent).toHaveBeenCalledWith(
            DiscoverEvent.DappUnfavoriteTap,
            { dapp_name: 'A', dapp_url: 'https://a.io' },
        )
    })

    it('a second unfavorite (a double tap) never adds the dApp back', () => {
        useDiscoverFavoritesStore.getState().toggleFavorite(dapp)
        const { result } = renderHook(() => useFavoriteDappActions())

        result.current.unfavorite(dapp)
        result.current.unfavorite(dapp)

        expect(useDiscoverFavoritesStore.getState().isFavorite(dapp.url)).toBe(
            false,
        )
        expect(successToast).not.toHaveBeenCalled()
        expect(trackEvent).not.toHaveBeenCalledWith(
            DiscoverEvent.DappFavoriteTap,
            expect.anything(),
        )
    })
})
