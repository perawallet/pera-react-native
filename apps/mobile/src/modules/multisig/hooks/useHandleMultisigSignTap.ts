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

import { useCallback } from 'react'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useTransactionEncoder } from '@perawallet/wallet-core-blockchain'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { usePendingSignaturesSheetStore } from '../stores/usePendingSignaturesSheetStore'
import { buildMultisigCosignRequest } from '../utils/buildMultisigCosignRequest'
import { getLocalUnsignedSigners } from '../utils/getLocalUnsignedSigners'
import { ACTIONABLE_SIGN_REQUEST_STATUSES } from '../utils/signRequestStatus'

export type UseHandleMultisigSignTapResult = (
    signRequest: MultisigSignRequest,
) => void

/**
 * Returns a callback that handles a tap on a multisig-sign inbox item.
 * Fast path: when the request is actionable and the local user holds at
 * least one unsigned participant key, dispatch a `multisig-cosign`
 * SignRequest per local signer so the signing pipeline opens the sign
 * bottom sheet directly. Slow path (already signed, no local key, or
 * non-actionable status): open `PendingSignaturesBottomSheet` so the
 * user can review signer status.
 */
export const useHandleMultisigSignTap = (): UseHandleMultisigSignTapResult => {
    const openSheet = usePendingSignaturesSheetStore(state => state.openSheet)
    const accounts = useAllAccounts()
    const { decodeTransaction } = useTransactionEncoder()
    const { addSignRequest } = useSigningRequest()

    return useCallback(
        (signRequest: MultisigSignRequest) => {
            if (ACTIONABLE_SIGN_REQUEST_STATUSES.has(signRequest.status)) {
                const localUnsignedSigners = getLocalUnsignedSigners(
                    signRequest,
                    accounts,
                )
                if (localUnsignedSigners.length > 0) {
                    for (const signer of localUnsignedSigners) {
                        addSignRequest(
                            buildMultisigCosignRequest({
                                signRequest,
                                signerAddress: signer.address,
                                decodeTransaction,
                            }),
                        )
                    }
                    return
                }
            }
            openSheet(signRequest.id)
        },
        [openSheet, accounts, decodeTransaction, addSignRequest],
    )
}
