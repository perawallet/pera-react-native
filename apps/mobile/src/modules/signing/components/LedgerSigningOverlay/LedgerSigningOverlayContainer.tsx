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

import React from 'react'
import { LedgerSigningOverlay } from './LedgerSigningOverlay'
import { useLedgerSigningOverlay } from './useLedgerSigningOverlay'

/**
 * Mounted once at the app root via SigningOverlays. Renders the
 * LedgerSigningOverlay only while a hardware-wallet signing session is
 * active; otherwise unmounts so the bottom sheet doesn't sit hidden in
 * the tree.
 */
export const LedgerSigningOverlayContainer = () => {
    const { isVisible, status, currentTx, totalTxs, onCancel, onRetry } =
        useLedgerSigningOverlay()

    if (!isVisible) return null

    return (
        <LedgerSigningOverlay
            isVisible={isVisible}
            status={status}
            currentTx={currentTx}
            totalTxs={totalTxs}
            onCancel={onCancel}
            onRetry={onRetry}
        />
    )
}
