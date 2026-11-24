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
import {
    spendSubmitDeadlineOf,
    type ChainScope,
    type MessageSummary,
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
import { useHaptics } from '@hooks/useHaptics'
import { useHasTimePassed } from '@hooks/useHasTimePassed'
import { useRequestAddressSafety } from '../../hooks/useRequestAddressSafety'
import { useRequestSiteSafety } from '../../hooks/useRequestSiteSafety'

type UseMessageSigningScreenResult = {
    summary: Nullable<MessageSummary>
    scope: Nullable<ChainScope>
    signerAccount: Nullable<WalletAccount>
    sourceMetadata: Optional<SignRequestSource>
    verifiedOrigin: Optional<string>
    isPending: boolean
    /** Every address the signed message names, recognised as a permit or not. */
    reviewedAddresses: ReviewedAddress[]
    /** A scam-listed address under the hard block: the request can only be rejected. */
    isListedAddressBlocking: boolean
    /** A flagged address or site still waits on the user's acknowledgement, or the permit has expired. */
    isConfirmBlocked: boolean
    /** The permit's signature deadline has passed, so the contract would refuse it. */
    isExpired: boolean
    handleApprove: () => void
    handleReject: () => void
}

export const useMessageSigningScreen = (): UseMessageSigningScreenResult => {
    const pipeline = useSigningPipeline()
    const haptics = useHaptics()
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
    const {
        isListedAddressBlocking,
        isConfirmBlocked: isAddressConfirmBlocked,
    } = useRequestAddressSafety({ addresses: reviewedAddresses })
    const { isConfirmBlocked: isSiteConfirmBlocked } = useRequestSiteSafety()
    // The signer refuses an expired permit too; this keeps the slide from offering one.
    const submitDeadline = summary?.spendApproval
        ? spendSubmitDeadlineOf(summary.spendApproval)
        : undefined
    const isExpired = useHasTimePassed(submitDeadline)
    const isConfirmBlocked =
        isAddressConfirmBlocked || isSiteConfirmBlocked || isExpired

    const handleApprove = useCallback(() => {
        // Re-read the clock: the slide can finish in the instant the deadline passes.
        const hasLapsed =
            submitDeadline !== undefined && Date.now() >= submitDeadline
        if (isConfirmBlocked || hasLapsed) return
        haptics.medium()
        pipeline.next()
    }, [haptics, pipeline, isConfirmBlocked, submitDeadline])

    const handleReject = useCallback(() => {
        haptics.light()
        pipeline.fail()
    }, [haptics, pipeline])

    return {
        summary,
        scope: message?.scope ?? null,
        signerAccount: resolved?.signerAccount ?? null,
        sourceMetadata: currentRequest?.sourceMetadata,
        verifiedOrigin: currentRequest?.verifiedOrigin,
        isPending: pipeline.isLoading || !!signingStarted,
        reviewedAddresses,
        isListedAddressBlocking,
        isConfirmBlocked,
        isExpired,
        handleApprove,
        handleReject,
    }
}
