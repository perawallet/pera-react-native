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

import { useInboxInvalidator } from '@perawallet/wallet-core-messages'
import {
    isTransactionRequest,
    useSigningEvent,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import { usePendingSignaturesSheet } from './usePendingSignaturesSheet'

/**
 * Opens `PendingSignaturesContent` whenever a multisig signing event resolves
 * non-confirmed — the proposer's first send (`proposed`) or a participant's
 * cosign (`signatures-added`) — so signing status is visible without opening
 * the inbox. Source-agnostic: WalletConnect / webview / deeplink handoffs land
 * here too. Subscribes to the signing event bus, so dedupe is intrinsic.
 */
export const useMultisigProposeListener = () => {
    const { showSignRequest } = usePendingSignaturesSheet()
    const { invalidate: invalidateInbox } = useInboxInvalidator()
    const { pendingSignRequests } = useSigningRequest()

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
            // When the device holds several participants, their cosigns queue
            // together and the driver presents the next review sheet as soon
            // as this one resolves. Opening the progress sheet now would bury
            // that review sheet — and the footer Sign correctly no-ops on the
            // in-flight guard, stranding the user with an "unresponsive"
            // button. Hold the sheet until the LAST queued cosign resolves.
            const hasQueuedSiblingCosign = pendingSignRequests.some(
                r =>
                    r.id !== event.request.id &&
                    isTransactionRequest(r) &&
                    r.sourceType === 'multisig-cosign' &&
                    r.signRequestId === result.signRequestId,
            )
            if (hasQueuedSiblingCosign) return
            showSignRequest(result.signRequestId)
        },
    )
}
