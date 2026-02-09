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

/**
 * Date range for filtering transactions in CSV export.
 * Both dates are optional - if not provided, the export will include
 * all transactions from the beginning (for startDate) or up to now (for endDate).
 */
export type DateRange = {
    /**
     * The start date of the range (inclusive).
     * Format must be ISO 8601 date: "YYYY-MM-DD"
     */
    startDate?: string
    /**
     * The end date of the range (inclusive).
     * Format must be ISO 8601 date: "YYYY-MM-DD"
     */
    endDate?: string
}

/**
 * Parameters for exporting transaction history to CSV.
 */
export type ExportCsvParams = {
    /** The Algorand account address to export transactions for */
    accountAddress: string
    /** Optional: Date range to filter transactions */
    dateRange?: DateRange
    /** Optional: Custom filename for the exported CSV (defaults to {address}.csv) */
    filename?: string
}

/**
 * Result of a successful CSV export operation.
 */
export type CsvExportResult = {
    /** The raw CSV content as a text string */
    csvContent: string
    /** The filename used for this export */
    filename: string
    /** The account address that was exported */
    accountAddress: string
    /** The date range that was applied (if any) */
    dateRange?: DateRange
    /** The number of transaction rows in the CSV (excluding header) */
    rowCount: number
}

/**
 * MIME type for CSV files.
 */
export const CSV_MIME_TYPE = 'text/csv'

/**
 * Default filename format for CSV exports.
 */
export const DEFAULT_CSV_FILENAME = '{address}.csv'
