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

import { useEffect } from 'react'
import type { ConnectionRegistry } from '@perawallet/wallet-core-connections'
import { scannerNotifier } from '@components/QRScannerView'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { isFeeAdjustmentDeliveryError } from '@modules/walletconnect/utils/fee-adjustment-error'
import type { ProposalQueueHandle } from './useProposalQueue'

/**
 * Toasts registry errors and closes the approval sheet of the connection
 * that failed. Copy goes through `resolveErrorCopy`: an error's `message` is
 * developer English written for the peer and the logs.
 */
export const useConnectionErrorToasts = (
    registry: ConnectionRegistry,
    proposals: ProposalQueueHandle,
): void => {
    const { showToast } = useToast()
    const { showError } = useErrorToast()
    const { t } = useLanguage()

    useEffect(
        () =>
            registry.subscribeToErrors((error, scope) => {
                // The rejection issued for an earlier error fails on the same
                // dead socket; the user has already been told once.
                if (scope && proposals.isRejectingOnError(scope)) return

                // The QR scanner's native Modal covers the root view, so the
                // toast renders on its own notifier while it is open.
                const notifier = scannerNotifier.current ?? undefined
                if (isFeeAdjustmentDeliveryError(error)) {
                    showToast(
                        {
                            title: t('walletconnect.request.error_sheet_title'),
                            body: t(
                                'walletconnect.request.quantum_fee_delivery_failed',
                            ),
                            type: 'error',
                        },
                        { notifier },
                    )
                } else {
                    showError(
                        error,
                        t('walletconnect.request.error_sheet_title'),
                        { notifier },
                    )
                }

                // A toast alone leaves the sheet sitting over a dead
                // connection, and dismissing alone leaves the connector bound
                // to pop a ghost sheet when the bridge revives.
                if (scope) proposals.closeForScope(scope)
            }),
        [registry, proposals, showError, showToast, t],
    )
}
