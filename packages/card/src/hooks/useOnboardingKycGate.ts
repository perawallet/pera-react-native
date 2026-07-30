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

import { useCallback, useState } from 'react'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { isKycSubmitted, isKycVerified } from '../models'
import { useOnboardingDetailsQuery } from './useOnboardingDetailsQuery'

export type UseOnboardingKycGateParams = {
    onboardingId: Nullable<string>
}

export type UseOnboardingKycGateResult = {
    /** The record's KYC isn't far enough along for Baanx to accept the step. */
    isKycRequired: boolean
    /** Call when a step is refused with `OnboardingNotVerifiedError`. */
    markServerRefused: () => void
}

/**
 * Decides whether a registration step (personal details, address) may be
 * attempted for the current onboarding record.
 *
 * Baanx reports `PENDING` from the moment a Veriff session is *created*, not
 * when documents are submitted, so an abandoned check is indistinguishable
 * from one under review. Because of that:
 * - by default `PENDING` proceeds, matching Baanx's own guidance and avoiding
 *   a multi-day stall for users genuinely under review;
 * - once the server has actually refused the record, only a *newer* fetch
 *   reporting `VERIFIED` reopens it. The cached record is exactly the
 *   optimistic state the refusal contradicted, so trusting it would loop the
 *   user through the same failing submit. A real completion still reopens the
 *   form on its own, since the refusing mutation invalidates this query.
 *
 * An unfetched or errored record does NOT block: the submit-time refusal is
 * the backstop, and blocking there would show the verify prompt to everyone
 * on a slow fetch. (`isLoading` can't stand in for this: it is false for an
 * errored query.)
 */
export const useOnboardingKycGate = ({
    onboardingId,
}: UseOnboardingKycGateParams): UseOnboardingKycGateResult => {
    const { data: onboardingDetails, dataUpdatedAt } = useOnboardingDetailsQuery(
        { onboardingId },
    )
    const [refusedAt, setRefusedAt] = useState<Nullable<number>>(null)

    const kycState = onboardingDetails?.verificationState ?? null
    const isKycAccepted =
        refusedAt === null
            ? isKycSubmitted(kycState)
            : isKycVerified(kycState) && dataUpdatedAt > refusedAt

    const markServerRefused = useCallback(() => {
        setRefusedAt(Date.now())
    }, [])

    return {
        isKycRequired:
            (onboardingDetails !== undefined || refusedAt !== null) &&
            !isKycAccepted,
        markServerRefused,
    }
}
