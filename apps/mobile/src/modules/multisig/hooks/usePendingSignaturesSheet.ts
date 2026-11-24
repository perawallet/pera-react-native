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
import { deleteDraftSignRequest } from '@perawallet/wallet-core-multisig'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { usePendingSignaturesSheetStore } from '../stores/usePendingSignaturesSheetStore'

export type UsePendingSignaturesSheetResult = {
    /** False while a different request is already visible. */
    showSignRequest: (signRequestId: string, chainId?: ChainId) => boolean
    enqueueSignRequest: (signRequestId: string, chainId?: ChainId) => void
    /** Drops a draft its first signature just proposed and shows the real request in its place. */
    replaceDraft: (
        draftId: string,
        signRequestId: string,
        chainId?: ChainId,
    ) => void
}

/**
 * Controller for the pending-signatures sheet. Owns the imperative store
 * coordination (current id + draft cleanup) so callers needn't reach into
 * store internals.
 */
export const usePendingSignaturesSheet =
    (): UsePendingSignaturesSheetResult => {
        const openSheet = usePendingSignaturesSheetStore(
            state => state.openSheet,
        )
        const enqueueSignRequest = usePendingSignaturesSheetStore(
            state => state.enqueueSheet,
        )

        const showSignRequest = useCallback(
            (signRequestId: string, chainId?: ChainId) => {
                const current =
                    usePendingSignaturesSheetStore.getState().signRequestId
                if (current) return current === signRequestId
                openSheet(signRequestId, chainId)
                return true
            },
            [openSheet],
        )

        const replaceDraft = useCallback(
            (draftId: string, signRequestId: string, chainId?: ChainId) => {
                deleteDraftSignRequest(draftId)
                if (
                    usePendingSignaturesSheetStore.getState().signRequestId ===
                    draftId
                ) {
                    openSheet(signRequestId, chainId)
                } else {
                    enqueueSignRequest(signRequestId, chainId)
                }
            },
            [openSheet, enqueueSignRequest],
        )

        return { showSignRequest, enqueueSignRequest, replaceDraft }
    }
