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

import { isValidISODate } from '@perawallet/wallet-core-shared'
import type { DateRange } from './types'
import { DEFAULT_CSV_FILENAME } from './types'

/**
 * Generates a filename for the CSV export.
 */
export const generateFilename = (
    accountAddress: string,
    customFilename?: string,
): string => {
    if (customFilename) {
        return customFilename.endsWith('.csv')
            ? customFilename
            : `${customFilename}.csv`
    }
    return DEFAULT_CSV_FILENAME.replace('{address}', accountAddress)
}

/**
 * Builds query parameters for the CSV export request.
 */
export const buildCsvQueryParams = (
    dateRange?: DateRange,
): Record<string, string> => {
    const params: Record<string, string> = {}

    if (dateRange?.startDate) {
        if (!isValidISODate(dateRange.startDate)) {
            throw new Error(
                `Invalid startDate format: ${dateRange.startDate}. Expected YYYY-MM-DD`,
            )
        }
        params.start_date = dateRange.startDate
    }

    if (dateRange?.endDate) {
        if (!isValidISODate(dateRange.endDate)) {
            throw new Error(
                `Invalid endDate format: ${dateRange.endDate}. Expected YYYY-MM-DD`,
            )
        }
        params.end_date = dateRange.endDate
    }

    return params
}

/**
 * Counts the number of data rows in CSV content (excluding header).
 */
export const countCsvRows = (csvContent: string): number => {
    const lines = csvContent.split(/\r?\n/)
    const dataLines = lines.filter((line, index) => {
        if (!line.trim()) return false
        if (index === 0 || (index === 1 && !lines[0].trim())) return false
        return true
    })
    return dataLines.length
}
