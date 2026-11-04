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

import { Decimal } from 'decimal.js'
import { assetRefKey } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { SwapFee, SwapFeeKind, SwapQuote } from '../models'

export const swapFeeOf = (
    quote: SwapQuote,
    kind: SwapFeeKind,
): Optional<SwapFee> => quote.fees.find(fee => fee.kind === kind)

/**
 * Base units of the source asset the Pera fee takes on top of the swapped
 * amount; zero when it is charged in another asset.
 */
export const peraFeeInSourceAsset = (quote: SwapQuote): Decimal => {
    const fee = swapFeeOf(quote, 'pera')
    return fee &&
        assetRefKey(fee.asset) === assetRefKey(quote.request.sourceAsset)
        ? fee.amount
        : new Decimal(0)
}
