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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { trackEvent, OnboardingEvent, AnalyticsMetadataKey } from '@analytics'

// The events a chain's key kinds may name: each carries only the chain.
const KEY_KIND_ONBOARDING_EVENTS = [
    OnboardingEvent.RecoverAlgo25,
    OnboardingEvent.RecoverOneKey,
    OnboardingEvent.CreateAccountQuantum,
] as const

type KeyKindOnboardingEvent = (typeof KEY_KIND_ONBOARDING_EVENTS)[number]

const isKeyKindOnboardingEvent = (
    name: string,
): name is KeyKindOnboardingEvent =>
    (KEY_KIND_ONBOARDING_EVENTS as readonly string[]).includes(name)

/**
 * A chain names the events its key kinds log as strings; only one the
 * onboarding catalog lists for key kinds is tracked.
 */
export const trackChainOnboardingEvent = (
    name: Optional<string>,
    chainId: ChainId,
): void => {
    if (name !== undefined && isKeyKindOnboardingEvent(name)) {
        trackEvent(name, { [AnalyticsMetadataKey.ChainId]: chainId })
    }
}
