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

import { ONE_DAY, ONE_HOUR, ONE_MINUTE } from '@perawallet/wallet-core-config'

/**
 * Validates that a string is in the correct ISO 8601 date format (YYYY-MM-DD).
 * Also validates that the date is a real calendar date (e.g., rejects 2024-02-30).
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
 * Converts Unix timestamp to JavaScript Date object.
 */
export const parseRoundTime = (unixTimestamp: number): Date => {
    return new Date(unixTimestamp * 1000)
}

/**
 * Converts a `YYYY-MM-DD` date string to the UTC start-of-day in Unix seconds
 * (matching how transaction `roundTime` is stored). Returns `NaN` for missing
 * or unparseable input, so callers guard with `Number.isFinite(...)`.
 */
export const isoDateToUnixSeconds = (isoDate?: string): number => {
    if (isoDate === undefined) return NaN
    const ms = Date.parse(`${isoDate}T00:00:00.000Z`)
    return Number.isNaN(ms) ? NaN : Math.floor(ms / 1000)
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a human-readable format (e.g., "Nov 6, 2025").
 */
export const formatDisplayDate = (isoDate: string): string => {
    const [year, month, day] = isoDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

/**
 * Creates an ISO 8601 date string for filtering transactions by date.
 */
export const toISODateString = (date: Date): string => {
    return date.toISOString()
}

/**
 * Creates date range parameters for the last N days.
 */
export const getDateRangeParams = (
    days: number,
): { afterTime: string; beforeTime: string } => {
    const now = new Date()
    const pastDate = new Date(now.getTime() - days * ONE_DAY)

    return {
        afterTime: pastDate.toISOString(),
        beforeTime: now.toISOString(),
    }
}

/**
 * Formats the duration between `now` and `expiresAt` as a short,
 * human-readable "time left" string. Returns `null` when `expiresAt` is
 * in the past, so the caller can hide the badge entirely.
 */
export const formatTimeRemaining = (
    expiresAt: Date,
    now: number = Date.now(),
): string | null => {
    const remaining = expiresAt.getTime() - now
    if (remaining <= 0) return null
    if (remaining < ONE_MINUTE) return '<1m'
    if (remaining < ONE_HOUR) return `${Math.round(remaining / ONE_MINUTE)}m`
    if (remaining < ONE_DAY) return `${Math.round(remaining / ONE_HOUR)}h`
    return `${Math.round(remaining / ONE_DAY)}d`
}
