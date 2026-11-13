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
import { DiscoverEvent, trackEvent } from '@analytics'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useOpenDapp } from '../../../hooks/useOpenDapp'
import { useDiscoverFavoritesStore } from '../../../store/useDiscoverFavoritesStore'
import type { DirectoryDapp } from '../../../utils/dappDirectory'
import { useDappDetailsSheet } from '../useDappDetailsSheet'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('@modules/bottom-sheet', () => ({ useBottomSheetResult: vi.fn() }))
vi.mock('../../../hooks/useOpenDapp', () => ({ useOpenDapp: vi.fn() }))

const calls: string[] = []
const resolve = vi.fn((value: unknown) =>
    calls.push(`resolve:${String(value)}`),
)
const openDapp = vi.fn(() => calls.push('open'))

const item: DirectoryDapp = {
    dapp: {
        url: 'https://app.tinyman.org/swap',
        name: 'Tinyman',
        logo: null,
        categories: ['DEX'],
        chains: ['algorand'],
    },
    description: 'A DEX',
    backgroundImage: null,
    popularityScore: 5,
}

const setup = () =>
    renderHook(() => useDappDetailsSheet({ item, chainId: 'algorand' }))

describe('useDappDetailsSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        calls.length = 0
        useDiscoverFavoritesStore.setState({ favorites: {}, favoriteOrder: [] })
        vi.mocked(useBottomSheetResult).mockReturnValue({
            resolve,
            dismiss: vi.fn(),
        })
        vi.mocked(useOpenDapp).mockReturnValue({
            openDapp,
            openWebPage: vi.fn(),
        })
    })

    it('names the host of the dApp url', () => {
        expect(setup().result.current.host).toBe('app.tinyman.org')
    })

    it('reflects and toggles the favorite, tracking each tap', () => {
        const { result } = setup()
        expect(result.current.isFavorite).toBe(false)
        act(() => result.current.toggleFavorite())
        expect(result.current.isFavorite).toBe(true)
        expect(trackEvent).toHaveBeenLastCalledWith(
            DiscoverEvent.DappFavoriteTap,
            {
                dapp_name: 'Tinyman',
                dapp_url: 'https://app.tinyman.org/swap',
                chain_id: 'algorand',
            },
        )
        act(() => result.current.toggleFavorite())
        expect(result.current.isFavorite).toBe(false)
        expect(trackEvent).toHaveBeenLastCalledWith(
            DiscoverEvent.DappUnfavoriteTap,
            expect.objectContaining({ dapp_name: 'Tinyman' }),
        )
    })

    it('open resolves the sheet as opened, then opens the dApp on the chain', () => {
        const { result } = setup()
        act(() => result.current.open())
        expect(calls).toEqual(['resolve:open', 'open'])
        expect(openDapp).toHaveBeenCalledWith(item.dapp, 'algorand')
    })
})
