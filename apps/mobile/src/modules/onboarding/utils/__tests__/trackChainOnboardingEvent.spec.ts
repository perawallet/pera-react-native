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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { offeredLocalKeyKinds } from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { OnboardingEvent } from '@analytics'
import { registerAlgorandAccountsAdapter } from '@test-utils/algorandAccountsAdapter'
import { trackChainOnboardingEvent } from '../trackChainOnboardingEvent'

vi.mock('@perawallet/wallet-core-accounts', async () =>
    vi.importActual('@perawallet/wallet-core-accounts'),
)

const mockTrackEvent = vi.hoisted(() => vi.fn())
vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))

describe('trackChainOnboardingEvent', () => {
    beforeEach(() => {
        mockTrackEvent.mockClear()
    })

    it('tracks an onboarding event the catalog sends without a payload', () => {
        trackChainOnboardingEvent(OnboardingEvent.CreateAccountQuantum)

        expect(mockTrackEvent).toHaveBeenCalledWith(
            OnboardingEvent.CreateAccountQuantum,
        )
    })

    it('ignores an event that needs a payload, an unknown name, or none', () => {
        trackChainOnboardingEvent(OnboardingEvent.RegisterAccount)
        trackChainOnboardingEvent('not_an_onboarding_event')
        trackChainOnboardingEvent(undefined)

        expect(mockTrackEvent).not.toHaveBeenCalled()
    })
})

describe('the registered chain key-kind options', () => {
    // A chain names its events as strings, and the tracker silently drops a
    // name the catalog lacks, so a renamed or new event must land here first.
    it('log only events the onboarding catalog sends without a payload', () => {
        registerAlgorandAccountsAdapter()
        const events = offeredLocalKeyKinds(LEGACY_CHAIN_ID).flatMap(
            ({ options }) =>
                [
                    options.recover?.analyticsEvent,
                    options.create?.analyticsEvent,
                ].filter((event): event is string => event !== undefined),
        )

        expect(events.length).toBeGreaterThan(0)
        for (const event of events) {
            expect(Object.values(OnboardingEvent)).toContain(event)
            mockTrackEvent.mockClear()
            trackChainOnboardingEvent(event)
            expect(mockTrackEvent).toHaveBeenCalledWith(event)
        }
    })
})
