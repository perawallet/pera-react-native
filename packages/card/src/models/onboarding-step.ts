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

import type { Nullable } from '@perawallet/wallet-core-shared'
import { OnboardingStep, US_ISO } from './onboarding'
import { OnboardingPhase } from './session'
import { VerificationState } from './user'

export type OnboardingStepInput = {
    /** What Baanx says it expects next; null when it sent none we model. */
    phase: Nullable<OnboardingPhase>
    verificationState: Nullable<VerificationState>
    /** ISO 3166-1 alpha-2 residence; only US residents owe a mailing address. */
    countryIso: Nullable<string>
    /**
     * Where the fixed flow order would go next on this device, e.g. the step
     * after the one just submitted. Used when `phase` is null.
     */
    localStep: OnboardingStep
    /** A card session exists, so the account is already created. */
    hasSession: boolean
    /** Phone verification needs the id only email/send issues. */
    hasContactVerificationId: boolean
}

const contactStep = (hasContactVerificationId: boolean): OnboardingStep =>
    // email/send reissues the id, and the password screen skips the spent
    // email/verify since the onboarding id is already known.
    hasContactVerificationId
        ? OnboardingStep.PhoneSend
        : OnboardingStep.EmailSend

const stepFromLocalOrder = (input: OnboardingStepInput): OnboardingStep => {
    switch (input.localStep) {
        case OnboardingStep.EmailSend:
        case OnboardingStep.EmailVerify: {
            return OnboardingStep.EmailSend
        }
        case OnboardingStep.PhoneSend:
        case OnboardingStep.PhoneVerify: {
            return contactStep(input.hasContactVerificationId)
        }
        case OnboardingStep.PersonalDetails:
        case OnboardingStep.AdditionalDetails:
        case OnboardingStep.Address:
        case OnboardingStep.MailingAddress:
        case OnboardingStep.Verification:
        case OnboardingStep.Completed: {
            return input.localStep
        }
        default: {
            // A persisted step from an older build that no longer exists.
            return contactStep(input.hasContactVerificationId)
        }
    }
}

/**
 * The single answer to "which onboarding step next". Baanx's `phase` wins
 * over the device's own step, since it reflects the record rather than this
 * install. Form phases win over the KYC state too, so a record verified under
 * an older order still finishes its forms. `MAILING_ADDRESS` means the mailing
 * step only for US residents, and "every form is in" for everyone else.
 */
export const resolveOnboardingStep = (
    input: OnboardingStepInput,
): OnboardingStep => {
    if (input.hasSession) return OnboardingStep.Completed
    if (input.verificationState === VerificationState.Rejected) {
        return OnboardingStep.Verification
    }

    switch (input.phase) {
        case OnboardingPhase.PhoneNumber: {
            return contactStep(input.hasContactVerificationId)
        }
        case OnboardingPhase.PersonalInformation: {
            return OnboardingStep.PersonalDetails
        }
        case OnboardingPhase.AdditionalDetails: {
            return OnboardingStep.AdditionalDetails
        }
        case OnboardingPhase.PhysicalAddress: {
            return OnboardingStep.Address
        }
        case OnboardingPhase.MailingAddress: {
            const isMailingSubmitted =
                input.localStep === OnboardingStep.Verification ||
                input.localStep === OnboardingStep.Completed
            return input.countryIso === US_ISO && !isMailingSubmitted
                ? OnboardingStep.MailingAddress
                : OnboardingStep.Verification
        }
        case OnboardingPhase.Account: {
            return OnboardingStep.Verification
        }
        case null: {
            return stepFromLocalOrder(input)
        }
    }
}
