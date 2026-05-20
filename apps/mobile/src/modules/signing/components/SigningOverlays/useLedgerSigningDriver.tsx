/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import React, { useEffect, useRef } from 'react'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    isInteractiveSource,
    useHardwareSigning,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { LedgerSigningContent } from '../LedgerSigningContent'
import { useLedgerSigningContent } from '../LedgerSigningContent/useLedgerSigningContent'

/**
 * Watches the hardware-wallet signing store for an active session and shows
 * the LedgerSigningContent sheet via the centralized bottom sheet manager.
 *
 * The sheet visibility is gated by the content hook's `isVisible` derivation
 * AND by the active request's source type: headless (`'local'`) callers
 * own their own Ledger UI (e.g. `TransactionProcessingScreen` renders the
 * awaiting/error content inline), so opening a second stacked sheet would
 * cover the originating sheet for no benefit. Only interactive sources
 * (WalletConnect, deeplinks, multisig-cosign, etc.) need the overlay.
 *
 * Presentation matches the legacy overlay: `size='auto'`, gestures and
 * backdrop press disabled — signing must complete via the UI controls.
 */
export const useLedgerSigningDriver = (): void => {
    const { requestId } = useHardwareSigning()
    const { isVisible } = useLedgerSigningContent()
    const { pendingSignRequests } = useSigningRequest()
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    const openIdRef = useRef<string | null>(null)

    const activeRequest = pendingSignRequests.find(r => r.id === requestId)
    const isInteractive = activeRequest
        ? isInteractiveSource(activeRequest.sourceType)
        : false

    useEffect(() => {
        const sheetId =
            isVisible && requestId && isInteractive ? requestId : null

        if (!sheetId) {
            if (openIdRef.current) {
                dismiss(openIdRef.current)
                openIdRef.current = null
            }
            return
        }
        if (openIdRef.current === sheetId) return

        if (openIdRef.current) {
            dismiss(openIdRef.current)
        }
        openIdRef.current = sheetId

        let cancelled = false
        void (async () => {
            await requestBottomSheet<void>({
                id: sheetId,
                contents: <LedgerSigningContent />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                    autoCreateContainer: false,
                },
            })
            if (cancelled) return
            if (openIdRef.current === sheetId) {
                openIdRef.current = null
            }
        })()
        return () => {
            cancelled = true
        }
    }, [isVisible, requestId, isInteractive, requestBottomSheet, dismiss])
}
