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
import { OnboardingEvent } from '@analytics'
import { trackChainOnboardingEvent } from '../trackChainOnboardingEvent'

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
