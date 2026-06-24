/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { CardFundingProvider } from '../../models'
import { unavailableFundingProvider } from '../../models'

let activeFundingProvider: CardFundingProvider = unavailableFundingProvider

/** The active funding provider used to quote, build, and submit card top-ups. */
export const getCardFundingProvider = (): CardFundingProvider =>
    activeFundingProvider

/**
 * Override the active funding provider. The real Baanx Algorand provider is
 * injected here once it ships; tests use it to supply a fake.
 */
export const setCardFundingProvider = (provider: CardFundingProvider): void => {
    activeFundingProvider = provider
}

export const resetCardFundingProvider = (): void => {
    activeFundingProvider = unavailableFundingProvider
}
