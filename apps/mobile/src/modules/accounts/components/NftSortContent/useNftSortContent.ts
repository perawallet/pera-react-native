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
import {
    useCollectiblePreferencesStore,
    type CollectibleSortMode,
} from '@perawallet/wallet-core-assets'

type UseNftSortContentResult = {
    sortMode: CollectibleSortMode
    handleSortModeChange: (mode: CollectibleSortMode) => void
    commitChanges: () => void
}

export const useNftSortContent = (): UseNftSortContentResult => {
    const sortMode = useCollectiblePreferencesStore(
        state => state.collectibleSortMode,
    )
    const setSortMode = useCollectiblePreferencesStore(
        state => state.setCollectibleSortMode,
    )

    const [draftSortMode, setDraftSortMode] = useState(sortMode)

    const handleSortModeChange = useCallback((mode: CollectibleSortMode) => {
        setDraftSortMode(mode)
    }, [])

    const commitChanges = useCallback(() => {
        setSortMode(draftSortMode)
    }, [draftSortMode, setSortMode])

    return {
        sortMode: draftSortMode,
        handleSortModeChange,
        commitChanges,
    }
}
