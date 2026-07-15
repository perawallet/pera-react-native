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

import { useCallback, useEffect } from 'react'
import { useModalState } from '@hooks/useModalState'
import { usePeraWebImportFlowStore } from '@modules/onboarding/hooks'

type UsePeraWebImportInfoScreenResult = {
    handleScan: () => void
    isQRScannerVisible: boolean
    handleCloseQRScanner: () => void
    handleQRScannerSuccess: (url: string, restartScanning?: () => void) => void
}

export const usePeraWebImportInfoScreen =
    (): UsePeraWebImportInfoScreenResult => {
        const reset = usePeraWebImportFlowStore(state => state.reset)
        const {
            isOpen: isQRScannerVisible,
            open: openQRScanner,
            close: closeQRScanner,
        } = useModalState()

        // Reset on entry: backing out of the wizard and re-entering must not
        // carry over a previous attempt's QR or decrypted payload.
        useEffect(() => {
            reset()
        }, [reset])

        const handleScan = useCallback(() => {
            openQRScanner()
        }, [openQRScanner])

        // QR parsing + flow-store hydration + navigation to the Loading
        // screen all happen inside `useDeepLink.handleDeepLink` (the
        // `PERA_WEB_IMPORT` case) before the scanner's onSuccess callback
        // ever fires. By the time we get here, the Loading screen is
        // already on the stack — all we need to do is close the modal so
        // it doesn't linger over the Loading view.
        const handleQRScannerSuccess = useCallback(() => {
            closeQRScanner()
        }, [closeQRScanner])

        return {
            handleScan,
            isQRScannerVisible,
            handleCloseQRScanner: closeQRScanner,
            handleQRScannerSuccess,
        }
    }
