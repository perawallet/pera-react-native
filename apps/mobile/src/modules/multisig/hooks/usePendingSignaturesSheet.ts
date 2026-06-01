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
import {
    isDraftSignRequestId,
    useDraftSignRequestStore,
} from '@perawallet/wallet-core-multisig'
import { usePendingSignaturesSheetStore } from '../stores/usePendingSignaturesSheetStore'

export type UsePendingSignaturesSheetResult = {
    showSignRequest: (signRequestId: string) => void
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

        const showSignRequest = useCallback(
            (signRequestId: string) => {
                // Reads the live id at call time (not a render-captured value)
                // so a draft the propose just superseded is detected and its
                // orphaned draft dropped before pointing the sheet at the real id.
                const currentId =
                    usePendingSignaturesSheetStore.getState().signRequestId
                if (
                    currentId &&
                    isDraftSignRequestId(currentId) &&
                    !isDraftSignRequestId(signRequestId)
                ) {
                    useDraftSignRequestStore.getState().deleteDraft(currentId)
                }
                openSheet(signRequestId)
            },
            [openSheet],
        )

        return { showSignRequest }
    }
