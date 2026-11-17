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
import { trackEvent, HomeEvent } from '@analytics'
import { useModalState } from '@hooks/useModalState'
import { useBottomSheet } from '@modules/bottom-sheet'
import { PasteLinkContent } from '@modules/menu'

export type UseAccountHeaderToolbarResult = {
    isScannerOpen: boolean
    openScanner: () => void
    closeScanner: () => void
    openPasteLink: () => void
}

/** The account header's QR scanner and paste-link actions, with their events. */
export const useAccountHeaderToolbar = (): UseAccountHeaderToolbarResult => {
    const scanner = useModalState()
    const { request } = useBottomSheet()

    const openScanner = useCallback(() => {
        trackEvent(HomeEvent.QrScan)
        scanner.open()
    }, [scanner])

    const openPasteLink = useCallback(() => {
        trackEvent(HomeEvent.PasteLink)
        void request({
            contents: <PasteLinkContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [request])

    return {
        isScannerOpen: scanner.isOpen,
        openScanner,
        closeScanner: scanner.close,
        openPasteLink,
    }
}
