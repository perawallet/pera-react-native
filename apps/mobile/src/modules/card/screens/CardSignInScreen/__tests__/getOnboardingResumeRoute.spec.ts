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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
    OnboardingPhase,
    OnboardingStep,
    VerificationState,
} from '@perawallet/wallet-core-card'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getOnboardingResumeRoute } from '../getOnboardingResumeRoute'

type Case = {
    phase: OnboardingPhase
    verificationState: Nullable<VerificationState>
    hasContactVerificationId?: boolean
    screen: string
    step: Nullable<OnboardingStep>
}

// "KYC not done" = null or UNVERIFIED — both must route through the KYC entry
// once the server is waiting on personal information or later.
const CASES: Case[] = [
    // Credentials exist (login succeeded), so phone verify is next.
    {
        phase: OnboardingPhase.Account,
        verificationState: null,
        screen: 'CardOnboardingPhone',
        step: OnboardingStep.PhoneSend,
    },
    {
        phase: OnboardingPhase.PhoneNumber,
        verificationState: VerificationState.Unverified,
        screen: 'CardOnboardingPhone',
        step: OnboardingStep.PhoneSend,
    },
    // A fresh install has no contactVerificationId, and phone/send requires
    // one — restart contact verification at the email screen instead.
    {
        phase: OnboardingPhase.Account,
        verificationState: null,
        hasContactVerificationId: false,
        screen: 'CardOnboardingEmail',
        step: OnboardingStep.EmailSend,
    },
    {
        phase: OnboardingPhase.PhoneNumber,
        verificationState: null,
        hasContactVerificationId: false,
        screen: 'CardOnboardingEmail',
        step: OnboardingStep.EmailSend,
    },
    // KYC gates the details forms.
    {
        phase: OnboardingPhase.PersonalInformation,
        verificationState: null,
        screen: 'CardOnboardingVerification',
        step: OnboardingStep.Verification,
    },
    {
        phase: OnboardingPhase.PersonalInformation,
        verificationState: VerificationState.Unverified,
        screen: 'CardOnboardingVerification',
        step: OnboardingStep.Verification,
    },
    // PENDING counts as done — Baanx reviews async and allows details entry.
    {
        phase: OnboardingPhase.PersonalInformation,
        verificationState: VerificationState.Pending,
        screen: 'CardOnboardingPersonalDetails',
        step: OnboardingStep.PersonalDetails,
    },
    {
        phase: OnboardingPhase.PersonalInformation,
        verificationState: VerificationState.Verified,
        screen: 'CardOnboardingPersonalDetails',
        step: OnboardingStep.PersonalDetails,
    },
    {
        phase: OnboardingPhase.PhysicalAddress,
        verificationState: VerificationState.Unverified,
        screen: 'CardOnboardingVerification',
        step: OnboardingStep.Verification,
    },
    {
        phase: OnboardingPhase.PhysicalAddress,
        verificationState: VerificationState.Verified,
        screen: 'CardOnboardingAddress',
        step: OnboardingStep.Address,
    },
    // The address form submits isSameMailingAddress: true, so it satisfies
    // the mailing-address phase too.
    {
        phase: OnboardingPhase.MailingAddress,
        verificationState: VerificationState.Verified,
        screen: 'CardOnboardingAddress',
        step: OnboardingStep.Address,
    },
    // …but KYC still gates it (same as the address phases) — an un-done KYC
    // can't skip verification via the mailing-address phase.
    {
        phase: OnboardingPhase.MailingAddress,
        verificationState: VerificationState.Unverified,
        screen: 'CardOnboardingVerification',
        step: OnboardingStep.Verification,
    },
]

describe('getOnboardingResumeRoute', () => {
    it.each(CASES)(
        'routes phase $phase with KYC $verificationState to $screen',
        ({
            phase,
            verificationState,
            hasContactVerificationId,
            screen,
            step,
        }) => {
            expect(
                getOnboardingResumeRoute(
                    phase,
                    verificationState,
                    hasContactVerificationId ?? true,
                ),
            ).toEqual({ screen, step })
        },
    )

    it.each(Object.values(OnboardingPhase))(
        'sends a REJECTED user to the status checklist regardless of phase (%s)',
        phase => {
            expect(
                getOnboardingResumeRoute(
                    phase,
                    VerificationState.Rejected,
                    true,
                ),
            ).toEqual({ screen: 'CardOnboardingStatus', step: null })
        },
    )
})
