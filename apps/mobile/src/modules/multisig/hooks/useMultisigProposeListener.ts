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
import { useInboxInvalidator } from '@perawallet/wallet-core-messages'
import {
    useSigningPipeline,
    type SigningPipelineEvent,
} from '@perawallet/wallet-core-signing'
import { usePendingSignaturesSheetStore } from '../stores/usePendingSignaturesSheetStore'

/**
 * Opens the `PendingSignaturesContent` whenever a multisig signing event
 * resolves with a non-confirmed status. Covers both the proposer's first
 * send (`type: 'proposed'`) and a participant's cosign
 * (`type: 'signatures-added'`), so the user sees live signing status without
 * having to navigate to the inbox.
 */
export const useMultisigProposeListener = () => {
    const openSheet = usePendingSignaturesSheetStore(state => state.openSheet)
    const { invalidate: invalidateInbox } = useInboxInvalidator()

    const handleEvent = useCallback(
        (event: SigningPipelineEvent) => {
            if (event.type !== 'signing_completed') return
            const result = event.transportResult
            if (
                result.type !== 'proposed' &&
                result.type !== 'signatures-added'
            ) {
                return
            }
            invalidateInbox()
            if (result.status === 'confirmed') return
            openSheet(result.signRequestId)
        },
        [openSheet, invalidateInbox],
    )

    useSigningPipeline({ onEvent: handleEvent })
}
