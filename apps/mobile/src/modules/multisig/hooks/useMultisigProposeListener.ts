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

import { useInboxInvalidator } from '@perawallet/wallet-core-messages'
import {
    isDraftSignRequestId,
    useDraftSignRequestStore,
} from '@perawallet/wallet-core-multisig'
import { useSigningEvent } from '@perawallet/wallet-core-signing'
import { usePendingSignaturesSheetStore } from '../stores/usePendingSignaturesSheetStore'

/**
 * Opens the `PendingSignaturesContent` whenever a multisig signing event
 * resolves with a non-confirmed status. Covers both the proposer's first
 * send (`type: 'proposed'`) and a participant's cosign
 * (`type: 'signatures-added'`), so the user sees live signing status without
 * having to navigate to the inbox.
 *
 * Source-agnostic: a propose from a WalletConnect / webview / deeplink
 * handoff lands here too, with the transport result's `sourceType` reflecting
 * the original sync request. The dApp peer is resolved separately by the
 * propose transport via `softReject` — this hook only owns the in-app
 * sheet. A future follow-up could add a one-time toast for external
 * handoffs ("Sign request created. The dApp was notified."); deferred
 * because no generic toast/snackbar infrastructure exists yet.
 *
 * Subscribes to the signing event bus — the bus publishes once per actor
 * transition, so dedupe is intrinsic (no ref tracking needed) and no
 * stale-at-mount value can re-trigger the sheet.
 */
export const useMultisigProposeListener = () => {
    const openSheet = usePendingSignaturesSheetStore(state => state.openSheet)
    const { invalidate: invalidateInbox } = useInboxInvalidator()

    useSigningEvent(
        event =>
            event.type === 'transport-result' &&
            (event.result.type === 'proposed' ||
                event.result.type === 'signatures-added'),
        event => {
            if (event.type !== 'transport-result') return
            const { result } = event
            if (
                result.type !== 'proposed' &&
                result.type !== 'signatures-added'
            ) {
                return
            }
            invalidateInbox()
            if (result.status === 'confirmed') return

            // Draft → real swap: a cosign result on a draft sheet means the
            // addSignatures adapter bootstrapped the backend propose with the
            // user's first per-row Sign. Clean up the now-orphaned draft and
            // point the sheet at the real signRequestId.
            const newId = result.signRequestId
            const currentId =
                usePendingSignaturesSheetStore.getState().signRequestId
            if (
                currentId &&
                isDraftSignRequestId(currentId) &&
                !isDraftSignRequestId(newId)
            ) {
                useDraftSignRequestStore.getState().deleteDraft(currentId)
            }
            openSheet(newId)
        },
    )
}
