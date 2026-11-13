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
import type { Optional } from '@perawallet/wallet-core-shared'
import { DiscoverEvent, trackEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    FolderNameSheet,
    type FolderNameSheetResult,
} from '../components/FolderNameSheet'
import { useDiscoverFavoritesStore } from '../store/useDiscoverFavoritesStore'

/**
 * Asks for a folder name and creates the folder (holding `initialUrl` when given).
 * Resolves the new folder's id, or `undefined` when the name sheet was dismissed.
 */
export const useCreateFolder = (): ((
    initialUrl?: string,
) => Promise<Optional<string>>) => {
    const { request } = useBottomSheet()
    const createFolder = useDiscoverFavoritesStore(s => s.createFolder)
    return useCallback(
        async (initialUrl?: string) => {
            const name = await request<FolderNameSheetResult>({
                contents: <FolderNameSheet mode='create' />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (name === undefined) return undefined
            const id = createFolder(name, initialUrl)
            trackEvent(DiscoverEvent.FolderCreate)
            return id
        },
        [request, createFolder],
    )
}
