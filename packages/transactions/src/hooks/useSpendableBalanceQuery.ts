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

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Optional } from '@perawallet/wallet-core-shared'
import type {
    SpendableBalance,
    SpendableBalanceInput,
} from '../transfer-adapter'
import { spendableBalanceQueryOptions } from './spendableBalanceQueryOptions'

export type UseSpendableBalanceQueryResult = {
    /** `undefined` until loaded; callers gate on it, so no default. */
    data: Optional<SpendableBalance>
    /** True while `data` is missing or still answers an earlier input. */
    isPending: boolean
}

export const useSpendableBalanceQuery = (
    input: Optional<SpendableBalanceInput>,
): UseSpendableBalanceQueryResult => {
    const { isEnabled, options } = spendableBalanceQueryOptions(input)

    const query = useQuery({
        ...options,
        // The fee arriving re-keys the query; keep the last answer meanwhile
        // rather than dropping the screen back to a spinner.
        placeholderData: keepPreviousData,
    })

    return {
        data: query.data,
        // TanStack reports a skipped query as pending. Placeholder data is the
        // answer for an earlier input, so it still counts as pending.
        isPending: isEnabled && (query.isPending || query.isPlaceholderData),
    }
}
