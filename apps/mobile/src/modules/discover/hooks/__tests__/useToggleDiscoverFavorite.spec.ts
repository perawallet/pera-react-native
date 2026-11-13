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
import { useBottomSheet } from '@modules/bottom-sheet'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../../types'
import { useToggleDiscoverFavorite } from '../useToggleDiscoverFavorite'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('@hooks/useToast', () => ({ useToast: vi.fn() }))
vi.mock('@modules/bottom-sheet', () => ({ useBottomSheet: vi.fn() }))

const successToast = vi.fn()
const request = vi.fn()

/** The onPress the toast was shown with. */
const toastOnPress = (): (() => void) => {
    const options = successToast.mock.calls.at(-1)?.[2] as {
        onPress: () => void
    }
    return options.onPress
}

const dapp: DiscoverDapp = {
    url: 'https://a.io',
    name: 'A',
    logo: null,
    categories: [],
    chains: [],
}

describe('useToggleDiscoverFavorite', () => {
    beforeEach(() => {
        useDiscoverFavoritesStore.setState({
            favorites: {},
            favoriteOrder: [],
            folders: {},
            folderOrder: [],
        })
        vi.clearAllMocks()
        vi.mocked(useToast).mockReturnValue({ successToast } as never)
        vi.mocked(useBottomSheet).mockReturnValue({ request } as never)
    })

    it('favorites then unfavorites, tracking each', () => {
        const { result } = renderHook(() => useToggleDiscoverFavorite())
        expect(result.current(dapp, 'algorand')).toBe(true)
        expect(trackEvent).toHaveBeenLastCalledWith(
            DiscoverEvent.DappFavoriteTap,
            { dapp_name: 'A', dapp_url: 'https://a.io', chain_id: 'algorand' },
        )
        expect(result.current(dapp, 'algorand')).toBe(false)
        expect(trackEvent).toHaveBeenLastCalledWith(
            DiscoverEvent.DappUnfavoriteTap,
            { dapp_name: 'A', dapp_url: 'https://a.io', chain_id: 'algorand' },
        )
    })

    it('leaves chain_id out when no chain is selected', () => {
        const { result } = renderHook(() => useToggleDiscoverFavorite())
        result.current(dapp, null)
        const payload = vi.mocked(trackEvent).mock.calls[0]?.[1]
        expect(payload).toEqual({ dapp_name: 'A', dapp_url: 'https://a.io' })
        expect(payload).not.toHaveProperty('chain_id')
    })

    it('starring shows the added toast', () => {
        const { result } = renderHook(() => useToggleDiscoverFavorite())

        result.current(dapp, null)

        expect(successToast).toHaveBeenCalledWith(
            'discover.favorites.added_toast.title',
            'discover.favorites.added_toast.body',
            expect.objectContaining({ onPress: expect.any(Function) }),
        )
    })

    it('unstarring shows no toast', () => {
        const { result } = renderHook(() => useToggleDiscoverFavorite())
        result.current(dapp, null)
        successToast.mockClear()

        result.current(dapp, null)

        expect(successToast).not.toHaveBeenCalled()
    })

    it('tapping the toast opens Add to folder for that dApp and tracks it', () => {
        const { result } = renderHook(() => useToggleDiscoverFavorite())
        result.current(dapp, null)

        toastOnPress()()

        expect(request).toHaveBeenCalledTimes(1)
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.FavoriteToastTap)
    })

    it('tapping the toast after unstarring opens nothing', () => {
        const { result } = renderHook(() => useToggleDiscoverFavorite())
        result.current(dapp, null)
        const onPress = toastOnPress()
        result.current(dapp, null)

        onPress()

        expect(request).not.toHaveBeenCalled()
    })
})
