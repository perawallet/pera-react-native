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
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../../types'
import { useToggleDiscoverFavorite } from '../useToggleDiscoverFavorite'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))

const dapp: DiscoverDapp = {
    url: 'https://a.io',
    name: 'A',
    logo: null,
    categories: [],
    chains: [],
}

describe('useToggleDiscoverFavorite', () => {
    beforeEach(() => {
        useDiscoverFavoritesStore.setState({ favorites: {}, favoriteOrder: [] })
        vi.mocked(trackEvent).mockClear()
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
})
