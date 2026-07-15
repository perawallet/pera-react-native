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

/**
 * Stablecoins a Pera Card can settle in. USDC only today; add new entries here
 * as they become supported.
 */
export const CardCurrency = {
    USDC: 'USDC',
} as const
export type CardCurrency = (typeof CardCurrency)[keyof typeof CardCurrency]

/**
 * Default settlement currency to display until the API exposes the card's
 * actual one.
 *
 * TODO(card): source the card's settlement currency from the API once exposed,
 * falling back to this default.
 */
export const DEFAULT_CARD_CURRENCY: CardCurrency = CardCurrency.USDC
