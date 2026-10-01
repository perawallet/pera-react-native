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
import { LedgerAwaitingApprovalContent } from '../LedgerAwaitingApprovalContent'
import { LedgerErrorContent } from '../LedgerErrorContent'
import { LedgerReconnectingContent } from '../LedgerReconnectingContent'
import { useLedgerSigningContent } from './useLedgerSigningContent'

/**
 * Thin router for the hardware-wallet signing sheet content. Reads the
 * adapter hook and dispatches to the correct phase-specific content based
 * on the current signing status. The troubleshooting sheet is mounted as
 * a peer via the `useLedgerConnectionIssueDriver` in SigningOverlays.
 *
 * Intentionally style-less: this is a phase router with no direct visual
 * output. All visual styles live in the phase-content components
 * (`LedgerAwaitingApprovalContent`, `LedgerErrorContent`), per CLAUDE.md
 * convention. The absence of a `styles.ts` is deliberate.
 */
export const LedgerSigningContent = () => {
    const {
        status,
        deviceName,
        currentTx,
        totalTxs,
        operation,
        error,
        onCancel,
        onRetry,
        onOpenTroubleshooting,
    } = useLedgerSigningContent()

    // Only reachable after a retry — the driver keeps the sheet closed during
    // the first attempt's silent scan, so this never renders on a cold start.
    if (status === 'searching') {
        return <LedgerReconnectingContent onCancel={onCancel} />
    }

    if (status === 'awaitingApproval' || status === 'signing') {
        return (
            <LedgerAwaitingApprovalContent
                deviceName={deviceName}
                currentTx={currentTx}
                totalTxs={totalTxs}
                operation={operation}
                onCancel={onCancel}
            />
        )
    }

    if (status === 'error' && error) {
        return (
            <LedgerErrorContent
                error={error}
                onRetry={onRetry}
                onClose={onCancel}
                onOpenTroubleshooting={onOpenTroubleshooting}
            />
        )
    }

    return null
}
