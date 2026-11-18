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

import { buildIntegrityHeadersWhenReady } from '@perawallet/wallet-core-app-integrity'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import {
    isPeraNetworkError,
    queryClient,
    type Optional,
    type RequestConfiguration,
} from '@perawallet/wallet-core-shared'
import {
    buildCsvQueryParams,
    countCsvRows,
    CsvExportError,
    generateFilename,
    type CsvExportResult,
    type FetchCsvParams,
} from '@perawallet/wallet-core-transactions'
import { eip155ChainIdOf, toCaip19 } from '../../blockchain/utils/caip19'
import type { EvmChain } from '../../chains/types'
import { HISTORY_SERVICE } from './endpoints'

export const exportHistoryPath = (
    eip155ChainId: number | string,
    address: string,
): string => `/api/v3/evm/${eip155ChainId}/accounts/${address}/export-history/`

// The name is written into the cache directory, so only a bare file name is
// taken. It carries the backend's `TRUNCATED-` prefix on a cut-short export.
const SERVED_FILENAME =
    /(?:^|;)\s*filename\s*=\s*(?:"([\w.-]+\.csv)"|([\w.-]+\.csv))\s*(?:;|$)/i

// The backend builds the whole file before it answers, so a long history
// outlasts ky's 10 s default; a retry would rerun the export and spend the
// device's export allowance again.
export const EVM_HISTORY_EXPORT_BOUNDS = {
    timeout: 60_000,
    retry: { limit: 0 },
} satisfies Pick<RequestConfiguration, 'timeout' | 'retry'>

/** Rejects with `CsvExportError`, carrying the 429 and 5xx copy for the toast. */
export const fetchEvmHistoryCsv = async (
    chain: EvmChain,
    {
        accountAddress,
        scope,
        dateRange,
        filename,
        assetId,
        signal,
    }: FetchCsvParams,
): Promise<CsvExportResult> => {
    let url: Optional<string>
    try {
        url = exportHistoryPath(
            eip155ChainIdOf(scope, chain),
            accountAddress.toLowerCase(),
        )
        const response = await queryClient<string>({
            backend: 'pera',
            service: HISTORY_SERVICE,
            scope,
            method: 'GET',
            url,
            params: buildCsvQueryParams(
                dateRange,
                assetId === undefined
                    ? undefined
                    : toCaip19(assetId, scope, chain),
            ),
            headers: await buildIntegrityHeadersWhenReady(),
            signal,
            responseType: 'text',
            ...EVM_HISTORY_EXPORT_BOUNDS,
        })
        const csvContent = response.data
        if (!csvContent?.trim()) {
            throw new CsvExportError(
                'Empty CSV content received from API',
                response.status,
                url,
            )
        }
        const servedFilename = SERVED_FILENAME.exec(
            response.headers?.get('content-disposition') ?? '',
        )
        const served = servedFilename?.[1] ?? servedFilename?.[2]
        return {
            csvContent,
            filename:
                served && !filename
                    ? served
                    : generateFilename(accountAddress, filename),
            accountAddress,
            dateRange,
            rowCount: countCsvRows(csvContent),
            assetId,
        }
    } catch (error) {
        if (error instanceof CsvExportError) throw error
        const cause = error instanceof Error ? error : undefined
        const status = isPeraNetworkError(error) ? error.status : undefined
        const exportError = new CsvExportError(
            `Failed to export transactions: ${cause?.message ?? String(error)}`,
            status,
            url,
            cause,
        )
        // The device's export allowance or the explorer's rate limit; both clear with time.
        if (status === 429) {
            exportError.metadata.titleKey = i18nKey(
                'errors.evm.rate_limited.title',
            )
            exportError.metadata.messageKey = i18nKey(
                'errors.evm.rate_limited.body',
            )
        }
        throw exportError
    }
}
