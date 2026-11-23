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

import type {
    BalanceChange,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { getChainCapabilities } from '@perawallet/wallet-core-chain-shared'
import {
    baseUnitsToDisplayUnits,
    isValidISODate,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    countCsvRows,
    CsvExportError,
    generateFilename,
    isFeePaidByAccount,
    isRecordInAssetHistory,
    type CsvExportResult,
    type FetchCsvParams,
} from '@perawallet/wallet-core-transactions'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { readStoredEvmHistory } from './history-cache'
import { readNftApprovals } from './nft-approvals'
import { toEvmHistoryRecords } from './records'

/** The backend export's own cap. */
export const EVM_HISTORY_CSV_MAX_ROWS = 20_000

const HEADER = [
    'Date (UTC)',
    'Transaction Hash',
    'Block',
    'Status',
    'Type',
    'Direction',
    'Asset',
    'Asset ID',
    'Amount',
    'Amount (base units)',
    'Fee',
    'Fee Asset',
    'From',
    'Counterparty',
]

const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/
const FORMULA_START = /^[=+\-@\t\r]/

// Token metadata is chain-controlled text, so a symbol such as `=HYPERLINK(...)`
// would run as a formula when the file opens in a spreadsheet.
const cellOf = (value: Optional<string | number>): string => {
    const text = value === undefined ? '' : String(value)
    const guarded =
        FORMULA_START.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text
    return `"${guarded.replaceAll('"', '""')}"`
}

const dateOf = (timestamp: Optional<number>): string =>
    timestamp === undefined
        ? ''
        : new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ')

const movementsOf = ({
    summary,
}: TransactionRecord): Optional<BalanceChange>[] => {
    if (summary.balanceChanges?.length) return summary.balanceChanges
    if (summary.amount) {
        const { assetRef, value, display } = summary.amount
        return [
            {
                assetRef,
                value: summary.direction === 'out' ? value.negated() : value,
                ...(display && { display }),
            },
        ]
    }
    return [undefined]
}

export const buildEvmHistoryCsv = (
    records: readonly TransactionRecord[],
    accountAddress: string,
    chain: EvmChain,
): string => {
    const native = chain.row.nativeAsset
    const rows = records.flatMap(record => {
        const feeCells =
            record.fee !== undefined &&
            isFeePaidByAccount(record, accountAddress)
                ? [
                      baseUnitsToDisplayUnits(
                          record.fee,
                          native.decimals,
                      ).toFixed(),
                      native.symbol,
                  ]
                : ['', '']
        return movementsOf(record).map((movement, index) => {
            const isNative =
                movement?.assetRef.assetId === chain.nativeAsset.assetId
            const symbol =
                movement?.display?.symbol ?? (isNative ? native.symbol : '')
            const decimals =
                movement?.display?.decimals ??
                (isNative ? native.decimals : undefined)
            return [
                dateOf(record.timestamp),
                record.id,
                record.blockNumber,
                record.status,
                record.summary.kind,
                record.summary.direction,
                symbol,
                movement?.assetRef.assetId,
                movement && decimals !== undefined
                    ? baseUnitsToDisplayUnits(
                          movement.value,
                          decimals,
                      ).toFixed()
                    : '',
                movement?.value.toFixed(),
                ...(index === 0 ? feeCells : ['', '']),
                record.initiator,
                record.summary.counterparty,
            ]
        })
    })
    return [HEADER, ...rows]
        .map(row => `${row.map(cellOf).join(',')}\r\n`)
        .join('')
}

/** Rejects only with `CsvExportError`. Reads SQLite alone: no request is made. */
export const exportStoredEvmHistoryCsv = async (
    chain: EvmChain,
    { accountAddress, scope, dateRange, filename, assetId }: FetchCsvParams,
): Promise<CsvExportResult> => {
    try {
        const { startDate, endDate } = dateRange ?? {}
        if (startDate && !isValidISODate(startDate)) {
            throw new CsvExportError(
                `Invalid startDate format: ${startDate}. Expected YYYY-MM-DD`,
            )
        }
        if (endDate && !isValidISODate(endDate)) {
            throw new CsvExportError(
                `Invalid endDate format: ${endDate}. Expected YYYY-MM-DD`,
            )
        }
        const stored = await readStoredEvmHistory({
            address: accountAddress,
            scope,
            afterTime: startDate || undefined,
            beforeTime: endDate || undefined,
            limit: EVM_HISTORY_CSV_MAX_ROWS + 1,
        })
        const isTruncated = stored.length > EVM_HISTORY_CSV_MAX_ROWS
        const items = isTruncated
            ? stored.slice(0, EVM_HISTORY_CSV_MAX_ROWS)
            : stored
        const isDecoding = getChainCapabilities(scope.chainId).contractDecoding
        const nftApprovals = await readNftApprovals(
            items,
            accountAddress,
            scope,
        )
        const records = items
            .flatMap(item =>
                toEvmHistoryRecords(
                    item,
                    accountAddress,
                    scope,
                    chain,
                    isDecoding,
                    nftApprovals,
                ),
            )
            .filter(
                record =>
                    assetId === undefined ||
                    isRecordInAssetHistory(record, assetId, accountAddress),
            )
        const csvContent = buildEvmHistoryCsv(records, accountAddress, chain)
        const lower = accountAddress.toLowerCase()
        return {
            csvContent,
            filename: filename
                ? generateFilename(accountAddress, filename)
                : `${isTruncated ? 'TRUNCATED-' : ''}Transactions-${eip155ChainIdOf(scope, chain)}-${lower.slice(0, 6)}--${lower.slice(-4)}-Pera.csv`,
            accountAddress,
            dateRange,
            rowCount: countCsvRows(csvContent),
            assetId,
        }
    } catch (error) {
        if (error instanceof CsvExportError) throw error
        const cause = error instanceof Error ? error : undefined
        throw new CsvExportError(
            `Failed to export transactions: ${cause?.message ?? String(error)}`,
            undefined,
            undefined,
            cause,
        )
    }
}
