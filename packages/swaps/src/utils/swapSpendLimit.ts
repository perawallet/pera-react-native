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

import type { Decimal } from 'decimal.js'

import type { SwapAssetRef, SwapQuote } from '../models'

/**
 * The most of the input asset a prepared swap may spend, in base units. Read
 * from what the app asked for, never from what the router answered: with a
 * fixed input, slippage only moves the output.
 */
export const swapSpendLimit = (
    quote: SwapQuote,
): { asset: SwapAssetRef; amount: Decimal } => ({
    asset: quote.request.sourceAsset,
    amount: quote.request.sourceAmount,
})
