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
import { getLocalUnsignedSigners } from '../utils/getLocalUnsignedSigners'
import { splitLocalUnsignedSigners } from '../utils/splitLocalUnsignedSigners'

export type UseHandleMultisigSignTapResult = (
    signRequest: MultisigSignRequest,
) => void

/**
 * Returns a callback that handles a tap on a multisig-sign inbox item.
 * When actionable and the user holds an unsigned local-key (Algo25/HD)
 * participant, batch-dispatch a `multisig-cosign` SignRequest per signer —
 * the signing pipeline opens the sign bottom sheet directly. Hardware
 * (Ledger) participants are never auto-dispatched: their per-row Sign
 * button in `PendingSignaturesContent` is the only entry point that fires
 * a device prompt. The pending sheet opens whenever hardware action is
 * still required, when there is nothing to dispatch, or when the status
 * isn't actionable.
 */
export const useHandleMultisigSignTap = (): UseHandleMultisigSignTapResult => {
    const openSheet = usePendingSignaturesSheetStore(state => state.openSheet)
    const accounts = useAllAccounts()
    const { decodeTransaction } = useTransactionEncoder()
    const { addSignRequest } = useSigningRequest()

    return useCallback(
        (signRequest: MultisigSignRequest) => {
            if (ACTIONABLE_SIGN_REQUEST_STATUSES.has(signRequest.status)) {
                const { localKey, hardware } = splitLocalUnsignedSigners(
                    getLocalUnsignedSigners(signRequest, accounts),
                )
                for (const signer of localKey) {
                    try {
                        addSignRequest(
                            buildMultisigCosignRequest({
                                signRequest,
                                signerAddress: signer.address,
                                decodeTransaction,
                            }),
                        )
                    } catch (error) {
                        // A cosign request that fails validation (PERA-4711)
                        // must never be signed; skip it without crashing the
                        // tap handler.
                        logger.error(
                            'Skipping invalid multisig cosign request',
                            { error },
                        )
                    }
                }
                // Only the local-key cosign sign sheet owns the visible UI
                // when there's nothing else to do. If hardware participants
                // still need a per-row tap (or there was nothing dispatchable),
                // fall through and open the pending-signatures sheet.
                if (localKey.length > 0 && hardware.size === 0) return
            }
            openSheet(signRequest.id)
        },
        [openSheet, accounts, decodeTransaction, addSignRequest],
    )
}
