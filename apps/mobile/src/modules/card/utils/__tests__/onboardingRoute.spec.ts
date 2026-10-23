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
import {
    getOnboardingNextRoute,
    type OnboardingRouteInput,
} from '../onboardingRoute'

// The step table lives with resolveOnboardingStep in the card package; this
// covers only how a step becomes a screen.
const BASE: OnboardingRouteInput = {
    phase: null,
    verificationState: null,
    countryIso: 'GB',
    localStep: OnboardingStep.PersonalDetails,
    hasSession: false,
    hasContactVerificationId: true,
}

describe('getOnboardingNextRoute', () => {
    it.each([
        [OnboardingStep.EmailVerify, 'CardOnboardingEmail'],
        [OnboardingStep.PhoneVerify, 'CardOnboardingPhone'],
        [OnboardingStep.PersonalDetails, 'CardOnboardingPersonalDetails'],
        [OnboardingStep.AdditionalDetails, 'CardOnboardingAdditionalDetails'],
        [OnboardingStep.Address, 'CardOnboardingAddress'],
        [OnboardingStep.MailingAddress, 'CardOnboardingMailingAddress'],
        [OnboardingStep.Verification, 'CardOnboardingVerification'],
        [OnboardingStep.Completed, 'CardOnboardingStatus'],
    ])('opens the screen for the %s step', (localStep, screen) => {
        expect(getOnboardingNextRoute({ ...BASE, localStep }).screen).toBe(
            screen,
        )
    })

    it.each([
        ['under review', { verificationState: VerificationState.Pending }],
        ['verified', { verificationState: VerificationState.Verified }],
        ['rejected', { verificationState: VerificationState.Rejected }],
        ['with the account created', { phase: OnboardingPhase.Account }],
    ])(
        'waits on the checklist at the KYC step when KYC is %s',
        (_label, override) => {
            expect(
                getOnboardingNextRoute({
                    ...BASE,
                    localStep: OnboardingStep.Verification,
                    ...override,
                }),
            ).toEqual({
                screen: 'CardOnboardingStatus',
                step: OnboardingStep.Verification,
            })
        },
    )

    it("follows Baanx's phase over the device's step", () => {
        expect(
            getOnboardingNextRoute({
                ...BASE,
                phase: OnboardingPhase.AdditionalDetails,
                localStep: OnboardingStep.Address,
            }),
        ).toEqual({
            screen: 'CardOnboardingAdditionalDetails',
            step: OnboardingStep.AdditionalDetails,
        })
    })
})
