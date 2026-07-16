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

import type { Network } from '@perawallet/wallet-core-shared'
import { getCardTransport } from '../transport'
import {
    StatementFormat,
    type CardStatement,
    type CardTransactionFilters,
    type CardTransactionPage,
} from '../../models'
import { cardTransactionsListResponseSchema } from './schema'
import { transformCardTransaction } from './transformers'

// Statement format is selected via the Accept header, per the spec.
const STATEMENT_ACCEPT: Record<StatementFormat, string> = {
    [StatementFormat.Csv]: 'text/csv',
    [StatementFormat.Pdf]: 'application/pdf',
}

const buildFilterParams = (
    filters?: CardTransactionFilters,
): Record<string, string> => {
    const params: Record<string, string> = {}
    if (filters?.dateFrom) params.dateFrom = filters.dateFrom
    if (filters?.dateTo) params.dateTo = filters.dateTo
    if (filters?.searchKey) params.searchKey = filters.searchKey
    if (filters?.mccCategories?.length) {
        params.mccCategories = filters.mccCategories.join(',')
    }
    return params
}

export type FetchCardTransactionsParams = {
    network: Network
    /** Zero-indexed page. */
    page?: number
    filters?: CardTransactionFilters
    signal?: AbortSignal
}

export const fetchCardTransactions = async (
    params: FetchCardTransactionsParams,
): Promise<CardTransactionPage> => {
    const { network, page = 0, filters, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'GET',
        path: '/v1/card/transactions',
        authenticated: true,
        params: { page, ...buildFilterParams(filters) },
        signal,
    })

    const items = cardTransactionsListResponseSchema
        .parse(response.data)
        .map(transformCardTransaction)

    // Without a server-provided total we page until an empty page comes back.
    return { items, page, hasMore: items.length > 0 }
}

export type ExportCardStatementParams = {
    network: Network
    format: StatementFormat
    filters?: CardTransactionFilters
    signal?: AbortSignal
}

export const exportCardStatement = async (
    params: ExportCardStatementParams,
): Promise<CardStatement> => {
    const { network, format, filters, signal } = params

    // Statement supports only a date range (no search/MCC filtering).
    const dateParams: Record<string, string> = {}
    if (filters?.dateFrom) dateParams.dateFrom = filters.dateFrom
    if (filters?.dateTo) dateParams.dateTo = filters.dateTo

    const response = await getCardTransport().request<Blob>({
        network,
        method: 'GET',
        path: '/v1/card/transactions/statement',
        authenticated: true,
        params: dateParams,
        headers: { Accept: STATEMENT_ACCEPT[format] },
        responseType: 'blob',
        signal,
    })

    return { format, blob: response.data }
}
