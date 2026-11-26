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

import {
    useCollectiblePreferencesStore,
    type CollectibleSortMode,
    type GalleryLayout,
} from '@perawallet/wallet-core-assets'

type UseNftGalleryPreferencesResult = {
    sortMode: CollectibleSortMode
    galleryLayout: GalleryLayout
    showOptedIn: boolean
    showWatchAccounts: boolean
    showSuspicious: boolean
    showHidden: boolean
    setSortMode: (mode: CollectibleSortMode) => void
    setGalleryLayout: (layout: GalleryLayout) => void
    setShowOptedIn: (value: boolean) => void
    setShowWatchAccounts: (value: boolean) => void
}

export const useNftGalleryPreferences = (): UseNftGalleryPreferencesResult => {
    const sortMode = useCollectiblePreferencesStore(
        state => state.collectibleSortMode,
    )
    const galleryLayout = useCollectiblePreferencesStore(
        state => state.galleryLayout,
    )
    const showOptedIn = useCollectiblePreferencesStore(
        state => state.showOptedIn,
    )
    const showWatchAccounts = useCollectiblePreferencesStore(
        state => state.showWatchAccounts,
    )
    const showSuspicious = useCollectiblePreferencesStore(
        state => state.showSuspicious,
    )
    const showHidden = useCollectiblePreferencesStore(state => state.showHidden)
    const setSortMode = useCollectiblePreferencesStore(
        state => state.setCollectibleSortMode,
    )
    const setGalleryLayout = useCollectiblePreferencesStore(
        state => state.setGalleryLayout,
    )
    const setShowOptedIn = useCollectiblePreferencesStore(
        state => state.setShowOptedIn,
    )
    const setShowWatchAccounts = useCollectiblePreferencesStore(
        state => state.setShowWatchAccounts,
    )

    return {
        sortMode,
        galleryLayout,
        showOptedIn,
        showWatchAccounts,
        showSuspicious,
        showHidden,
        setSortMode,
        setGalleryLayout,
        setShowOptedIn,
        setShowWatchAccounts,
    }
}
