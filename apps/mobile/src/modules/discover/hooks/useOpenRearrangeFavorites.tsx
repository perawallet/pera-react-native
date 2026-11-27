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
import { useBottomSheet } from '@modules/bottom-sheet'
import { RearrangeFavoritesSheet } from '../components/RearrangeFavoritesSheet'

// Full height and no pan gestures, so a drag never fights the sheet.
const REARRANGE_SHEET_OPTIONS = {
    size: 'modal',
    enablePanDownToClose: false,
    enableContentPanningGesture: false,
    autoCreateContainer: false,
} as const

export type UseOpenRearrangeFavoritesResult = () => void

/** Opens the sheet that reorders and removes favorites. */
export const useOpenRearrangeFavorites =
    (): UseOpenRearrangeFavoritesResult => {
        const { request } = useBottomSheet()

        return useCallback(() => {
            void request({
                contents: <RearrangeFavoritesSheet />,
                options: REARRANGE_SHEET_OPTIONS,
            })
        }, [request])
    }
