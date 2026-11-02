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
import { usePreferredAmount } from '@components/PreferredAmount'
import type { TransactionDetailAmount } from '@modules/signing/transactions/types'

export type UseTransactionDetailHeroAmountResult = {
    /** False when no price is known, so the native amount leads with no empty fiat line. */
    isFiatLeading: boolean
}

export const useTransactionDetailHeroAmount = (
    amount: TransactionDetailAmount,
    scope: ChainScope,
): UseTransactionDetailHeroAmountResult => {
    const { convertedValue, isPending } = usePreferredAmount(
        amount.value,
        amount.asset.assetId,
        undefined,
        undefined,
        scope,
    )

    return { isFiatLeading: isPending || convertedValue !== null }
}
