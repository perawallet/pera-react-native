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

import { useCallback, useState } from 'react'
import { useAssetPreferencesStore } from '@perawallet/wallet-core-assets'

type UseAssetFilterContentResult = {
    hideZeroBalance: boolean
    displayNfts: boolean
    displayOptedInNfts: boolean
    handleToggleHideZeroBalance: () => void
    handleToggleDisplayNfts: () => void
    handleToggleDisplayOptedInNfts: () => void
    commitChanges: () => void
}

export const useAssetFilterContent = (): UseAssetFilterContentResult => {
    const hideZeroBalance = useAssetPreferencesStore(
        state => state.hideZeroBalance,
    )
    const displayNfts = useAssetPreferencesStore(state => state.displayNfts)
    const displayOptedInNfts = useAssetPreferencesStore(
        state => state.displayOptedInNfts,
    )
    const setHideZeroBalance = useAssetPreferencesStore(
        state => state.setHideZeroBalance,
    )
    const setDisplayNfts = useAssetPreferencesStore(
        state => state.setDisplayNfts,
    )
    const setDisplayOptedInNfts = useAssetPreferencesStore(
        state => state.setDisplayOptedInNfts,
    )

    const [draftHideZeroBalance, setDraftHideZeroBalance] =
        useState(hideZeroBalance)
    const [draftDisplayNfts, setDraftDisplayNfts] = useState(displayNfts)
    const [draftDisplayOptedInNfts, setDraftDisplayOptedInNfts] =
        useState(displayOptedInNfts)

    const handleToggleHideZeroBalance = useCallback(() => {
        setDraftHideZeroBalance(prev => !prev)
    }, [])

    const handleToggleDisplayNfts = useCallback(() => {
        setDraftDisplayNfts(prev => !prev)
    }, [])

    const handleToggleDisplayOptedInNfts = useCallback(() => {
        setDraftDisplayOptedInNfts(prev => !prev)
    }, [])

    const commitChanges = useCallback(() => {
        setHideZeroBalance(draftHideZeroBalance)
        setDisplayNfts(draftDisplayNfts)
        setDisplayOptedInNfts(draftDisplayOptedInNfts)
    }, [
        draftHideZeroBalance,
        draftDisplayNfts,
        draftDisplayOptedInNfts,
        setHideZeroBalance,
        setDisplayNfts,
        setDisplayOptedInNfts,
    ])

    return {
        hideZeroBalance: draftHideZeroBalance,
        displayNfts: draftDisplayNfts,
        displayOptedInNfts: draftDisplayOptedInNfts,
        handleToggleHideZeroBalance,
        handleToggleDisplayNfts,
        handleToggleDisplayOptedInNfts,
        commitChanges,
    }
}
