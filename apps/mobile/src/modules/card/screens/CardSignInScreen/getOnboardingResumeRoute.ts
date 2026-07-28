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

import {
    isKycSubmitted,
    OnboardingPhase,
    OnboardingStep,
    VerificationState,
} from '@perawallet/wallet-core-card'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type OnboardingResumeRoute = {
    // Deliberately a narrower literal union than `keyof
    // CardOnboardingStackParamList` — every screen listed here takes no
    // required params, matching how the caller navigates (`{ screen }` with
    // no `params`). A screen that requires params (e.g.
    // `CardOnboardingSigning`) can never be a valid resume target from here.
    screen:
        | 'CardOnboardingEmail'
        | 'CardOnboardingPhone'
        | 'CardOnboardingPersonalDetails'
        | 'CardOnboardingVerification'
        | 'CardOnboardingAddress'
        | 'CardOnboardingStatus'
    /** Step to persist to the card store; null leaves the stored step as is. */
    step: Nullable<OnboardingStep>
}

/**
 * Where a mid-onboarding login should resume, derived from the server's own
 * `phase` (what Baanx is waiting for next) combined with the KYC state — not
 * from the locally persisted step, which may belong to another device or an
 * older install. KYC gates the personal-details/address forms in our flow, so
 * an un-run KYC always routes to the verification entry first.
 */
export const getOnboardingResumeRoute = (
    phase: OnboardingPhase,
    verificationState: Nullable<VerificationState>,
    /**
     * Whether the store still holds the contactVerificationId from email/send.
     * Phone verification requires it, and only email/send issues it — a fresh
     * install/other device resumes without one.
     */
    hasContactVerificationId: boolean,
): OnboardingResumeRoute => {
    // A rejected user can't progress through the forms — land on the setup
    // checklist, which shows the rejected row and the support link.
    if (verificationState === VerificationState.Rejected) {
        return { screen: 'CardOnboardingStatus', step: null }
    }

    // PENDING counts as done: Baanx reviews asynchronously and allows the
    // remaining registration steps to proceed in the meantime. Shared predicate
    // so this stays in lockstep with the setup checklist's step gate.
    const isKycDone = isKycSubmitted(verificationState)

    switch (phase) {
        // Login succeeded, so the account (email + password) exists; phone
        // verification is the next actionable step for both phases. Without a
        // contactVerificationId the phone/send call can't run, so restart the
        // contact verification at the email screen — email/send reissues the
        // id, and the password screen skips the already-done email/verify
        // (login set the onboardingId), landing back on the phone step.
        case OnboardingPhase.Account:
        case OnboardingPhase.PhoneNumber: {
            return hasContactVerificationId
                ? {
                      screen: 'CardOnboardingPhone',
                      step: OnboardingStep.PhoneSend,
                  }
                : {
                      screen: 'CardOnboardingEmail',
                      step: OnboardingStep.EmailSend,
                  }
        }
        case OnboardingPhase.PersonalInformation: {
            return isKycDone
                ? {
                      screen: 'CardOnboardingPersonalDetails',
                      step: OnboardingStep.PersonalDetails,
                  }
                : {
                      screen: 'CardOnboardingVerification',
                      step: OnboardingStep.Verification,
                  }
        }
        // No separate mailing-address screen exists; the address form submits
        // `isSameMailingAddress: true`, satisfying both phases — so mailing
        // address shares the physical-address routing. KYC gates both; reaching
        // the mailing phase implies it's done, but the guard is defensive so an
        // un-done KYC can never skip verification.
        case OnboardingPhase.PhysicalAddress:
        case OnboardingPhase.MailingAddress: {
            return isKycDone
                ? {
                      screen: 'CardOnboardingAddress',
                      step: OnboardingStep.Address,
                  }
                : {
                      screen: 'CardOnboardingVerification',
                      step: OnboardingStep.Verification,
                  }
        }
    }
}
