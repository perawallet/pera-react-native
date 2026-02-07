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

import type { DateRange } from './types'
import { DEFAULT_CSV_FILENAME } from './types'

/**
 * Validates that a string is in the correct ISO 8601 date format (YYYY-MM-DD).
 */
export const isValidISODate = (dateString: string): boolean => {
    const isoDateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

    if (!isoDateRegex.test(dateString)) {
        return false
    }

    // Additional validation: ensure it's a real date (e.g., not 2024-02-30)
    const date = new Date(dateString)
    const datePieces = dateString.split('-')
    const year = parseInt(datePieces[0], 10)
    const month = parseInt(datePieces[1], 10)
    const day = parseInt(datePieces[2], 10)

    return (
        date.getFullYear() === year &&
        date.getMonth() + 1 === month &&
        date.getDate() === day
    )
}

/**
 * Formats a JavaScript Date object to ISO 8601 date string (YYYY-MM-DD).
 */
export const formatISODate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

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
