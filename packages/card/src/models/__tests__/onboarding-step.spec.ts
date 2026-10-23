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
import { OnboardingStep } from '../onboarding'
import { OnboardingPhase } from '../session'
import { VerificationState } from '../user'
import {
    resolveOnboardingStep,
    type OnboardingStepInput,
} from '../onboarding-step'

const BASE: OnboardingStepInput = {
    phase: null,
    verificationState: null,
    countryIso: 'GB',
    localStep: OnboardingStep.PersonalDetails,
    hasSession: false,
    hasContactVerificationId: true,
}

type Case = Partial<OnboardingStepInput> & {
    label: string
    step: OnboardingStep
}

const CASES: Case[] = [
    // Baanx's phase names the step it expects next.
    {
        label: 'phone number phase',
        phase: OnboardingPhase.PhoneNumber,
        step: OnboardingStep.PhoneSend,
    },
    {
        label: 'phone number phase on a device without the contact id',
        phase: OnboardingPhase.PhoneNumber,
        hasContactVerificationId: false,
        step: OnboardingStep.EmailSend,
    },
    {
        label: 'personal information phase',
        phase: OnboardingPhase.PersonalInformation,
        step: OnboardingStep.PersonalDetails,
    },
    {
        label: 'additional details phase',
        phase: OnboardingPhase.AdditionalDetails,
        step: OnboardingStep.AdditionalDetails,
    },
    {
        label: 'physical address phase',
        phase: OnboardingPhase.PhysicalAddress,
        step: OnboardingStep.Address,
    },
    // A form phase wins over KYC, so a record verified under the old order
    // still finishes its forms.
    {
        label: 'physical address phase on an already verified record',
        phase: OnboardingPhase.PhysicalAddress,
        verificationState: VerificationState.Verified,
        step: OnboardingStep.Address,
    },
    {
        label: 'mailing phase for a US resident who still owes it',
        phase: OnboardingPhase.MailingAddress,
        countryIso: 'US',
        localStep: OnboardingStep.MailingAddress,
        step: OnboardingStep.MailingAddress,
    },
    {
        label: 'mailing phase for a US resident who already sent it',
        phase: OnboardingPhase.MailingAddress,
        countryIso: 'US',
        localStep: OnboardingStep.Verification,
        step: OnboardingStep.Verification,
    },
    // For anyone outside the US it means every form is in.
    {
        label: 'mailing phase outside the US',
        phase: OnboardingPhase.MailingAddress,
        step: OnboardingStep.Verification,
    },
    {
        label: 'mailing phase outside the US with KYC under review',
        phase: OnboardingPhase.MailingAddress,
        verificationState: VerificationState.Pending,
        step: OnboardingStep.Verification,
    },
    {
        label: 'account phase',
        phase: OnboardingPhase.Account,
        verificationState: VerificationState.Verified,
        step: OnboardingStep.Verification,
    },
    // No phase: the device's own order.
    {
        label: 'no phase after phone verification',
        localStep: OnboardingStep.PersonalDetails,
        step: OnboardingStep.PersonalDetails,
    },
    {
        label: 'no phase after personal details',
        localStep: OnboardingStep.Address,
        step: OnboardingStep.Address,
    },
    {
        label: 'no phase after an address with a separate mailing address',
        localStep: OnboardingStep.MailingAddress,
        step: OnboardingStep.MailingAddress,
    },
    {
        label: 'no phase after the address',
        localStep: OnboardingStep.Verification,
        step: OnboardingStep.Verification,
    },
    {
        label: 'no phase with KYC verified',
        localStep: OnboardingStep.Verification,
        verificationState: VerificationState.Verified,
        step: OnboardingStep.Verification,
    },
    {
        label: 'no phase at the additional details step',
        localStep: OnboardingStep.AdditionalDetails,
        step: OnboardingStep.AdditionalDetails,
    },
    {
        label: 'no phase mid email verification',
        localStep: OnboardingStep.EmailVerify,
        step: OnboardingStep.EmailSend,
    },
    {
        label: 'no phase mid phone verification',
        localStep: OnboardingStep.PhoneVerify,
        step: OnboardingStep.PhoneSend,
    },
    {
        label: 'no phase once completed',
        localStep: OnboardingStep.Completed,
        step: OnboardingStep.Completed,
    },
    {
        label: 'a persisted step this build no longer knows',
        localStep: 'SOMETHING_OLD' as OnboardingStep,
        step: OnboardingStep.PhoneSend,
    },
    // A session means the account exists, whatever the record says.
    {
        label: 'an existing session',
        hasSession: true,
        phase: OnboardingPhase.PhysicalAddress,
        step: OnboardingStep.Completed,
    },
    // The residence may be unknown on another device or after a reinstall.
    {
        label: 'mailing phase with no residence known',
        phase: OnboardingPhase.MailingAddress,
        countryIso: null,
        localStep: OnboardingStep.MailingAddress,
        step: OnboardingStep.Verification,
    },
    {
        label: "mailing phase with the record's US residence",
        phase: OnboardingPhase.MailingAddress,
        countryIso: 'US',
        localStep: OnboardingStep.EmailSend,
        step: OnboardingStep.MailingAddress,
    },
]

describe('resolveOnboardingStep', () => {
    it.each(CASES)(
        'resolves $label to $step',
        ({ label: _label, step, ...input }) => {
            expect(resolveOnboardingStep({ ...BASE, ...input })).toBe(step)
        },
    )

    it.each([...Object.values(OnboardingPhase), null])(
        'keeps a rejected user at the KYC step whatever the phase (%s)',
        phase => {
            expect(
                resolveOnboardingStep({
                    ...BASE,
                    phase,
                    verificationState: VerificationState.Rejected,
                }),
            ).toBe(OnboardingStep.Verification)
        },
    )
})
