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
    getCardOnboardingProgress,
    isEscrowCardApproved,
    OnboardingStep,
} from '@perawallet/wallet-core-card'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { navigationRef } from '@routes/navigationRef'
import { navigateToScreen } from '../navigateToScreen'

/** The `path` Baanx's hosted KYC returns users to (configured on their side). */
export const CARD_ONBOARDING_STATUS_PATH = 'onboarding-status'

const ONBOARDING_STATUS_SCREEN = 'CardOnboardingStatus'

export type CardDeeplinkTarget = 'intro' | 'onboarding-status' | 'card-home'

/**
 * Where a cards deeplink lands. Only the onboarding-status path is routed;
 * anything else keeps the intro, which is what every cards link opened before.
 */
export const getCardDeeplinkTarget = (
    path: Optional<string>,
    {
        onboardingId,
        onboardingStep,
        hasApprovedCard,
    }: {
        onboardingId: Nullable<string>
        onboardingStep: OnboardingStep
        /** The escrow card exists and is approved, like the account switcher checks. */
        hasApprovedCard: boolean
    },
): CardDeeplinkTarget => {
    const cleanPath = (path ?? '').replace(/^\/+|\/+$/g, '')
    if (cleanPath !== CARD_ONBOARDING_STATUS_PATH) return 'intro'
    // A session alone doesn't mean the card exists; the checklist creates it.
    if (onboardingStep === OnboardingStep.Completed) {
        return hasApprovedCard ? 'card-home' : 'onboarding-status'
    }
    return onboardingId !== null ? 'onboarding-status' : 'intro'
}

export const openCardsDeeplink = (
    path: Optional<string>,
    replaceCurrentScreen: boolean,
): void => {
    const { onboardingId, onboardingStep } = getCardOnboardingProgress()
    const target = getCardDeeplinkTarget(path, {
        onboardingId,
        onboardingStep,
        hasApprovedCard: isEscrowCardApproved(),
    })
    switch (target) {
        case 'onboarding-status': {
            // Returning from KYC usually lands on the checklist that is already
            // open; replacing or remounting it would restart its polling.
            if (
                navigationRef.getCurrentRoute()?.name ===
                ONBOARDING_STATUS_SCREEN
            ) {
                return
            }
            navigateToScreen(false, 'PeraCard', {
                screen: 'CardOnboarding',
                params: { screen: ONBOARDING_STATUS_SCREEN, params: {} },
            })
            return
        }
        case 'card-home': {
            navigateToScreen(replaceCurrentScreen, 'TabBar', {
                screen: 'Home',
                params: { screen: 'PeraCardAccount' },
            })
            return
        }
        case 'intro': {
            navigateToScreen(replaceCurrentScreen, 'PeraCard', {
                screen: 'PeraCardIntro',
            })
        }
    }
}
