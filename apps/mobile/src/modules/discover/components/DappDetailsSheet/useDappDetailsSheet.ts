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

import { useCallback } from 'react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useOpenDapp } from '../../hooks/useOpenDapp'
import { useToggleDiscoverFavorite } from '../../hooks/useToggleDiscoverFavorite'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DirectoryDapp } from '../../utils/dappDirectory'
import { dappHostOf, normalizeDappUrl } from '../../utils/normalizeDappUrl'

/** What the sheet resolves with; a pan-down or backdrop close resolves `undefined`. */
export type DappDetailsSheetResult = 'open'

export type UseDappDetailsSheetParams = {
    item: DirectoryDapp
    chainId: Nullable<ChainId>
}

export type UseDappDetailsSheetResult = {
    isFavorite: boolean
    host: string
    toggleFavorite: () => void
    open: () => void
}

export const useDappDetailsSheet = ({
    item,
    chainId,
}: UseDappDetailsSheetParams): UseDappDetailsSheetResult => {
    const { resolve } = useBottomSheetResult<DappDetailsSheetResult>()
    const { openDapp } = useOpenDapp()
    const toggle = useToggleDiscoverFavorite()
    // Read live, so the star follows a toggle made while the sheet is open.
    const isFavorite = useDiscoverFavoritesStore(s => {
        const key = normalizeDappUrl(item.dapp.url)
        return key !== null && key in s.favorites
    })

    const toggleFavorite = useCallback(() => {
        toggle(item.dapp, chainId)
    }, [toggle, item.dapp, chainId])

    // The dApp browser opens over the stack; the sheet would sit on top of it.
    const open = useCallback(() => {
        resolve('open')
        openDapp(item.dapp, chainId)
    }, [resolve, openDapp, item.dapp, chainId])

    return {
        isFavorite,
        host: dappHostOf(item.dapp.url),
        toggleFavorite,
        open,
    }
}
