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

import { useCallback, useMemo } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    ChainScope,
    MessageSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    isMessageRequest,
    reviewedMessageAddressesOf,
    useLastSigningEvent,
    useSigningPipeline,
    type ReviewedAddress,
    type SignRequestSource,
    type SigningLifecycleEvent,
} from '@perawallet/wallet-core-signing'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useRequestAddressSafety } from '../../hooks/useRequestAddressSafety'

type UseMessageSigningScreenResult = {
    summary: Nullable<MessageSummary>
    scope: Nullable<ChainScope>
    signerAccount: Nullable<WalletAccount>
    sourceMetadata: Optional<SignRequestSource>
    verifiedOrigin: Optional<string>
    isPending: boolean
    /** Every address the signed message names, recognised as a permit or not. */
    reviewedAddresses: ReviewedAddress[]
    /** A flagged address in the request still waits on the user's acknowledgement. */
    isConfirmBlocked: boolean
    handleApprove: () => void
    handleReject: () => void
}

export const useMessageSigningScreen = (): UseMessageSigningScreenResult => {
    const pipeline = useSigningPipeline()
    const { currentRequest, resolved } = pipeline

    // The bus's `signing-started` event lands before the next render of
    // `pipeline.isLoading`, so the spinner shows the instant signing begins.
    const signingStarted = useLastSigningEvent(
        (e): e is Extract<SigningLifecycleEvent, { type: 'signing-started' }> =>
            e.type === 'signing-started',
        currentRequest?.id,
    )

    const summary =
        resolved?.kind.type === 'message' ? resolved.kind.summary : null
    const message =
        currentRequest && isMessageRequest(currentRequest)
            ? currentRequest.message
            : null
    const reviewedAddresses = useMemo(
        () => (message ? reviewedMessageAddressesOf(message) : []),
        [message],
    )
    const { isConfirmBlocked } = useRequestAddressSafety({
        addresses: reviewedAddresses,
    })

    const handleApprove = useCallback(() => {
        if (isConfirmBlocked) return
        pipeline.next()
    }, [pipeline, isConfirmBlocked])

    const handleReject = useCallback(() => {
        pipeline.fail()
    }, [pipeline])

    return {
        summary,
        scope: message?.scope ?? null,
        signerAccount: resolved?.signerAccount ?? null,
        sourceMetadata: currentRequest?.sourceMetadata,
        verifiedOrigin: currentRequest?.verifiedOrigin,
        isPending: pipeline.isLoading || !!signingStarted,
        reviewedAddresses,
        isConfirmBlocked,
        handleApprove,
        handleReject,
    }
}
