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
 * Converts microAlgos to ALGOs with proper decimal formatting.
 *
 * Algorand uses microAlgos as its base unit (1 ALGO = 1,000,000 microAlgos).
 * This helper converts string microAlgo amounts to human-readable ALGO amounts.
 *
 * @param microAlgos - The amount in microAlgos as a string
 * @param decimals - Number of decimal places to show (default: 6)
 * @returns The amount in ALGOs as a formatted string
 *
 * @example
 * formatMicroAlgos("1000000") // Returns "1.000000"
 * formatMicroAlgos("1500000", 2) // Returns "1.50"
 */
export const formatMicroAlgos = (
    microAlgos: string,
    decimals: number = 6,
): string => {
    const amount = BigInt(microAlgos)
    const algoAmount = Number(amount) / 1_000_000
    return algoAmount.toFixed(decimals)
}

/**
 * Converts Unix timestamp to JavaScript Date object.
 *
 * The API returns Unix timestamps in seconds, but JavaScript Date
 * expects milliseconds since epoch.
 *
 * @param unixTimestamp - Unix timestamp in seconds
 * @returns JavaScript Date object
 */
export const parseRoundTime = (unixTimestamp: number): Date => {
    return new Date(unixTimestamp * 1000)
}

/**
 * Formats an asset amount considering its decimals.
 *
 * @param amount - The amount in base units as a string
 * @param decimals - The number of decimal places for the asset
 * @param displayDecimals - Optional number of decimal places to display
 * @returns The formatted amount as a string
 *
 * @example
 * formatAssetAmount("1000000", 6) // Returns "1.000000"
 * formatAssetAmount("1000000", 6, 2) // Returns "1.00"
 */
export const formatAssetAmount = (
    amount: string,
    decimals: number,
    displayDecimals?: number,
): string => {
    const amountBigInt = BigInt(amount)
    const divisor = Math.pow(10, decimals)
    const formattedAmount = Number(amountBigInt) / divisor
    return formattedAmount.toFixed(displayDecimals ?? decimals)
}

/**
 * Creates an ISO 8601 date string for filtering transactions by date.
 *
 * @param date - The Date object to format
 * @returns ISO 8601 formatted string
 */
export const toISODateString = (date: Date): string => {
    return date.toISOString()
}

/**
 * Creates date range parameters for the last N days.
 *
 * @param days - Number of days to go back
 * @returns Object with afterTime and beforeTime in ISO format
 */
export const getDateRangeParams = (
    days: number,
): { afterTime: string; beforeTime: string } => {
    const now = new Date()
    const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    return {
        afterTime: pastDate.toISOString(),
        beforeTime: now.toISOString(),
    }
}
