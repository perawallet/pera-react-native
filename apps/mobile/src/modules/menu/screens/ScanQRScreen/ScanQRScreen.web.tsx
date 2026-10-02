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

import React from 'react'
import { PWScreen, PWView } from '@components/core'
// Explicit `.web` suffix: tsc has no platform-suffix resolution (same
// reasoning as QRScannerView.web's `./styles.web` import). This screen is
// itself web-only — it's registered only in WebMainRoutes.
import { QRScannerContent } from '@components/QRScannerView/QRScannerContent.web'
import { useStyles } from './styles'
import { useScanQRScreen } from './useScanQRScreen.web'

/**
 * Full-page camera scanner (user-feedback round 2 #3): the expanded tab's
 * `?flow=scan` deep-link and the menu scan action land here instead of the
 * old scanner-sheet-over-the-menu. On a successful scan the deep-link
 * handler has already dispatched (typically opening a sheet), so closing
 * just pops this page from under it.
 */
export const ScanQRScreen = () => {
    const styles = useStyles()
    const { restartKey, handleScanned, handleClose, handleRestart } =
        useScanQRScreen()

    return (
        <PWScreen
            testID='scan_qr_screen'
            horizontalPadding='none'
        >
            <PWView style={styles.content}>
                <QRScannerContent
                    key={restartKey}
                    onClose={handleClose}
                    onSuccess={handleScanned}
                    onRestart={handleRestart}
                />
            </PWView>
        </PWScreen>
    )
}
