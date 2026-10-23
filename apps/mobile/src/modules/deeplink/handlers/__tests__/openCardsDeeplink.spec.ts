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

import { describe, it, expect } from 'vitest'
import { OnboardingStep } from '@perawallet/wallet-core-card'
import { getCardDeeplinkTarget } from '../openCardsDeeplink'

const IN_PROGRESS = {
    onboardingId: 'ob_1',
    onboardingStep: OnboardingStep.Verification,
}

describe('getCardDeeplinkTarget', () => {
    it.each(['onboarding-status', '/onboarding-status', 'onboarding-status/'])(
        'opens the checklist for %s while onboarding is in progress',
        path => {
            expect(getCardDeeplinkTarget(path, IN_PROGRESS)).toBe(
                'onboarding-status',
            )
        },
    )

    it('opens the card home once onboarding is complete', () => {
        expect(
            getCardDeeplinkTarget('onboarding-status', {
                onboardingId: 'ob_1',
                onboardingStep: OnboardingStep.Completed,
            }),
        ).toBe('card-home')
    })

    it('keeps the intro when this device has no onboarding', () => {
        expect(
            getCardDeeplinkTarget('onboarding-status', {
                onboardingId: null,
                onboardingStep: OnboardingStep.EmailSend,
            }),
        ).toBe('intro')
    })

    it.each([undefined, '', 'onboarding/select-country', '/cards'])(
        'keeps the intro for the path %s',
        path => {
            expect(getCardDeeplinkTarget(path, IN_PROGRESS)).toBe('intro')
        },
    )
})
