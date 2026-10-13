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

import { trackEvent, OnboardingEvent, type NoPayloadEvent } from '@analytics'

const PAYLOAD_FREE_ONBOARDING_EVENTS = new Set<string>(
    Object.values(OnboardingEvent).filter(
        event => event !== OnboardingEvent.RegisterAccount,
    ),
)

const isPayloadFreeOnboardingEvent = (
    name: string,
): name is Extract<OnboardingEvent, NoPayloadEvent> =>
    PAYLOAD_FREE_ONBOARDING_EVENTS.has(name)

/**
 * A chain names the events its key kinds log as strings; only one the
 * onboarding catalog sends without a payload is tracked.
 */
export const trackChainOnboardingEvent = (name: string | undefined): void => {
    if (name !== undefined && isPayloadFreeOnboardingEvent(name)) {
        trackEvent(name)
    }
}
