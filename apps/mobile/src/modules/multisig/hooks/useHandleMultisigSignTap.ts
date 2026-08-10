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
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useTransactionEncoder } from '@perawallet/wallet-core-blockchain'
import {
    ACTIONABLE_SIGN_REQUEST_STATUSES,
    type MultisigSignRequest,
} from '@perawallet/wallet-core-multisig'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { logger } from '@perawallet/wallet-core-shared'
import { usePendingSignaturesSheetStore } from '../stores/usePendingSignaturesSheetStore'
import { buildMultisigCosignRequest } from '../utils/buildMultisigCosignRequest'
import { getInFlightCosignAddresses } from '../utils/getInFlightCosignAddresses'
import { getLocalUnsignedSigners } from '../utils/getLocalUnsignedSigners'
import { selectCosignDispatchAddresses } from '../utils/selectCosignDispatchAddresses'
import { getSignedResponseCount } from '../utils/signRequestStatus'
import { splitLocalUnsignedSigners } from '../utils/splitLocalUnsignedSigners'

export type UseHandleMultisigSignTapResult = (
    signRequest: MultisigSignRequest,
) => void

/**
 * Returns a callback that handles a tap on a multisig-sign inbox item.
 *
 * Shortcut: when the request is actionable and the only unsigned local
 * participants are local-key (Algo25/HD), the tap itself is the sign intent —
 * batch-dispatch a `multisig-cosign` SignRequest per signer (capped at the
 * signatures still needed) and let the signing pipeline own the review sheet.
 *
 * Otherwise the pending-signatures sheet opens and owns the flow. That
 * includes the mixed case (local-key AND hardware unsigned): dispatching the
 * local-key cosigns here would surface a review sheet *under* the pending
 * sheet with no explicit Sign tap, so the local-key signing waits for the
 * footer Sign button. Hardware (Ledger) participants are never auto-dispatched
 * — their per-row Sign button is the only entry point that fires a device
 * prompt.
 */
export const useHandleMultisigSignTap = (): UseHandleMultisigSignTapResult => {
    const openSheet = usePendingSignaturesSheetStore(state => state.openSheet)
    const accounts = useAllAccounts()
    const { decodeTransaction } = useTransactionEncoder()
    const { addSignRequest, pendingSignRequests } = useSigningRequest()

    return useCallback(
        (signRequest: MultisigSignRequest) => {
            if (ACTIONABLE_SIGN_REQUEST_STATUSES.has(signRequest.status)) {
                const { localKey, hardware } = splitLocalUnsignedSigners(
                    getLocalUnsignedSigners(signRequest, accounts),
                )
                if (localKey.length > 0 && hardware.size === 0) {
                    const toDispatch = selectCosignDispatchAddresses({
                        localKeySigners: localKey,
                        inFlightAddresses: getInFlightCosignAddresses(
                            pendingSignRequests,
                            signRequest.id,
                        ),
                        threshold: signRequest.multisigAccount.threshold,
                        signedCount: getSignedResponseCount(signRequest),
                    })
                    for (const address of toDispatch) {
                        try {
                            addSignRequest(
                                buildMultisigCosignRequest({
                                    signRequest,
                                    signerAddress: address,
                                    decodeTransaction,
                                }),
                            )
                        } catch (error) {
                            // A cosign request that fails validation
                            // (PERA-4711) must never be signed; skip it
                            // without crashing the tap handler.
                            logger.error(
                                'Skipping invalid multisig cosign request',
                                { error },
                            )
                        }
                    }
                    return
                }
            }
            openSheet(signRequest.id)
        },
        [
            openSheet,
            accounts,
            decodeTransaction,
            addSignRequest,
            pendingSignRequests,
        ],
    )
}
