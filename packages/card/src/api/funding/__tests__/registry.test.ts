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

import { describe, it, expect, afterEach } from 'vitest'
import {
    getCardFundingProvider,
    setCardFundingProvider,
    resetCardFundingProvider,
} from '../registry'
import {
    unavailableFundingProvider,
    type CardFundingProvider,
} from '../../../models'

const fakeProvider: CardFundingProvider = {
    isAvailable: () => true,
    getQuote: async () => null,
    buildDelegation: async () => ({}),
    submitFunding: async () => ({ delegationId: 'd', status: 'PENDING' }),
}

describe('card funding provider registry', () => {
    afterEach(() => resetCardFundingProvider())

    it('defaults to the unavailable provider', () => {
        expect(getCardFundingProvider()).toBe(unavailableFundingProvider)
        expect(getCardFundingProvider().isAvailable('mainnet')).toBe(false)
    })

    it('set swaps the active provider and reset restores the default', () => {
        setCardFundingProvider(fakeProvider)
        expect(getCardFundingProvider()).toBe(fakeProvider)

        resetCardFundingProvider()
        expect(getCardFundingProvider()).toBe(unavailableFundingProvider)
    })
})
