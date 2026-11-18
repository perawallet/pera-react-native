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

import { useQuery } from '@tanstack/react-query'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import type { HistoryPeriod, Nullable } from '@perawallet/wallet-core-shared'
import { fetchCurrencyHistory } from '../api/currencies'
import type { CurrencyHistoryPoint } from '../models'
import { currencyQueryKeys } from './querykeys'

// The backend stores one rate a day, so a chart opened again within the hour reuses the answer.
const CURRENCY_HISTORY_STALE_TIME_MS = 60 * 60 * 1000

export type UseCurrencyHistoryQueryResult = {
    data: Nullable<CurrencyHistoryPoint[]>
    /** A first read is in flight: no rates yet, and some on the way. */
    isLoading: boolean
}

export const useCurrencyHistoryQuery = (
    currencyId: string,
    period: HistoryPeriod,
    enabled = true,
): UseCurrencyHistoryQueryResult => {
    const deployment = useWalletDeployment()
    const query = useQuery({
        queryKey: currencyQueryKeys.history(deployment, currencyId, period),
        queryFn: ({ signal }): Promise<CurrencyHistoryPoint[]> =>
            fetchCurrencyHistory({ currencyId, period, deployment, signal }),
        enabled,
        staleTime: CURRENCY_HISTORY_STALE_TIME_MS,
    })
    return {
        data: enabled ? (query.data ?? null) : null,
        isLoading: enabled && query.isLoading,
    }
}
