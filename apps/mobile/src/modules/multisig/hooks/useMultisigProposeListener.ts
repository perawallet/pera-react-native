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

import { useEffect, useRef } from 'react'
import { useInboxInvalidator } from '@perawallet/wallet-core-messages'
import {
    useLastTransportResult,
    type TransportResult,
} from '@perawallet/wallet-core-signing'
import { usePendingSignaturesSheetStore } from '../stores/usePendingSignaturesSheetStore'

/**
 * Opens the `PendingSignaturesContent` whenever a multisig signing event
 * resolves with a non-confirmed status. Covers both the proposer's first
 * send (`type: 'proposed'`) and a participant's cosign
 * (`type: 'signatures-added'`), so the user sees live signing status without
 * having to navigate to the inbox.
 *
 * Reads `lastTransportResult` from the signing store (set unconditionally by
 * the actor lifecycle on every completed transition) rather than subscribing
 * via `useSigningPipeline({ onEvent })`. The pipeline subscription doesn't
 * reliably establish in time for headless propose requests — see the
 * lifecycle hook's `setLastTransportResultRef.current` call.
 *
 * Dedupes via a ref so the effect skips the value already in the store at
 * mount time (e.g. a stale result from a prior in-session propose).
 */
export const useMultisigProposeListener = () => {
    const openSheet = usePendingSignaturesSheetStore(state => state.openSheet)
    const { invalidate: invalidateInbox } = useInboxInvalidator()
    const lastTransportResult = useLastTransportResult()
    const seenRef = useRef<TransportResult | null>(lastTransportResult ?? null)

    useEffect(() => {
        if (lastTransportResult === seenRef.current) return
        seenRef.current = lastTransportResult ?? null
        if (!lastTransportResult) return
        if (
            lastTransportResult.type !== 'proposed' &&
            lastTransportResult.type !== 'signatures-added'
        ) {
            return
        }
        invalidateInbox()
        if (lastTransportResult.status === 'confirmed') return
        openSheet(lastTransportResult.signRequestId)
    }, [lastTransportResult, invalidateInbox, openSheet])
}
