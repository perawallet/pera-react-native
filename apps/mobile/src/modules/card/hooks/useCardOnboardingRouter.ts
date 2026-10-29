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

import { useCallback } from 'react'
import {
    getCardOnboardingProgress,
    hasCardSession,
    setCardOnboardingStep,
    type OnboardingPhase,
    type OnboardingStep,
    type VerificationState,
} from '@perawallet/wallet-core-card'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    getOnboardingNextRoute,
    type OnboardingRoute,
} from '../utils/onboardingRoute'

export type OnboardingNextStepInput = {
    /** From the step's response; omitted or null falls back to `localStep`. */
    phase?: Nullable<OnboardingPhase>
    /** The step the fixed order goes to next. */
    localStep: OnboardingStep
    verificationState?: Nullable<VerificationState>
}

export type UseCardOnboardingRouterResult = {
    /** Mirrors the routed step into the card store and opens its screen. */
    goToNextStep: (input: OnboardingNextStepInput) => OnboardingRoute
}

/** Moves the onboarding stack forward through {@link getOnboardingNextRoute}. */
export const useCardOnboardingRouter = (): UseCardOnboardingRouterResult => {
    const navigation = useAppNavigation()

    const goToNextStep = useCallback(
        ({
            phase = null,
            localStep,
            verificationState = null,
        }: OnboardingNextStepInput) => {
            const { countryIso, contactVerificationId } =
                getCardOnboardingProgress()
            const route = getOnboardingNextRoute({
                phase,
                verificationState,
                countryIso,
                localStep,
                hasSession: hasCardSession(),
                hasContactVerificationId: contactVerificationId !== null,
            })
            setCardOnboardingStep(route.step)
            navigation.navigate(route.screen)
            return route
        },
        [navigation],
    )

    return { goToNextStep }
}
