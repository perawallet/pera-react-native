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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { acquireCardSessionTokens } from '../api/auth'
import { linkOnboardingConsent } from '../api/onboarding'
import { OnboardingStep } from '../models'
import { setCardSession } from '../session'
import { useCardStore } from '../store'

/**
 * Binds the consent set created during onboarding to the now-known user.
 * Best effort: the account already exists, so a failed link is logged rather
 * than blocking the user. The stash is cleared once linked so a later sign-in
 * never re-binds it.
 */
export const linkStashedOnboardingConsent = async ({
    userId,
    scope,
}: {
    userId: string
    scope: ChainScope
}): Promise<void> => {
    const { consentSetId } = useCardStore.getState()
    if (consentSetId === null) return
    try {
        await linkOnboardingConsent({ consentSetId, userId, scope })
        useCardStore.getState().setConsentSetId(null)
    } catch (error) {
        logger.warn('Card onboarding consent link failed', { error })
    }
}

/**
 * Turns a Baanx access token into the card session: trade it for the durable
 * OAuth pair (a refresh-less session if the exchange fails, since the account
 * already exists), mark onboarding done, bind the device's setup state to the
 * user and link the onboarding consent.
 */
export const finalizeCardRegistration = async ({
    accessToken,
    userId,
    scope,
}: {
    accessToken: string
    userId: Nullable<string>
    scope: ChainScope
}): Promise<void> => {
    const tokens = await acquireCardSessionTokens({ accessToken, scope })
    await setCardSession(tokens)
    const store = useCardStore.getState()
    store.setOnboardingStep(OnboardingStep.Completed)
    store.clearLoginSecrets()
    if (userId !== null) {
        store.adoptCardUser(userId)
        await linkStashedOnboardingConsent({ userId, scope })
    }
}
