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
    resolveOnboardingStep,
    VerificationState,
    type OnboardingStepInput,
} from '@perawallet/wallet-core-card'

export type OnboardingRoute = {
    // Every screen here takes no required params, matching how callers
    // navigate; a screen that needs params can never be a routing target.
    screen:
        | 'CardOnboardingEmail'
        | 'CardOnboardingPhone'
        | 'CardOnboardingPersonalDetails'
        | 'CardOnboardingAdditionalDetails'
        | 'CardOnboardingAddress'
        | 'CardOnboardingMailingAddress'
        | 'CardOnboardingVerification'
        | 'CardOnboardingStatus'
    /** The step to mirror into the card store. */
    step: OnboardingStep
}

export type OnboardingRouteInput = OnboardingStepInput

const SCREEN_BY_STEP: Record<OnboardingStep, OnboardingRoute['screen']> = {
    [OnboardingStep.EmailSend]: 'CardOnboardingEmail',
    [OnboardingStep.EmailVerify]: 'CardOnboardingEmail',
    [OnboardingStep.PhoneSend]: 'CardOnboardingPhone',
    [OnboardingStep.PhoneVerify]: 'CardOnboardingPhone',
    [OnboardingStep.PersonalDetails]: 'CardOnboardingPersonalDetails',
    [OnboardingStep.AdditionalDetails]: 'CardOnboardingAdditionalDetails',
    [OnboardingStep.Address]: 'CardOnboardingAddress',
    [OnboardingStep.MailingAddress]: 'CardOnboardingMailingAddress',
    [OnboardingStep.Verification]: 'CardOnboardingVerification',
    [OnboardingStep.Completed]: 'CardOnboardingStatus',
}

/**
 * Maps the package's `resolveOnboardingStep` to a screen. At the KYC step the
 * checklist takes over once there is nothing left to start: KYC submitted or
 * decided, or the account already exists.
 */
export const getOnboardingNextRoute = (
    input: OnboardingRouteInput,
): OnboardingRoute => {
    const step = resolveOnboardingStep(input)
    const isAwaitingKyc =
        step === OnboardingStep.Verification &&
        (isKycSubmitted(input.verificationState) ||
            input.verificationState === VerificationState.Rejected ||
            input.phase === OnboardingPhase.Account)
    return {
        screen: isAwaitingKyc ? 'CardOnboardingStatus' : SCREEN_BY_STEP[step],
        step,
    }
}
